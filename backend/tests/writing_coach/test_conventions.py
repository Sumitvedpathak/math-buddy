import pytest
from pydantic import ValidationError

from app.writing_coach.levels import step_level
from app.writing_coach.schemas import Review
from app.writing_coach.transcript import (
    CapitalChangeError,
    check_correction,
    check_fixed_errors,
    word_diff,
)
from tests.conftest import ADMIN_TOKEN

from .samples import GOOD_ITEM, GOOD_REVIEW
from .test_api_flow import IMG, make_profile, start_session

ERR_PLACE = {"original": "grand river", "correction": "Grand River", "type": "capitalization",
             "category": "capital_place", "rule": "Names of places need capitals"}
ERR_NATION = {"original": "haudenosaunee", "correction": "Haudenosaunee", "type": "capitalization",
              "category": "capital_group", "rule": "Names of nations need capitals"}


def review_with(level="3", percent=75, score=2, errors=()):
    return Review.model_validate({
        **GOOD_REVIEW, "level": level, "percent": percent,
        "conventions": {"score": score, "errors": list(errors), "levelAdjustment": 99},
    })


# ---- level adjustment

@pytest.mark.parametrize("score,expected", [(2, "3"), (1, "3-"), (0, "2+")])
def test_conventions_score_lowers_the_level_by_one_or_two_steps(score, expected):
    r = review_with(score=score)
    r.apply_conventions()
    assert r.level == expected
    assert (r.contentLevel, r.contentPercent) == ("3", 75)
    assert r.conventions.levelAdjustment == {2: 0, 1: -1, 0: -2}[score]  # follows the score, not the model


def test_adjustment_never_goes_past_two_steps_or_below_the_floor():
    low = review_with(level="1-", percent=51, score=0)
    low.apply_conventions()
    assert low.level == "1-"
    top = review_with(level="4+", percent=98, score=0)
    top.apply_conventions()
    assert top.level == "4-"  # 4+ -> 4 -> 4-: two steps at most


def test_percent_moves_into_the_lowered_band():
    r = review_with(level="3", percent=75, score=1)
    r.apply_conventions()
    assert r.level == "3-" and r.percent == 72


def test_step_level_stops_at_the_ends():
    assert step_level("1-", -2) == "1-" and step_level("4+", 3) == "4+"


def test_score_must_be_0_to_2():
    with pytest.raises(ValidationError):
        review_with(score=3)


# ---- which errors count

def test_errors_are_capped_at_ten_and_unknown_categories_become_other():
    many = [{**ERR_PLACE, "original": f"place{i}", "category": "nonsense"} for i in range(14)]
    r = review_with(score=1, errors=many)
    assert len(r.conventions.errors) == 10
    assert r.conventions.errors[0].category == "other"


def test_errors_not_in_the_transcript_or_marked_unclear_are_dropped():
    r = review_with(score=1, errors=[
        ERR_PLACE, ERR_NATION, {**ERR_PLACE, "original": "never written"},
    ])
    transcript = "They settled on the grand river. The haudenosaunee[?] came too."
    r.drop_unmatched_conventions(transcript)
    assert [e.original for e in r.conventions.errors] == ["grand river"]


# ---- the confirm step

def test_he_cannot_fix_his_own_capitals():
    with pytest.raises(CapitalChangeError):
        check_correction("They lived on the grand river.", "They lived on the Grand river.")


def test_he_may_resolve_words_the_reader_was_unsure_about():
    check_correction("the canada[?] border", "the Canada border")
    check_correction("it was [illegible] there", "it was already there")


def test_a_single_word_that_looks_like_a_spelling_fix_is_flagged_for_the_parent():
    diff = word_diff("Haldiman proclaimed it", "Haldimand proclaimed it")
    assert diff[0]["suspect"] is True
    assert word_diff("a treaty was", "a trade was")[0]["suspect"] is False


# ---- did he fix the draft's errors?

def test_fixed_errors_statuses():
    errors = [ERR_PLACE, ERR_NATION, {**ERR_PLACE, "original": "lost it", "correction": "lost them"}]
    text = "They settled on the Grand River. The haudenosaunee came too."
    got = {e["original"]: e["status"] for e in check_fixed_errors(errors, text)}
    assert got == {"grand river": "fixed", "haudenosaunee": "still_there", "lost it": "rewritten"}


# ---- through the API

@pytest.fixture
def llm(monkeypatch):
    state = {"review": {**GOOD_REVIEW}, "transcript": "They settled on the grand river. The haudenosaunee came too."}

    async def fake(prompt, images=None, *, model=None, temperature=None):
        usage = {"model": model, "input_tokens": 1, "output_tokens": 1}
        if "handwriting transcriber" in prompt:
            return {"transcript": state["transcript"]}, usage
        if "marking a written answer" in prompt:
            return state["review"], usage
        return GOOD_ITEM, usage

    monkeypatch.setattr("app.writing_coach.agents.call_llm_with_usage", fake)
    return state


async def run_review(client, h, sid, kind, text):
    r = await client.post(f"/api/v1/wc/sessions/{sid}/read", headers=h, json={"kind": kind, "images": [IMG]})
    sub = r.json()["submission_id"]
    c = await client.put(f"/api/v1/wc/submissions/{sub}/transcript", headers=h, json={"text": text})
    assert c.status_code == 200, c.text
    rv = await client.post(f"/api/v1/wc/submissions/{sub}/review", headers=h)
    assert rv.status_code == 200, rv.text
    return rv.json()


async def test_review_applies_conventions_and_rewrite_checks_the_draft_errors(client, llm):
    llm["review"] = {**GOOD_REVIEW, "level": "3", "percent": 75,
                     "conventions": {"score": 1, "errors": [ERR_PLACE, ERR_NATION], "levelAdjustment": -1}}
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    draft = await run_review(client, h, s["id"], "draft", llm["transcript"])
    assert draft["level"] == "3-" and draft["contentLevel"] == "3"
    assert [e["original"] for e in draft["conventions"]["errors"]] == ["grand river", "haudenosaunee"]

    llm["review"] = {**GOOD_REVIEW, "level": "3", "percent": 76,
                     "conventions": {"score": 2, "errors": [], "levelAdjustment": 0}}
    # the Reader transcribes the rewritten paper, so the new capitals come from the Reader
    llm["transcript"] = "They settled on the Grand River. The haudenosaunee came too."
    await run_review(client, h, s["id"], "rewrite", llm["transcript"])
    rep = (await client.get(f"/api/v1/wc/sessions/{s['id']}/report", headers=h)).json()
    status = {e["original"]: e["status"] for e in rep["submissions"]["rewrite"]["fixed_errors"]}
    assert status == {"grand river": "fixed", "haudenosaunee": "still_there"}


async def test_capital_only_change_is_refused_at_the_confirm_step(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    r = await client.post(f"/api/v1/wc/sessions/{s['id']}/read", headers=h, json={"kind": "draft", "images": [IMG]})
    c = await client.put(f"/api/v1/wc/submissions/{r.json()['submission_id']}/transcript", headers=h,
                         json={"text": llm["transcript"].replace("grand", "Grand")})
    assert c.status_code == 422 and "capital" in c.json()["detail"]


async def test_reminder_shows_recurring_errors_only(client, llm):
    llm["review"] = {**GOOD_REVIEW, "conventions": {"score": 1, "errors": [ERR_PLACE, ERR_NATION], "levelAdjustment": -1}}
    h, _ = await make_profile(client)
    for _ in range(2):
        s = await start_session(client, h)
        await run_review(client, h, s["id"], "draft", llm["transcript"])
        llm["review"]["conventions"]["errors"] = [ERR_PLACE]  # nation capitals fixed from now on
    rem = (await client.get("/api/v1/wc/reminder", headers=h)).json()
    assert rem["top_errors"] == [{"category": "capital_place", "label": "capitals on place names", "count": 2}]
    ov = (await client.get("/api/v1/wc/overview", headers=h)).json()
    assert ov["conventions_average"] == 1.0
    assert ov["top_errors"][0]["count"] == 2


async def test_parent_sees_conventions_trend_common_errors_and_his_corrections(client, llm, admin_token):
    llm["review"] = {**GOOD_REVIEW, "conventions": {"score": 1, "errors": [ERR_PLACE], "levelAdjustment": -1}}
    h, pid = await make_profile(client)
    s = await start_session(client, h)
    await run_review(client, h, s["id"], "draft", llm["transcript"])
    llm["review"] = {**GOOD_REVIEW, "conventions": {"score": 2, "errors": [], "levelAdjustment": 0}}
    llm["transcript"] = llm["transcript"].replace("grand river", "Grand River")
    await run_review(client, h, s["id"], "rewrite", llm["transcript"])

    admin = {"X-Admin-Token": ADMIN_TOKEN}
    assert (await client.get(f"/api/v1/wc/parent/conventions?profile_id={pid}")).status_code == 404
    body = (await client.get(f"/api/v1/wc/parent/conventions?profile_id={pid}", headers=admin)).json()
    assert body["trend"][0]["draft_score"] == 1 and body["trend"][0]["rewrite_score"] == 2
    assert (body["trend"][0]["errors_flagged"], body["trend"][0]["errors_fixed"]) == (1, 1)
    assert body["top_errors"] == [{"category": "capital_place", "label": "capitals on place names", "count": 1}]
