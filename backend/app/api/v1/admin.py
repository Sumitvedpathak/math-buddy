import logging
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select

from app.api.deps import SessionDep, require_admin
from app.models.tables import PracticeAttempt, Profile
from app.schemas.admin import (
    AdminAttempt,
    AdminAttemptDetail,
    AdminLessonProgress,
    AdminProfile,
    DailyProgress,
)
from app.services import profile_service
from app.services.attempt_service import compute_score_pct
from app.services.curriculum_service import all_lessons

logger = logging.getLogger(__name__)

# Hidden from /docs: the admin API should not advertise itself.
router = APIRouter(
    prefix="/admin", dependencies=[Depends(require_admin)], include_in_schema=False
)


def _attempt_fields(a: PracticeAttempt) -> dict:
    return {
        "id": a.id,
        "mode": a.mode,
        "lesson_id": a.lesson_id,
        "topic_id": a.topic_id,
        "question_count": a.question_count,
        "score": a.score,
        "max_score": a.max_score,
        "score_pct": compute_score_pct(a.score, a.max_score),
        "created_at": a.created_at,
    }


def _utc_date(dt: datetime) -> date:
    return dt.astimezone(timezone.utc).date() if dt.tzinfo else dt.date()


async def _require_profile_or_404(session, profile_id: uuid.UUID) -> None:
    try:
        await profile_service.require_profile(session, profile_id)
    except profile_service.ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Not Found") from exc


@router.get("/profiles", response_model=list[AdminProfile])
async def list_profiles(session: SessionDep):
    rows = await session.execute(
        select(Profile, func.count(PracticeAttempt.id), func.max(PracticeAttempt.created_at))
        .outerjoin(PracticeAttempt, PracticeAttempt.profile_id == Profile.id)
        .group_by(Profile.id)
        .order_by(Profile.created_at)
    )
    return [
        AdminProfile(
            **{c: getattr(p, c) for c in ("id", "email", "display_name", "grade", "created_at")},
            attempt_count=count,
            last_attempt_at=last,
        )
        for p, count, last in rows
    ]


@router.get("/profiles/{profile_id}/attempts", response_model=list[AdminAttempt])
async def list_attempts(
    profile_id: uuid.UUID,
    session: SessionDep,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Full attempt history, newest first (snapshots omitted — see the detail route)."""
    await _require_profile_or_404(session, profile_id)
    result = await session.scalars(
        select(PracticeAttempt)
        .where(PracticeAttempt.profile_id == profile_id)
        .order_by(PracticeAttempt.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return [AdminAttempt(**_attempt_fields(a)) for a in result]


@router.get(
    "/profiles/{profile_id}/attempts/{attempt_id}", response_model=AdminAttemptDetail
)
async def get_attempt(profile_id: uuid.UUID, attempt_id: uuid.UUID, session: SessionDep):
    attempt = await session.scalar(
        select(PracticeAttempt).where(
            PracticeAttempt.id == attempt_id, PracticeAttempt.profile_id == profile_id
        )
    )
    if attempt is None:
        raise HTTPException(status_code=404, detail="Not Found")
    return AdminAttemptDetail(
        **_attempt_fields(attempt),
        questions_snapshot=attempt.questions_snapshot,
        evaluation_snapshot=attempt.evaluation_snapshot,
    )


@router.get("/profiles/{profile_id}/progress/daily", response_model=list[DailyProgress])
async def daily_progress(profile_id: uuid.UUID, session: SessionDep):
    """Attempts grouped by (UTC) calendar day, newest day first."""
    await _require_profile_or_404(session, profile_id)
    result = await session.scalars(
        select(PracticeAttempt).where(PracticeAttempt.profile_id == profile_id)
    )
    by_day: dict[date, list[PracticeAttempt]] = defaultdict(list)
    for a in result:
        by_day[_utc_date(a.created_at)].append(a)

    days = []
    for day, attempts in sorted(by_day.items(), reverse=True):
        pcts = [compute_score_pct(a.score, a.max_score) for a in attempts]
        days.append(
            DailyProgress(
                date=day,
                attempt_count=len(attempts),
                curriculum_attempts=sum(a.mode == "curriculum" for a in attempts),
                adhoc_attempts=sum(a.mode == "adhoc" for a in attempts),
                avg_score_pct=round(sum(pcts) / len(pcts), 2),
                best_score_pct=max(pcts),
            )
        )
    return days


@router.get(
    "/profiles/{profile_id}/lesson-progress", response_model=list[AdminLessonProgress]
)
async def lesson_progress(profile_id: uuid.UUID, session: SessionDep):
    """Per-lesson detail across every curriculum lesson (untouched lessons zeroed)."""
    await _require_profile_or_404(session, profile_id)
    rows = {
        r.lesson_id: r
        for r in await profile_service.list_lesson_progress(session, profile_id)
    }
    out = []
    for lesson in all_lessons():
        row = rows.get(lesson["id"])
        out.append(
            AdminLessonProgress(
                lesson_id=lesson["id"],
                lesson_title=lesson["title"],
                unit_id=lesson["unit_id"],
                unit_title=lesson["unit_title"],
                completed=row.completed if row else False,
                best_score_pct=row.best_score_pct if row else 0.0,
                attempts_count=row.attempts_count if row else 0,
                last_attempt_at=row.last_attempt_at if row else None,
            )
        )
    return out
