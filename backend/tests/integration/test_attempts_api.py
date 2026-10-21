"""POST /attempts, the lesson_progress upsert, and GET /profiles/{id}/lesson-status."""

import pytest


@pytest.fixture
async def profile_id(client):
    resp = await client.post(
        "/api/v1/profiles",
        json={"email": "kid@example.com", "display_name": "Sam", "grade": "7"},
    )
    return resp.json()["id"]


def curriculum_attempt(profile_id, score, lesson_id="10.3", max_score=25):
    return {
        "profile_id": profile_id,
        "mode": "curriculum",
        "lesson_id": lesson_id,
        "questions": [{"id": "q1", "text": "2 + 2"}],
        "evaluation": [{"question_id": "q1", "marks": 1}],
        "score": score,
        "max_score": max_score,
    }


def adhoc_attempt(profile_id, score=18, max_score=20):
    return {
        "profile_id": profile_id,
        "mode": "adhoc",
        "topic_id": "algebra",
        "questions": [{"id": "q1", "text": "x + 1 = 3"}],
        "evaluation": [{"question_id": "q1", "marks": 1}],
        "score": score,
        "max_score": max_score,
    }


async def status(client, profile_id):
    resp = await client.get(f"/api/v1/profiles/{profile_id}/lesson-status")
    assert resp.status_code == 200
    return {row["lesson_id"]: row for row in resp.json()}


async def test_first_curriculum_attempt_creates_progress(client, profile_id):
    resp = await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 20))
    assert resp.status_code == 201
    body = resp.json()
    assert body["score_pct"] == 80.0
    assert body["mastered"] is False
    assert body["lesson"] == {"lesson_id": "10.3", "completed": False, "best_score_pct": 80.0}
    assert (await status(client, profile_id))["10.3"]["best_score_pct"] == 80.0


@pytest.mark.parametrize(
    "score, max_score, mastered",
    [(24, 25, True), (23, 25, False), (19, 20, True), (18, 20, False), (25, 25, True)],
)
async def test_mastery_threshold_edges(client, profile_id, score, max_score, mastered):
    resp = await client.post(
        "/api/v1/attempts", json=curriculum_attempt(profile_id, score, max_score=max_score)
    )
    body = resp.json()
    assert body["mastered"] is mastered
    assert body["lesson"]["completed"] is mastered


async def test_best_score_never_regresses_and_mastery_is_sticky(client, profile_id):
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 20))  # 80%
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 24))  # 96%
    worse = await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 10))  # 40%
    body = worse.json()
    assert body["score_pct"] == 40.0
    assert body["mastered"] is False  # this attempt alone was not mastery...
    assert body["lesson"] == {"lesson_id": "10.3", "completed": True, "best_score_pct": 96.0}
    assert (await status(client, profile_id))["10.3"]["completed"] is True


async def test_adhoc_attempt_does_not_touch_lesson_progress(client, profile_id):
    resp = await client.post("/api/v1/attempts", json=adhoc_attempt(profile_id))
    assert resp.status_code == 201
    assert resp.json()["lesson"] is None
    assert resp.json()["mastered"] is False
    assert await status(client, profile_id) == {}


async def test_lesson_status_has_no_timestamps(client, profile_id):
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 24))
    rows = (await client.get(f"/api/v1/profiles/{profile_id}/lesson-status")).json()
    assert set(rows[0]) == {"lesson_id", "completed", "best_score_pct"}


async def test_lessons_are_tracked_independently(client, profile_id):
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 25, lesson_id="2.1"))
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 10, lesson_id="2.2"))
    st = await status(client, profile_id)
    assert st["2.1"]["completed"] is True
    assert st["2.2"]["completed"] is False


async def test_attempt_validation(client, profile_id):
    bad_bodies = [
        {**curriculum_attempt(profile_id, 20), "lesson_id": None},  # curriculum needs lesson
        {**curriculum_attempt(profile_id, 20), "topic_id": "algebra"},  # ...and no topic
        {**adhoc_attempt(profile_id), "topic_id": None},  # adhoc needs topic
        {**adhoc_attempt(profile_id), "lesson_id": "10.3"},  # ...and no lesson
        curriculum_attempt(profile_id, 30, max_score=25),  # score > max
        curriculum_attempt(profile_id, -1),
        curriculum_attempt(profile_id, 0, max_score=0),
        {**curriculum_attempt(profile_id, 20), "questions": []},
    ]
    for body in bad_bodies:
        assert (await client.post("/api/v1/attempts", json=body)).status_code == 422, body


async def test_unknown_lesson_and_profile(client, profile_id):
    unknown_lesson = curriculum_attempt(profile_id, 20, lesson_id="99.9")
    assert (await client.post("/api/v1/attempts", json=unknown_lesson)).status_code == 422

    ghost = "00000000-0000-4000-8000-000000000000"
    assert (await client.post("/api/v1/attempts", json=curriculum_attempt(ghost, 20))).status_code == 404
    assert (await client.get(f"/api/v1/profiles/{ghost}/lesson-status")).status_code == 404
