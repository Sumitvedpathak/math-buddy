import pytest

from app.integrations.langchainrouter import LLMServiceError
from tests.conftest import ADMIN_TOKEN

from .samples import GOOD_ITEM, GOOD_REVIEW

TRANSCRIPT = "The Acadians were deprted in 1755. Governor Lawrence ordered it. [illegible] lost farms."
IMG = "data:image/jpeg;base64,/9j/4AAQSkZJRg=="


@pytest.fixture
def llm(monkeypatch):
    """Stand-in for the shared LLM client, answering by which agent's prompt it receives."""
    calls = []

    async def fake(prompt, images=None, *, model=None, temperature=None):
        calls.append({"prompt": prompt, "images": images, "model": model, "temperature": temperature})
        usage = {"model": model, "input_tokens": 10, "output_tokens": 5}
        if "handwriting transcriber" in prompt:
            return {"transcript": TRANSCRIPT}, usage
        if "marking a written answer" in prompt:
            return GOOD_REVIEW, usage
        return GOOD_ITEM, usage

    monkeypatch.setattr("app.writing_coach.agents.call_llm_with_usage", fake)
    return calls


async def make_profile(client, grade="7", email="kid@example.com"):
    r = await client.post("/api/v1/profiles", json={"email": email, "display_name": "Kid", "grade": grade})
    assert r.status_code == 201
    return {"X-Profile-Id": r.json()["id"]}, r.json()["id"]


async def start_session(client, h, subject="history", **extra):
    r = await client.post("/api/v1/wc/sessions", json={"subject": subject, **extra}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


async def test_requires_a_grade_7_profile(client):
    assert (await client.get("/api/v1/wc/reminder")).status_code == 404
    h6, _ = await make_profile(client, grade="6", email="six@example.com")
    assert (await client.get("/api/v1/wc/reminder", headers=h6)).status_code == 403


async def test_reminder_defaults(client):
    h, _ = await make_profile(client)
    body = (await client.get("/api/v1/wc/reminder", headers=h)).json()
    assert body["focus_week"] == 1 and body["history_strand"] == "A"
    assert body["suggested_subject"] in {"history", "language", "school"}


async def test_session_hides_model_answer_and_uses_agent_settings(client, llm, monkeypatch):
    monkeypatch.setenv("WC_GENERATOR_MODEL", "gen/model")
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    assert "model_answer" not in s["item"]
    assert s["topic_id"].startswith("a-")
    assert llm[0]["model"] == "gen/model" and llm[0]["temperature"] == 0.7
    # the Generator is shown only the stored facts for the chosen topic
    assert "FACTS YOU MAY USE" in llm[0]["prompt"]


async def test_school_question_needs_text_and_is_kept_verbatim(client, llm):
    h, _ = await make_profile(client)
    r = await client.post("/api/v1/wc/sessions", json={"subject": "school"}, headers=h)
    assert r.status_code == 422
    s = await start_session(client, h, "school", school_question="Why did the Loyalists leave?")
    assert s["item"]["question"] == "Why did the Loyalists leave?"


async def test_full_session_flow(client, llm, monkeypatch):
    monkeypatch.setenv("WC_READER_MODEL", "read/model")
    monkeypatch.setenv("WC_REVIEWER_MODEL", "rev/model")
    h, pid = await make_profile(client)
    s = await start_session(client, h)
    sid = s["id"]

    # decode check
    d = (await client.post(f"/api/v1/wc/sessions/{sid}/decode", headers=h, json={
        "command_words": ["Describe"], "parts": 1, "thinking_focus": "Cause and Consequence"})).json()
    assert d["command_words_correct"] is False and d["parts_correct"] and d["focus_correct"]
    assert d["missed_command_words"] == ["explain"]

    # Reader: photos in, verbatim transcript out; photos are not stored anywhere
    r = await client.post(f"/api/v1/wc/sessions/{sid}/read", headers=h, json={"kind": "draft", "images": [IMG]})
    assert r.status_code == 200 and r.json()["transcript"] == TRANSCRIPT
    reader_call = [c for c in llm if "handwriting transcriber" in c["prompt"]][0]
    assert reader_call["images"] == [IMG] and reader_call["temperature"] == 0 and reader_call["model"] == "read/model"
    assert "Do NOT correct spelling" in reader_call["prompt"]
    sub_id = r.json()["submission_id"]

    # review before confirming is refused; model answer is locked
    assert (await client.post(f"/api/v1/wc/submissions/{sub_id}/review", headers=h)).status_code == 409
    assert (await client.get(f"/api/v1/wc/sessions/{sid}/model-answer", headers=h)).status_code == 403

    # he may fix a misread word but not add content
    big = TRANSCRIPT + " and a lot of brand new sentences he did not write on paper at all"
    assert (await client.put(f"/api/v1/wc/submissions/{sub_id}/transcript", headers=h, json={"text": big})).status_code == 422
    fixed = TRANSCRIPT.replace("deprted", "deported")
    c = await client.put(f"/api/v1/wc/submissions/{sub_id}/transcript", headers=h, json={"text": fixed})
    assert c.status_code == 200
    assert c.json()["diff"] == [{"op": "replace", "before": "deprted", "after": "deported"}]

    # Reviewer sees only the confirmed text, at low temperature
    rv = await client.post(f"/api/v1/wc/submissions/{sub_id}/review", headers=h)
    assert rv.status_code == 200 and rv.json()["level"] == "3-"
    review_call = [c for c in llm if "marking a written answer" in c["prompt"]][0]
    assert "deported in 1755" in review_call["prompt"] and "deprted" not in review_call["prompt"]
    assert review_call["images"] is None and review_call["temperature"] == 0.1
    assert review_call["model"] == "rev/model"

    # model answer unlocks after the draft review; editing a reviewed answer is refused
    assert (await client.get(f"/api/v1/wc/sessions/{sid}/model-answer", headers=h)).status_code == 200
    assert (await client.put(f"/api/v1/wc/submissions/{sub_id}/transcript", headers=h, json={"text": fixed})).status_code == 409

    # rewrite, then log the goal
    rw = await client.post(f"/api/v1/wc/sessions/{sid}/read", headers=h, json={"kind": "rewrite", "images": [IMG]})
    rw_id = rw.json()["submission_id"]
    await client.put(f"/api/v1/wc/submissions/{rw_id}/transcript", headers=h, json={"text": fixed})
    assert (await client.post(f"/api/v1/wc/submissions/{rw_id}/review", headers=h)).status_code == 200
    fin = await client.patch(f"/api/v1/wc/sessions/{sid}", headers=h, json={"next_time": "Use two dates", "model_move": "It links to today"})
    assert fin.status_code == 200 and fin.json()["status"] == "done"

    # his report and overview
    rep = (await client.get(f"/api/v1/wc/sessions/{sid}/report", headers=h)).json()
    assert rep["submissions"]["draft"]["diff"] and rep["submissions"]["rewrite"]["review"]["level"] == "3-"
    assert "model_answer" in rep["session"]["item"]
    listing = (await client.get("/api/v1/wc/sessions", headers=h)).json()
    assert listing[0]["draft"]["level"] == "3-" and listing[0]["rewrite"]["percent"] == 72
    ov = (await client.get("/api/v1/wc/overview", headers=h)).json()
    assert ov["session_count"] == 1 and ov["steps"][0]["step"] == "extend"
    assert ov["command_words_missed"] == [["explain", 1]]

    # next session's reminder carries his last goal
    assert (await client.get("/api/v1/wc/reminder", headers=h)).json()["last_next_time"] == "Use two dates"


async def test_rewrite_needs_a_reviewed_draft(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    r = await client.post(f"/api/v1/wc/sessions/{s['id']}/read", headers=h, json={"kind": "rewrite", "images": [IMG]})
    assert r.status_code == 409


async def test_sessions_are_private_to_their_profile(client, llm):
    h1, _ = await make_profile(client)
    h2, _ = await make_profile(client, email="other@example.com")
    s = await start_session(client, h1)
    assert (await client.get(f"/api/v1/wc/sessions/{s['id']}", headers=h2)).status_code == 404


async def test_image_validation(client, llm):
    h, _ = await make_profile(client)
    s = await start_session(client, h)
    r = await client.post(f"/api/v1/wc/sessions/{s['id']}/read", headers=h, json={"kind": "draft", "images": ["not-an-image"]})
    assert r.status_code == 422


async def test_llm_failure_is_a_503_not_a_500(client, monkeypatch):
    async def boom(*a, **k):
        raise LLMServiceError("The AI helper is busy right now. Please try again in a moment.")

    monkeypatch.setattr("app.writing_coach.agents.call_llm_with_usage", boom)
    h, _ = await make_profile(client)
    r = await client.post("/api/v1/wc/sessions", json={"subject": "history"}, headers=h)
    assert r.status_code == 503 and "busy" in r.json()["detail"]


async def test_invalid_generator_output_retries_once_then_503(client, monkeypatch):
    calls = []

    async def bad(prompt, images=None, *, model=None, temperature=None):
        calls.append(prompt)
        return {"question": "too short"}, {"model": model, "input_tokens": 1, "output_tokens": 1}

    monkeypatch.setattr("app.writing_coach.agents.call_llm_with_usage", bad)
    h, _ = await make_profile(client)
    r = await client.post("/api/v1/wc/sessions", json={"subject": "language"}, headers=h)
    assert r.status_code == 503 and len(calls) == 2
    assert "previous reply was not valid" in calls[1]


async def test_parent_routes_need_the_admin_token_and_show_levels_only(client, llm, admin_token):
    h, pid = await make_profile(client)
    s = await start_session(client, h)
    r = await client.post(f"/api/v1/wc/sessions/{s['id']}/read", headers=h, json={"kind": "draft", "images": [IMG]})
    sub_id = r.json()["submission_id"]
    await client.put(f"/api/v1/wc/submissions/{sub_id}/transcript", headers=h, json={"text": TRANSCRIPT})
    await client.post(f"/api/v1/wc/submissions/{sub_id}/review", headers=h)

    assert (await client.get(f"/api/v1/wc/parent/sessions?profile_id={pid}")).status_code == 404
    rows = (await client.get(f"/api/v1/wc/parent/sessions?profile_id={pid}", headers={"X-Admin-Token": ADMIN_TOKEN})).json()
    assert rows[0]["draft"]["level"] == "3-" and rows[0]["question"]
    assert set(rows[0]) == {"id", "created_at", "subject", "question", "status", "draft", "rewrite"}


async def test_parent_settings_change_what_the_student_gets(client, llm, admin_token):
    h, pid = await make_profile(client)
    admin = {"X-Admin-Token": ADMIN_TOKEN}
    r = await client.put(f"/api/v1/wc/parent/settings?profile_id={pid}", headers=admin,
                         json={"history_strand": "B", "focus_week": 3, "rubric_override": "Use two quotes."})
    assert r.json() == {"history_strand": "B", "rubric_override": "Use two quotes.", "focus_week": 3}
    rem = (await client.get("/api/v1/wc/reminder", headers=h)).json()
    assert rem["focus_week"] == 3 and rem["rubric_override"] == "Use two quotes."
    s = await start_session(client, h)
    assert s["topic_id"].startswith("b-") and s["focus_week"] == 3
    # the teacher's rubric reaches the Reviewer prompt
    sub = (await client.post(f"/api/v1/wc/sessions/{s['id']}/read", headers=h, json={"kind": "draft", "images": [IMG]})).json()
    await client.put(f"/api/v1/wc/submissions/{sub['submission_id']}/transcript", headers=h, json={"text": TRANSCRIPT})
    await client.post(f"/api/v1/wc/submissions/{sub['submission_id']}/review", headers=h)
    assert any("Use two quotes." in c["prompt"] for c in llm if "marking a written answer" in c["prompt"])


async def test_topics_rotate_instead_of_repeating(client, llm):
    h, _ = await make_profile(client)
    topics = [(await start_session(client, h))["topic_id"] for _ in range(4)]
    assert len(set(topics)) == 4
