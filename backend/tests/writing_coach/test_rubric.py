"""Marking against the teacher's rubric: three criteria, an average, and the evidence cap."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.writing_coach.rubric import RUBRIC, sentence_stats
from app.writing_coach.schemas import ModelAnswer, Review
from tests.conftest import ADMIN_TOKEN

from .samples import GOOD_ITEM, GOOD_REVIEW, MODEL_REPLY, OLD_REVIEW, criteria
from .test_api_flow import IMG, make_profile, start_session

ERR_PLACE = {"original": "grand river", "correction": "Grand River", "type": "capitalization",
             "category": "capital_place", "rule": "Names of places need capitals"}


def marked(understanding, evidence, communication, has_evidence=True, **extra):
    return Review.model_validate({
        **GOOD_REVIEW,
        "hasSpecificEvidence": has_evidence,
        "criteria": criteria(understanding, evidence, communication),
        **extra,
    })


# ---- the overall mark

def test_overall_is_the_average_of_the_three_criteria():
    r = marked(("3", 74), ("2+", 68), ("2", 65))
    assert r.overall.model_dump() == {"level": "2+", "percent": 69, "capApplied": False}


def test_the_models_own_overall_is_ignored():
    r = marked(("3", 74), ("2+", 68), ("2", 65), overall={"level": "4+", "percent": 99, "capApplied": False})
    assert (r.overall.level, r.overall.percent) == ("2+", 69)


def test_a_criterion_percent_is_pulled_into_its_level_band():
    r = marked(("2", 78), ("3", 75), ("3", 75))
    assert r.criteria.understanding.percent == 66


def test_a_real_minus_sign_is_accepted_and_unknown_levels_are_rejected():
    assert marked(("3−", 71), ("3", 75), ("3", 75)).criteria.understanding.level == "3-"
    with pytest.raises(ValidationError):
        marked(("5", 90), ("3", 75), ("3", 75))


# ---- the teacher's cap when there is no quote or specific evidence

def test_no_evidence_caps_the_evidence_criterion_at_2_minus():
    r = marked(("3", 75), ("3", 75), ("3", 75), has_evidence=False)
    assert (r.criteria.evidence.level, r.criteria.evidence.percent) == ("2-", 62)
    assert r.overall.capApplied is True


def test_no_evidence_caps_the_overall_mark_at_2_plus():
    r = marked(("4+", 98), ("3", 75), ("4+", 98), has_evidence=False)
    assert r.overall.model_dump() == {"level": "2+", "percent": 69, "capApplied": True}


def test_the_cap_is_not_reported_when_it_changed_nothing():
    r = marked(("2-", 60), ("1", 55), ("2-", 60), has_evidence=False)
    assert (r.criteria.evidence.level, r.overall.percent) == ("1", 58)
    assert r.overall.capApplied is False


def test_the_cap_does_not_touch_an_answer_with_evidence():
    r = marked(("4", 90), ("4", 90), ("4", 90))
    assert (r.overall.level, r.overall.percent, r.overall.capApplied) == ("4", 90, False)


def test_the_reviewer_must_say_whether_there_is_specific_evidence():
    body = {k: v for k, v in GOOD_REVIEW.items() if k != "hasSpecificEvidence"}
    with pytest.raises(ValidationError):
        Review.model_validate(body)


# ---- what the app counts itself

@pytest.mark.parametrize("text,count", [
    ("One sentence. Two sentences! Three sentences?", 3),
    ("No end mark at all", 1),
    ("", 0),
    ("They reached the St. Lawrence in 1755. Mr. Lawrence ordered it.", 2),
    ("It was 3.5 km away. They walked.", 2),
    ('He said "leave now." They left.', 2),
    ("They reached canada[?] by ship. Some [illegible] lost farms.", 2),
    ("It was bad. they left.", 2),
])
def test_sentence_count(text, count):
    assert sentence_stats(text)["sentenceCount"] == count


def test_three_sentences_opening_the_same_way_are_flagged():
    text = "This tract was large. This tract was given away. This tract still matters. They stayed."
    assert sentence_stats(text)["repeatedOpeners"] == ["This tract"]


def test_a_shared_first_word_is_flagged_when_the_second_words_differ():
    text = "This shows greed. This proves fear. This means loss."
    assert sentence_stats(text)["repeatedOpeners"] == ["This"]


def test_two_matching_openers_are_not_flagged():
    assert sentence_stats("This tract was large. This tract was sold. They left.")["repeatedOpeners"] == []


def test_openers_match_whatever_the_capitals():
    assert sentence_stats("This was one. this was two. THIS was three.")["repeatedOpeners"] != []


def test_an_opener_keeps_the_capitals_of_a_name():
    text = "The Haudenosaunee moved. The Haudenosaunee settled. The Haudenosaunee stayed."
    assert sentence_stats(text)["repeatedOpeners"] == ["The Haudenosaunee"]


def test_the_app_overrides_the_models_counts_and_drops_errors_not_in_the_answer():
    body = {**GOOD_REVIEW, "criteria": criteria(errors=[ERR_PLACE, {**ERR_PLACE, "original": "never written"}])}
    body["criteria"]["communication"].update(sentenceCount=99, repeatedOpeners=["Made up"])
    r = Review.model_validate(body)
    r.check_against_transcript("They settled on the grand river. They stayed.")
    comm = r.criteria.communication
    assert (comm.sentenceCount, comm.repeatedOpeners) == (2, [])
    assert [e.original for e in comm.errors] == ["grand river"]


# ---- model answers are written on request, against the same rubric

@pytest.mark.parametrize("sentences,ok", [(3, False), (4, True), (5, True), (7, True), (8, True), (9, False)])
def test_model_answer_is_checked_in_sentences(sentences, ok):
    body = {"model_answer": "A complete sentence goes here. " * sentences}
    if ok:
        ModelAnswer.model_validate(body)
    else:
        with pytest.raises(ValidationError):
            ModelAnswer.model_validate(body)


def test_generators_no_longer_write_a_model_answer():
    prompts = Path(__file__).parents[2] / "app" / "writing_coach" / "prompts"
    for name in ("generator_history.txt", "generator_language.txt", "generator_school.txt"):
        assert "model_answer" not in (prompts / name).read_text(encoding="utf-8")


# ---- the rubric itself and the prompt

def test_rubric_keeps_the_pdf_wording():
    by_key = {c["key"]: c for c in RUBRIC["criteria"]}
    assert by_key["understanding"]["levels"]["4"] == (
        "Demonstrates thorough understanding of the text. Responses show thoughtful insight and deeper connections."
    )
    assert by_key["evidence"]["levels"]["2"] == (
        "Provides limited or general evidence from the text. Connections between evidence and answers may be unclear."
    )
    assert by_key["communication"]["levels"]["1"] == (
        "Responses are incomplete or difficult to understand. Frequently uses fragments rather than full sentences."
    )


@pytest.fixture
def llm(monkeypatch):
    state = {
        "review": GOOD_REVIEW, "prompts": [], "transcript": "They settled on the grand river. They stayed.",
        "model_prompts": [], "model_calls": [], "model_reply": MODEL_REPLY,
    }

    async def fake(prompt, images=None, *, model=None, temperature=None):
        usage = {"model": model, "input_tokens": 1, "output_tokens": 1}
        if "handwriting transcriber" in prompt:
            return {"transcript": state["transcript"]}, usage
        if "marking a written answer" in prompt:
            state["prompts"].append(prompt)
            return state["review"], usage
        if "writing a Level 4 model answer" in prompt:
            state["model_prompts"].append(prompt)
            state["model_calls"].append({"model": model, "temperature": temperature})
            return state["model_reply"], usage
        return GOOD_ITEM, usage

    monkeypatch.setattr("app.writing_coach.agents.call_llm_with_usage", fake)
    return state


async def run_review(client, h, sid, llm, kind="draft"):
    r = await client.post(f"/api/v1/wc/sessions/{sid}/read", headers=h, json={"kind": kind, "images": [IMG]})
    sub = r.json()["submission_id"]
    await client.put(f"/api/v1/wc/submissions/{sub}/transcript", headers=h, json={"text": llm["transcript"]})
    rv = await client.post(f"/api/v1/wc/submissions/{sub}/review", headers=h)
    assert rv.status_code == 200, rv.text
    return rv.json()


async def test_prompt_has_the_rubric_and_the_history_evidence_rule(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], llm)
    prompt = llm["prompts"][0]
    assert "Demonstrates thorough understanding of the text." in prompt
    assert "quotes from the source or specific facts (names, dates, numbers)" in prompt
    assert "levelAdjustment" not in prompt


async def test_language_marks_evidence_from_the_text(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h, "language")
    await run_review(client, h, s["id"], llm)
    assert "quotes from the source or specific facts (names, dates, numbers)" not in llm["prompts"][0]


async def test_review_stores_the_overall_mark_and_the_apps_counts(client, llm):
    llm["review"] = {**GOOD_REVIEW, "criteria": criteria(("3", 74), ("2+", 68), ("2", 65), errors=[ERR_PLACE])}
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    body = await run_review(client, h, s["id"], llm)
    assert (body["level"], body["percent"]) == ("2+", 69)
    assert body["overall"] == {"level": "2+", "percent": 69, "capApplied": False}
    assert body["criteria"]["communication"]["sentenceCount"] == 2
    assert "scores" not in body and "conventions" not in body


async def test_reminder_no_longer_carries_a_rubric_override(client, llm):
    h, _ = await make_profile(client)
    rem = (await client.get("/api/v1/wc/reminder", headers=h)).json()
    assert "rubric_override" not in rem


async def test_student_overview_ranks_the_three_criteria(client, llm):
    llm["review"] = {**GOOD_REVIEW, "criteria": criteria(("3", 74), ("2+", 68), ("2", 65))}
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], llm)
    ov = (await client.get("/api/v1/wc/overview", headers=h)).json()
    assert ov["criteria"] == [
        {"key": "communication", "average": 65},
        {"key": "evidence", "average": 68},
        {"key": "understanding", "average": 74},
    ]
    assert ov["average_sentence_count"] == 2
    assert "steps" not in ov and "conventions_average" not in ov and "average_word_count" not in ov


async def test_parent_trend_shows_each_criterion_for_drafts_only(client, llm, admin_token):
    llm["review"] = {**GOOD_REVIEW, "criteria": criteria(("3", 74), ("2+", 68), ("2", 65), errors=[ERR_PLACE])}
    h, pid = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], llm)
    # a much better rewrite must not change the draft trend
    llm["review"] = {**GOOD_REVIEW, "criteria": criteria(("4", 90), ("4", 90), ("4", 90))}
    llm["transcript"] = "They settled on the Grand River. They stayed."
    await run_review(client, h, s["id"], llm, kind="rewrite")

    admin = {"X-Admin-Token": ADMIN_TOKEN}
    assert (await client.get(f"/api/v1/wc/parent/progress?profile_id={pid}")).status_code == 404
    body = (await client.get(f"/api/v1/wc/parent/progress?profile_id={pid}", headers=admin)).json()
    row = body["trend"][0]
    assert row["understanding"] == {"level": "3", "percent": 74}
    assert row["evidence"] == {"level": "2+", "percent": 68}
    assert row["communication"] == {"level": "2", "percent": 65}
    assert row["overall"] == {"level": "2+", "percent": 69}
    assert (row["errors_flagged"], row["errors_fixed"]) == (1, 1)
    assert body["averages"] == {"understanding": 74, "evidence": 68, "communication": 65, "overall": 69}
    assert body["lowest"] == "communication"
    assert body["top_errors"] == [{"category": "capital_place", "label": "capitals on place names", "count": 1}]
    # the old conventions route is gone
    assert (await client.get(f"/api/v1/wc/parent/conventions?profile_id={pid}", headers=admin)).status_code == 404


async def test_settings_no_longer_accept_a_rubric(client, llm, admin_token):
    _, pid = await make_profile(client)
    r = await client.put(f"/api/v1/wc/parent/settings?profile_id={pid}", headers={"X-Admin-Token": ADMIN_TOKEN},
                         json={"history_strand": "B", "focus_week": 3, "rubric_override": "ignored"})
    assert r.json() == {"history_strand": "B", "focus_week": 3}


# ---- the model answer, written when he asks for it

def model_url(sid):
    return f"/api/v1/wc/sessions/{sid}/model-answer"


async def test_a_new_session_has_no_model_answer_until_he_asks(client, llm, monkeypatch):
    monkeypatch.setenv("WC_REVIEWER_MODEL", "rev/model")
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    assert llm["model_calls"] == []
    assert (await client.post(model_url(s["id"]), headers=h)).status_code == 403  # locked until the draft is reviewed
    await run_review(client, h, s["id"], llm)
    assert llm["model_calls"] == []  # reviewing does not write one either

    r = await client.post(model_url(s["id"]), headers=h)
    assert r.status_code == 200
    assert r.json()["model_answer"].startswith("This is one complete sentence")
    assert r.json()["extend_hints"] == GOOD_ITEM["extend_hints"]
    assert llm["model_calls"][0]["model"] == "rev/model"


async def test_the_model_answer_is_written_once_and_saved(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], llm)
    first = (await client.post(model_url(s["id"]), headers=h)).json()
    second = (await client.post(model_url(s["id"]), headers=h)).json()
    assert first == second and len(llm["model_calls"]) == 1
    # saved for My results too
    rep = (await client.get(f"/api/v1/wc/sessions/{s['id']}/report", headers=h)).json()
    assert rep["session"]["item"]["model_answer"] == first["model_answer"]


async def test_older_sessions_keep_their_saved_model_answer(client, llm):
    from app.db import get_session
    from app.main import app
    from app.models.tables import WcSession

    h, _ = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], llm)
    async for db in app.dependency_overrides[get_session]():
        row = await db.scalar(select(WcSession))
        row.item = {**row.item, "model_answer": "An older saved answer."}
        await db.commit()
    r = await client.post(model_url(s["id"]), headers=h)
    assert r.json()["model_answer"] == "An older saved answer." and llm["model_calls"] == []


async def test_a_failed_model_answer_can_be_tried_again(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], llm)
    llm["model_reply"] = {"model_answer": "Too short."}
    assert (await client.post(model_url(s["id"]), headers=h)).status_code == 503
    llm["model_reply"] = MODEL_REPLY
    assert (await client.post(model_url(s["id"]), headers=h)).status_code == 200


async def test_history_model_answer_uses_only_the_stored_facts(client, llm):
    from app.writing_coach.agents import history_topics

    h, _ = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], llm)
    await client.post(model_url(s["id"]), headers=h)
    prompt = llm["model_prompts"][0]
    topic = next(t for t in history_topics("both") if t["id"] == s["topic_id"])
    assert all(fact in prompt for fact in topic["key_facts"])
    assert "ONLY facts you may state" in prompt
    assert "Demonstrates thorough understanding of the text." in prompt  # the rubric's Level 4 wording
    assert "double quotation marks" in prompt


async def test_language_model_answer_and_review_see_the_practice_text(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h, "language")
    await run_review(client, h, s["id"], llm)
    await client.post(model_url(s["id"]), headers=h)
    assert GOOD_ITEM["background"] in llm["model_prompts"][0]
    assert GOOD_ITEM["background"] in llm["prompts"][0]


async def test_school_model_answer_uses_placeholders_not_invented_facts(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h, "school", school_question="Why did the Loyalists leave?")
    await run_review(client, h, s["id"], llm)
    await client.post(model_url(s["id"]), headers=h)
    prompt = llm["model_prompts"][0]
    assert "Why did the Loyalists leave?" in prompt and "placeholders" in prompt and "Never invent facts" in prompt


# ---- older reviews stay readable

async def _make_stored_review_old():
    from app.db import get_session
    from app.main import app
    from app.models.tables import WcReview

    async for db in app.dependency_overrides[get_session]():
        rev = await db.scalar(select(WcReview))
        rev.review = json.loads(json.dumps(OLD_REVIEW))
        await db.commit()


async def test_older_reviews_still_count_in_every_summary(client, llm, admin_token):
    h, pid = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], llm)
    await _make_stored_review_old()

    rep = (await client.get(f"/api/v1/wc/sessions/{s['id']}/report", headers=h)).json()
    assert rep["submissions"]["draft"]["review"]["scores"]["restate"]["score"] == 2

    ov = (await client.get("/api/v1/wc/overview", headers=h)).json()
    assert ov["session_count"] == 1 and ov["criteria"] == []
    assert ov["top_errors"][0]["category"] == "capital_place"

    body = (await client.get(f"/api/v1/wc/parent/progress?profile_id={pid}",
                             headers={"X-Admin-Token": ADMIN_TOKEN})).json()
    assert body["trend"] == [] and body["lowest"] is None
    assert body["top_errors"][0]["category"] == "capital_place"

    llm["transcript"] = "They settled on the Grand River. They stayed."
    await run_review(client, h, s["id"], llm, kind="rewrite")
    rep = (await client.get(f"/api/v1/wc/sessions/{s['id']}/report", headers=h)).json()
    assert rep["submissions"]["rewrite"]["fixed_errors"][0]["status"] == "fixed"
