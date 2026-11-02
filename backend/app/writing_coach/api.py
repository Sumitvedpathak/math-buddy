"""Writing Coach routes, all under /api/v1/wc.

Student routes identify the child with the X-Profile-Id header (the profile the app already
holds) and require a grade 7 profile. Parent routes reuse the admin token.
"""

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep, require_admin
from app.integrations.langchainrouter import LLMServiceError
from app.models.tables import Profile, WcReview, WcSession, WcSettings, WcSubmission
from app.writing_coach import agents
from app.writing_coach.schemas import (
    DecodeAnswer,
    ReadRequest,
    SessionCreate,
    SessionFinish,
    SettingsUpdate,
    TranscriptUpdate,
    word_count,
)
from app.writing_coach.transcript import CorrectionTooLargeError, check_correction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wc")
parent_router = APIRouter(
    prefix="/parent", dependencies=[Depends(require_admin)], include_in_schema=False
)

RECENT_DAYS = 30
FOCUS_WEEKS = {
    1: ("Decode, Restate, Answer", "Circle the command word, count the parts, restate the question in your first sentence, and answer every part."),
    2: ("Cite and Explain", "Use two pieces of evidence, and after each one explain how it proves your point (two evidence-and-explain pairs)."),
    3: ("Extend", "Add one deeper idea: another group's view, the author's craft, or a link to today."),
    4: ("Timed, test-style", "Work like it is a test. Write your answer, then mark yourself against the list before you see any feedback."),
}


# ------------------------------------------------------------------ helpers

async def current_profile(
    session: SessionDep,
    x_profile_id: Annotated[str | None, Header()] = None,
) -> Profile:
    try:
        profile_id = uuid.UUID(x_profile_id or "")
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Profile not found") from exc
    profile = await session.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.grade != "7":
        raise HTTPException(status_code=403, detail="Writing Coach is for grade 7.")
    return profile


ProfileDep = Annotated[Profile, Depends(current_profile)]


async def get_settings_row(session: AsyncSession, profile_id: uuid.UUID) -> WcSettings:
    row = await session.get(WcSettings, profile_id)
    if row is None:
        row = WcSettings(profile_id=profile_id, history_strand="A", focus_week=1)
        session.add(row)
        await session.commit()
    return row


async def owned_session(session: AsyncSession, session_id: uuid.UUID, profile_id: uuid.UUID) -> WcSession:
    row = await session.get(WcSession, session_id)
    if row is None or row.profile_id != profile_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return row


async def owned_submission(
    session: AsyncSession, submission_id: uuid.UUID, profile_id: uuid.UUID
) -> tuple[WcSubmission, WcSession]:
    sub = await session.get(WcSubmission, submission_id)
    if sub is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub, await owned_session(session, sub.session_id, profile_id)


async def review_for(session: AsyncSession, submission_id: uuid.UUID) -> WcReview | None:
    return await session.scalar(select(WcReview).where(WcReview.submission_id == submission_id))


async def submissions_for(session: AsyncSession, session_id: uuid.UUID) -> dict[str, WcSubmission]:
    rows = await session.scalars(select(WcSubmission).where(WcSubmission.session_id == session_id))
    return {r.kind: r for r in rows}


async def model_answer_unlocked(session: AsyncSession, session_id: uuid.UUID) -> bool:
    draft = (await submissions_for(session, session_id)).get("draft")
    return draft is not None and await review_for(session, draft.id) is not None


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt else None


def _toronto_now() -> datetime:
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("America/Toronto"))
    except Exception:  # tzdata missing in slim images
        return datetime.now(timezone(timedelta(hours=-5)))


def suggested_subject(now: datetime | None = None) -> tuple[str, bool]:
    """(subject, is_rest_day). Mon/Wed/Fri history, Tue/Thu language, Sat school, Sun rest."""
    weekday = (now or _toronto_now()).weekday()
    if weekday in (0, 2, 4):
        return "history", False
    if weekday in (1, 3):
        return "language", False
    if weekday == 5:
        return "school", False
    return "history", True


def session_out(row: WcSession, *, with_model_answer: bool) -> dict:
    item = dict(row.item)
    if not with_model_answer:
        item.pop("model_answer", None)
    return {
        "id": str(row.id),
        "subject": row.subject,
        "topic_id": row.topic_id,
        "concept": row.concept,
        "item": item,
        "focus_week": row.focus_week,
        "decode": row.decode,
        "status": row.status,
        "next_time": row.next_time,
        "model_move": row.model_move,
        "created_at": _iso(row.created_at),
        "completed_at": _iso(row.completed_at),
    }


def review_out(rev: WcReview) -> dict:
    return {**rev.review, "level": rev.level, "percent": rev.percent}


def _levels(subs: dict[str, WcSubmission], reviews: dict[uuid.UUID, WcReview]) -> dict:
    out: dict[str, dict | None] = {}
    for kind in ("draft", "rewrite"):
        sub = subs.get(kind)
        rev = reviews.get(sub.id) if sub else None
        out[kind] = {"level": rev.level, "percent": rev.percent} if rev else None
    return out


async def _list_rows(session: AsyncSession, profile_id: uuid.UUID, limit: int = 200):
    sessions = list(
        await session.scalars(
            select(WcSession)
            .where(WcSession.profile_id == profile_id)
            .order_by(WcSession.created_at.desc())
            .limit(limit)
        )
    )
    if not sessions:
        return [], {}, {}
    ids = [s.id for s in sessions]
    subs = list(await session.scalars(select(WcSubmission).where(WcSubmission.session_id.in_(ids))))
    revs = list(
        await session.scalars(
            select(WcReview).where(WcReview.submission_id.in_([s.id for s in subs]))
        )
    ) if subs else []
    subs_by_session: dict[uuid.UUID, dict[str, WcSubmission]] = {}
    for sub in subs:
        subs_by_session.setdefault(sub.session_id, {})[sub.kind] = sub
    return sessions, subs_by_session, {r.submission_id: r for r in revs}


def _summary_rows(sessions, subs_by_session, reviews) -> list[dict]:
    return [
        {
            "id": str(s.id),
            "created_at": _iso(s.created_at),
            "subject": s.subject,
            "question": s.item.get("question", ""),
            "status": s.status,
            **_levels(subs_by_session.get(s.id, {}), reviews),
        }
        for s in sessions
    ]


def _llm_call_failed(exc: LLMServiceError) -> HTTPException:
    return HTTPException(status_code=503, detail=str(exc))


# ---------------------------------------------------------- student routes

@router.get("/reminder")
async def reminder(profile: ProfileDep, session: SessionDep):
    settings = await get_settings_row(session, profile.id)
    last = await session.scalar(
        select(WcSession)
        .where(WcSession.profile_id == profile.id, WcSession.next_time.is_not(None))
        .order_by(WcSession.created_at.desc())
        .limit(1)
    )
    subject, rest = suggested_subject()
    title, text = FOCUS_WEEKS[settings.focus_week]
    return {
        "focus_week": settings.focus_week,
        "focus_title": title,
        "focus_text": text,
        "last_next_time": last.next_time if last else None,
        "rubric_override": settings.rubric_override,
        "suggested_subject": subject,
        "is_rest_day": rest,
        "history_strand": settings.history_strand,
    }


@router.post("/sessions", status_code=201)
async def create_session(data: SessionCreate, profile: ProfileDep, session: SessionDep):
    settings = await get_settings_row(session, profile.id)
    subject = data.subject or suggested_subject()[0]
    since = datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)
    recent = list(
        await session.scalars(
            select(WcSession)
            .where(WcSession.profile_id == profile.id)
            .order_by(WcSession.created_at.desc())
            .limit(60)
        )
    )
    recent_30 = [
        s for s in recent
        if (s.created_at if s.created_at.tzinfo else s.created_at.replace(tzinfo=timezone.utc)) >= since
    ]
    recent_questions = [s.item.get("question", "") for s in recent_30 if s.subject == subject]
    same_subject = [s for s in recent if s.subject == subject]

    try:
        if subject == "school":
            if not (data.school_question and data.school_question.strip()):
                raise HTTPException(status_code=422, detail="Type the question from school.")
            topic_id, concept = "school-question", "School question"
            item = await agents.generate_school(data.school_question.strip())
        elif subject == "history":
            topic, concept, command_word = agents.pick_history(
                settings.history_strand,
                [s.topic_id for s in same_subject],
                [s.concept for s in same_subject],
            )
            topic_id = topic["id"]
            item = await agents.generate_history(topic, concept, command_word, recent_questions)
        else:
            qtype, concept, command_word = agents.pick_language(
                [s.topic_id for s in same_subject], [s.concept for s in same_subject]
            )
            topic_id = qtype["id"]
            item = await agents.generate_language(qtype, concept, command_word, recent_questions)
            concept = item.thinking_focus or concept
    except LLMServiceError as exc:
        raise _llm_call_failed(exc) from exc

    row = WcSession(
        profile_id=profile.id,
        subject=subject,
        topic_id=topic_id,
        concept=concept,
        item=item.model_dump(),
        focus_week=settings.focus_week,
    )
    session.add(row)
    await session.commit()
    return session_out(row, with_model_answer=False)


@router.get("/sessions")
async def list_sessions(profile: ProfileDep, session: SessionDep):
    sessions, subs, revs = await _list_rows(session, profile.id)
    return _summary_rows(sessions, subs, revs)


@router.get("/sessions/{session_id}")
async def get_session(session_id: uuid.UUID, profile: ProfileDep, session: SessionDep):
    row = await owned_session(session, session_id, profile.id)
    return session_out(row, with_model_answer=await model_answer_unlocked(session, row.id))


@router.post("/sessions/{session_id}/decode")
async def decode_check(session_id: uuid.UUID, data: DecodeAnswer, profile: ProfileDep, session: SessionDep):
    row = await owned_session(session, session_id, profile.id)
    item = row.item
    want_words = {w.lower() for w in item["command_words"]}
    got_words = {w.strip().lower() for w in data.command_words}
    result = {
        "command_words_correct": want_words == got_words,
        "parts_correct": data.parts == item["parts"],
        "focus_correct": data.thinking_focus.strip().lower() == item["thinking_focus"].strip().lower(),
        "answer": {
            "command_words": item["command_words"],
            "parts": item["parts"],
            "thinking_focus": item["thinking_focus"],
        },
        "missed_command_words": sorted(want_words - got_words),
    }
    row.decode = result
    await session.commit()
    return result


@router.post("/sessions/{session_id}/read")
async def read_photos(session_id: uuid.UUID, data: ReadRequest, profile: ProfileDep, session: SessionDep):
    """Photos are read in memory and discarded; only the transcript is stored."""
    row = await owned_session(session, session_id, profile.id)
    subs = await submissions_for(session, row.id)
    if data.kind == "rewrite":
        draft = subs.get("draft")
        if draft is None or await review_for(session, draft.id) is None:
            raise HTTPException(status_code=409, detail="Finish the draft review before the rewrite.")
    existing = subs.get(data.kind)
    if existing is not None and await review_for(session, existing.id) is not None:
        raise HTTPException(status_code=409, detail="This answer has already been reviewed.")
    try:
        transcript = await agents.read_handwriting(data.images)
    except LLMServiceError as exc:
        raise _llm_call_failed(exc) from exc

    if existing is None:
        existing = WcSubmission(session_id=row.id, kind=data.kind, page_count=len(data.images),
                                transcript_original=transcript)
        session.add(existing)
    else:
        existing.page_count = len(data.images)
        existing.transcript_original = transcript
        existing.transcript_confirmed = None
        existing.diff = None
    await session.commit()
    return {"submission_id": str(existing.id), "kind": existing.kind, "transcript": transcript}


@router.put("/submissions/{submission_id}/transcript")
async def confirm_transcript(submission_id: uuid.UUID, data: TranscriptUpdate, profile: ProfileDep, session: SessionDep):
    sub, _ = await owned_submission(session, submission_id, profile.id)
    if await review_for(session, sub.id) is not None:
        raise HTTPException(status_code=409, detail="This answer has already been reviewed.")
    try:
        diff = check_correction(sub.transcript_original, data.text)
    except CorrectionTooLargeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    sub.transcript_confirmed = data.text
    sub.diff = diff
    await session.commit()
    return {"submission_id": str(sub.id), "diff": diff, "word_count": word_count(data.text)}


@router.post("/submissions/{submission_id}/review")
async def review_submission(submission_id: uuid.UUID, profile: ProfileDep, session: SessionDep):
    sub, row = await owned_submission(session, submission_id, profile.id)
    existing = await review_for(session, sub.id)
    if existing is not None:
        return review_out(existing)
    if sub.transcript_confirmed is None:
        raise HTTPException(status_code=409, detail="Confirm the text first.")
    settings = await get_settings_row(session, profile.id)
    try:
        review, model = await agents.review_answer(
            subject=row.subject,
            kind=sub.kind,
            item=row.item,
            focus=FOCUS_WEEKS[row.focus_week][0],
            rubric_override=settings.rubric_override,
            transcript=sub.transcript_confirmed,
        )
    except LLMServiceError as exc:
        raise _llm_call_failed(exc) from exc
    rev = WcReview(
        submission_id=sub.id, review=review.model_dump(), level=review.level,
        percent=review.percent, model=model,
    )
    session.add(rev)
    row.status = "draft_reviewed" if sub.kind == "draft" else "rewrite_reviewed"
    await session.commit()
    return review_out(rev)


@router.get("/sessions/{session_id}/model-answer")
async def model_answer(session_id: uuid.UUID, profile: ProfileDep, session: SessionDep):
    row = await owned_session(session, session_id, profile.id)
    if not await model_answer_unlocked(session, row.id):
        raise HTTPException(status_code=403, detail="Finish the draft review first.")
    return {"model_answer": row.item["model_answer"], "extend_hints": row.item["extend_hints"]}


@router.patch("/sessions/{session_id}")
async def finish_session(session_id: uuid.UUID, data: SessionFinish, profile: ProfileDep, session: SessionDep):
    row = await owned_session(session, session_id, profile.id)
    if not await model_answer_unlocked(session, row.id):
        raise HTTPException(status_code=409, detail="Finish the draft review first.")
    row.next_time = data.next_time.strip()
    row.model_move = (data.model_move or "").strip() or None
    row.status = "done"
    row.completed_at = datetime.now(timezone.utc)
    await session.commit()
    return session_out(row, with_model_answer=True)


@router.get("/sessions/{session_id}/report")
async def session_report(session_id: uuid.UUID, profile: ProfileDep, session: SessionDep):
    row = await owned_session(session, session_id, profile.id)
    subs = await submissions_for(session, row.id)
    submissions = {}
    for kind, sub in subs.items():
        rev = await review_for(session, sub.id)
        confirmed = sub.transcript_confirmed
        submissions[kind] = {
            "id": str(sub.id),
            "original": sub.transcript_original,
            "confirmed": confirmed,
            "diff": sub.diff,
            "word_count": word_count(confirmed) if confirmed else None,
            "review": review_out(rev) if rev else None,
        }
    return {
        "session": session_out(row, with_model_answer=await model_answer_unlocked(session, row.id)),
        "submissions": submissions,
    }


STEPS = ["restate", "answer", "cite", "explain", "extend"]


@router.get("/overview")
async def overview(profile: ProfileDep, session: SessionDep):
    """Where he is lagging, worked out from stored reviews (no AI calls)."""
    sessions, subs, revs = await _list_rows(session, profile.id)
    reviewed = []  # newest first: (session, draft review)
    for s in sessions:
        draft = subs.get(s.id, {}).get("draft")
        rev = revs.get(draft.id) if draft else None
        if rev is not None:
            reviewed.append((s, rev, subs[s.id].get("rewrite")))
    recent = reviewed[:5]

    step_avg = []
    for step in STEPS:
        scores = [r.review["scores"][step]["score"] for _, r, _ in recent]
        step_avg.append({
            "step": step,
            "average": round(sum(scores) / len(scores), 2) if scores else None,
            "missing_count": sum(1 for sc in scores if sc == 0),
        })
    step_avg.sort(key=lambda x: (x["average"] is None, x["average"] if x["average"] is not None else 0))

    missed_parts_sessions = sum(1 for _, r, _ in recent if r.review.get("missedParts"))
    wrong_words: dict[str, int] = {}
    for s, _, _ in recent:
        for w in (s.decode or {}).get("missed_command_words", []):
            wrong_words[w] = wrong_words.get(w, 0) + 1

    timeline = []
    for s, r, rewrite_sub in reversed(reviewed):
        rw = revs.get(rewrite_sub.id) if rewrite_sub else None
        timeline.append({
            "date": _iso(s.created_at), "subject": s.subject,
            "draft_percent": r.percent, "rewrite_percent": rw.percent if rw else None,
        })
    words = [word_count(subs[s.id]["draft"].transcript_confirmed or "") for s, _, _ in recent]
    return {
        "session_count": len(reviewed),
        "recent_count": len(recent),
        "steps": step_avg,
        "sessions_with_missed_parts": missed_parts_sessions,
        "command_words_missed": sorted(wrong_words.items(), key=lambda kv: -kv[1]),
        "average_word_count": round(sum(words) / len(words)) if words else None,
        "timeline": timeline,
    }


# ------------------------------------------------------------ parent routes

async def _profile_or_404(session: AsyncSession, profile_id: uuid.UUID) -> Profile:
    profile = await session.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return profile


@parent_router.get("/sessions")
async def parent_sessions(session: SessionDep, profile_id: Annotated[uuid.UUID, Query()]):
    """Only which tests were done and the level the Reviewer gave. No answers or feedback."""
    await _profile_or_404(session, profile_id)
    sessions, subs, revs = await _list_rows(session, profile_id)
    return _summary_rows(sessions, subs, revs)


def _settings_out(row: WcSettings) -> dict:
    return {
        "history_strand": row.history_strand,
        "rubric_override": row.rubric_override,
        "focus_week": row.focus_week,
    }


@parent_router.get("/settings")
async def parent_get_settings(session: SessionDep, profile_id: Annotated[uuid.UUID, Query()]):
    await _profile_or_404(session, profile_id)
    return _settings_out(await get_settings_row(session, profile_id))


@parent_router.put("/settings")
async def parent_put_settings(
    data: SettingsUpdate, session: SessionDep, profile_id: Annotated[uuid.UUID, Query()]
):
    await _profile_or_404(session, profile_id)
    row = await get_settings_row(session, profile_id)
    if data.history_strand is not None:
        row.history_strand = data.history_strand
    if data.focus_week is not None:
        row.focus_week = data.focus_week
    if "rubric_override" in data.model_fields_set:
        row.rubric_override = (data.rubric_override or "").strip() or None
    await session.commit()
    return _settings_out(row)


router.include_router(parent_router)
