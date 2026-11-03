import pytest

from app.writing_coach.schemas import Review
from app.writing_coach.transcript import (
    CapitalChangeError,
    check_correction,
    check_fixed_errors,
    word_diff,
)

from .samples import GOOD_ITEM, GOOD_REVIEW, criteria
from .test_api_flow import IMG, make_profile, start_session

ERR_PLACE = {"original": "grand river", "correction": "Grand River", "type": "capitalization",
             "category": "capital_place", "rule": "Names of places need capitals"}
ERR_NATION = {"original": "haudenosaunee", "correction": "Haudenosaunee", "type": "capitalization",
              "category": "capital_group", "rule": "Names of nations need capitals"}


def review_with(errors=()):
    return Review.model_validate({**GOOD_REVIEW, "criteria": criteria(errors=errors)})


# ---- which errors count

def test_errors_are_capped_at_ten_and_unknown_categories_become_other():
    many = [{**ERR_PLACE, "original": f"place{i}", "category": "nonsense"} for i in range(14)]
    r = review_with(errors=many)
    assert len(r.criteria.communication.errors) == 10
    assert r.criteria.communication.errors[0].category == "other"


def test_errors_not_in_the_transcript_or_marked_unclear_are_dropped():
    r = review_with(errors=[ERR_PLACE, ERR_NATION, {**ERR_PLACE, "original": "never written"}])
    r.check_against_transcript("They settled on the grand river. The haudenosaunee[?] came too.")
    assert [e.original for e in r.criteria.communication.errors] == ["grand river"]


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


async def test_rewrite_checks_the_draft_errors(client, llm):
    llm["review"] = {**GOOD_REVIEW, "criteria": criteria(errors=[ERR_PLACE, ERR_NATION])}
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    draft = await run_review(client, h, s["id"], "draft", llm["transcript"])
    assert [e["original"] for e in draft["criteria"]["communication"]["errors"]] == ["grand river", "haudenosaunee"]

    llm["review"] = {**GOOD_REVIEW}
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
    llm["review"] = {**GOOD_REVIEW, "criteria": criteria(errors=[ERR_PLACE, ERR_NATION])}
    h, _ = await make_profile(client)
    for _ in range(2):
        s = await start_session(client, h)
        await run_review(client, h, s["id"], "draft", llm["transcript"])
        llm["review"] = {**GOOD_REVIEW, "criteria": criteria(errors=[ERR_PLACE])}  # nation capitals fixed from now on
    rem = (await client.get("/api/v1/wc/reminder", headers=h)).json()
    assert rem["top_errors"] == [{"category": "capital_place", "label": "capitals on place names", "count": 2}]
    ov = (await client.get("/api/v1/wc/overview", headers=h)).json()
    assert ov["top_errors"][0]["count"] == 2
