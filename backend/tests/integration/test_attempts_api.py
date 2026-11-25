"""POST /attempts, the lesson_progress upsert, and GET /me/lesson-status.

The child comes from the access token, never from the request."""

import pytest

from tests.kids import make_kid, token_headers


@pytest.fixture
async def kid(client):
    return await make_kid(client, name="Sam")


def curriculum_attempt(score, lesson_id="10.3", max_score=25):
    return {
        "mode": "curriculum",
        "lesson_id": lesson_id,
        "questions": [{"id": "q1", "text": "2 + 2"}],
        "evaluation": [{"question_id": "q1", "marks": 1}],
        "score": score,
        "max_score": max_score,
    }


def adhoc_attempt(score=18, max_score=20):
    return {
        "mode": "adhoc",
        "topic_id": "algebra",
        "questions": [{"id": "q1", "text": "x + 1 = 3"}],
        "evaluation": [{"question_id": "q1", "marks": 1}],
        "score": score,
        "max_score": max_score,
    }


async def status(client, kid):
    resp = await client.get("/api/v1/me/lesson-status", headers=kid.headers)
    assert resp.status_code == 200
    return {row["lesson_id"]: row for row in resp.json()}


async def save(client, kid, body):
    return await client.post("/api/v1/attempts", json=body, headers=kid.headers)


async def test_first_curriculum_attempt_creates_progress(client, kid):
    resp = await save(client, kid, curriculum_attempt(20))
    assert resp.status_code == 201
    body = resp.json()
    assert body["score_pct"] == 80.0
    assert body["mastered"] is False
    assert body["lesson"] == {"lesson_id": "10.3", "completed": False, "best_score_pct": 80.0}
    assert (await status(client, kid))["10.3"]["best_score_pct"] == 80.0


@pytest.mark.parametrize(
    "score, max_score, mastered",
    [(24, 25, True), (23, 25, False), (19, 20, True), (18, 20, False), (25, 25, True)],
)
async def test_mastery_threshold_edges(client, kid, score, max_score, mastered):
    resp = await save(client, kid, curriculum_attempt(score, max_score=max_score))
    body = resp.json()
    assert body["mastered"] is mastered
    assert body["lesson"]["completed"] is mastered


async def test_best_score_never_regresses_and_mastery_is_sticky(client, kid):
    await save(client, kid, curriculum_attempt(20))  # 80%
    await save(client, kid, curriculum_attempt(24))  # 96%
    worse = await save(client, kid, curriculum_attempt(10))  # 40%
    body = worse.json()
    assert body["score_pct"] == 40.0
    assert body["mastered"] is False  # this attempt alone was not mastery...
    assert body["lesson"] == {"lesson_id": "10.3", "completed": True, "best_score_pct": 96.0}
    assert (await status(client, kid))["10.3"]["completed"] is True


async def test_adhoc_attempt_does_not_touch_lesson_progress(client, kid):
    resp = await save(client, kid, adhoc_attempt())
    assert resp.status_code == 201
    assert resp.json()["lesson"] is None
    assert resp.json()["mastered"] is False
    assert await status(client, kid) == {}


async def test_lesson_status_has_no_timestamps(client, kid):
    await save(client, kid, curriculum_attempt(24))
    rows = (await client.get("/api/v1/me/lesson-status", headers=kid.headers)).json()
    assert set(rows[0]) == {"lesson_id", "completed", "best_score_pct"}


async def test_lessons_are_tracked_independently(client, kid):
    await save(client, kid, curriculum_attempt(25, lesson_id="2.1"))
    await save(client, kid, curriculum_attempt(10, lesson_id="2.2"))
    st = await status(client, kid)
    assert st["2.1"]["completed"] is True
    assert st["2.2"]["completed"] is False


async def test_attempt_validation(client, kid):
    bad_bodies = [
        {**curriculum_attempt(20), "lesson_id": None},  # curriculum needs lesson
        {**curriculum_attempt(20), "topic_id": "algebra"},  # ...and no topic
        {**adhoc_attempt(), "topic_id": None},  # adhoc needs topic
        {**adhoc_attempt(), "lesson_id": "10.3"},  # ...and no lesson
        curriculum_attempt(30, max_score=25),  # score > max
        curriculum_attempt(-1),
        curriculum_attempt(0, max_score=0),
        {**curriculum_attempt(20), "questions": []},
    ]
    for body in bad_bodies:
        assert (await save(client, kid, body)).status_code == 422, body


async def test_unknown_lesson(client, kid):
    assert (await save(client, kid, curriculum_attempt(20, lesson_id="99.9"))).status_code == 422


async def test_attempt_is_saved_for_the_signed_in_child_only(client, kid):
    other = await make_kid(client, name="Mira", parent="parent-b")
    # A profile_id in the body is ignored: the token decides.
    body = {**curriculum_attempt(25), "profile_id": other.id}
    assert (await save(client, kid, body)).status_code == 201
    assert "10.3" in await status(client, kid)
    assert await status(client, other) == {}


async def test_attempts_and_status_need_a_child_token(client, kid):
    body = curriculum_attempt(20)
    assert (await client.post("/api/v1/attempts", json=body)).status_code == 401
    assert (await client.get("/api/v1/me/lesson-status")).status_code == 401
    parent = kid.parent_headers
    assert (await client.post("/api/v1/attempts", json=body, headers=parent)).status_code == 403
    assert (await client.get("/api/v1/me/lesson-status", headers=parent)).status_code == 403


async def test_child_that_no_longer_exists_is_signed_out(client):
    ghost = token_headers()  # a valid token, but no such child in the database
    resp = await client.post("/api/v1/attempts", json=curriculum_attempt(20), headers=ghost)
    assert resp.status_code == 401
    assert (await client.get("/api/v1/me/lesson-status", headers=ghost)).status_code == 401


async def test_old_lesson_status_url_is_gone(client, kid):
    resp = await client.get(f"/api/v1/profiles/{kid.id}/lesson-status", headers=kid.headers)
    assert resp.status_code == 404


async def test_token_must_match_the_childs_parent(client, kid):
    import uuid

    from app.account.tokens import issue_access_token
    from app.core.config import get_settings

    forged = issue_access_token(
        get_settings().jwt_secret,
        sub=uuid.UUID(kid.id),
        kind="child",
        pid=uuid.uuid4(),  # not this child's parent
        sid=uuid.uuid4(),
    )
    headers = {"Authorization": f"Bearer {forged}"}
    assert (await client.get("/api/v1/me/lesson-status", headers=headers)).status_code == 401
