"""Admin API: token gate (always a generic 404 on failure) and the four read views."""

import pytest

from tests.integration.test_attempts_api import adhoc_attempt, curriculum_attempt

GHOST = "00000000-0000-4000-8000-000000000000"


@pytest.fixture
async def profile_id(client):
    resp = await client.post(
        "/api/v1/profiles",
        json={"email": "kid@example.com", "display_name": "Sam", "grade": "7"},
    )
    return resp.json()["id"]


def admin_paths(pid):
    return [
        "/api/v1/admin/profiles",
        f"/api/v1/admin/profiles/{pid}/attempts",
        f"/api/v1/admin/profiles/{pid}/progress/daily",
        f"/api/v1/admin/profiles/{pid}/lesson-progress",
    ]


async def test_missing_or_wrong_token_is_404(client, admin_token, profile_id):
    for path in admin_paths(profile_id):
        assert (await client.get(path)).status_code == 404  # missing
        assert (await client.get(path, headers={"X-Admin-Token": "wrong"})).status_code == 404
        assert (await client.get(path, headers={"X-Admin-Token": ""})).status_code == 404
        assert (await client.get(path, headers={"X-Admin-Token": admin_token})).status_code == 200


async def test_failed_auth_is_indistinguishable_from_unknown_route(client, admin_token):
    denied = await client.get("/api/v1/admin/profiles")
    missing = await client.get("/api/v1/admin/does-not-exist")
    assert denied.status_code == missing.status_code == 404
    assert denied.json() == missing.json()


async def test_bad_token_beats_input_validation(client, admin_token):
    # An invalid UUID must not leak a 422 to someone without the token.
    resp = await client.get("/api/v1/admin/profiles/not-a-uuid/attempts")
    assert resp.status_code == 404


async def test_unconfigured_server_token_denies_everyone(client, monkeypatch, profile_id):
    from types import SimpleNamespace

    monkeypatch.setattr("app.api.deps.get_settings", lambda: SimpleNamespace(admin_token=None))
    for token in (None, "", "anything"):
        headers = {"X-Admin-Token": token} if token is not None else {}
        assert (await client.get("/api/v1/admin/profiles", headers=headers)).status_code == 404


async def test_admin_not_in_openapi(client):
    schema = (await client.get("/openapi.json")).json()
    assert not any("/admin" in p for p in schema["paths"])


async def test_profile_list_with_activity(client, admin_token, profile_id):
    h = {"X-Admin-Token": admin_token}
    before = (await client.get("/api/v1/admin/profiles", headers=h)).json()
    assert before[0]["attempt_count"] == 0 and before[0]["last_attempt_at"] is None

    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 20))
    await client.post("/api/v1/attempts", json=adhoc_attempt(profile_id))
    after = (await client.get("/api/v1/admin/profiles", headers=h)).json()
    assert after[0]["attempt_count"] == 2
    assert after[0]["last_attempt_at"] is not None
    assert after[0]["email"] == "kid@example.com"


async def test_attempt_history_and_detail(client, admin_token, profile_id):
    h = {"X-Admin-Token": admin_token}
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 20))
    await client.post("/api/v1/attempts", json=adhoc_attempt(profile_id, 18, 20))

    attempts = (await client.get(f"/api/v1/admin/profiles/{profile_id}/attempts", headers=h)).json()
    assert [a["mode"] for a in attempts] == ["adhoc", "curriculum"]  # newest first
    assert attempts[0]["score_pct"] == 90.0 and attempts[0]["topic_id"] == "algebra"
    assert attempts[1]["lesson_id"] == "10.3" and attempts[1]["created_at"]
    assert "questions_snapshot" not in attempts[0]

    detail = await client.get(
        f"/api/v1/admin/profiles/{profile_id}/attempts/{attempts[0]['id']}", headers=h
    )
    assert detail.status_code == 200
    assert detail.json()["questions_snapshot"][0]["text"] == "x + 1 = 3"
    assert detail.json()["evaluation_snapshot"]

    wrong_profile = await client.get(
        f"/api/v1/admin/profiles/{GHOST}/attempts/{attempts[0]['id']}", headers=h
    )
    assert wrong_profile.status_code == 404


async def test_daily_progress_groups_by_day(client, admin_token, profile_id):
    h = {"X-Admin-Token": admin_token}
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 20))  # 80
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 24))  # 96
    await client.post("/api/v1/attempts", json=adhoc_attempt(profile_id, 10, 20))  # 50

    days = (await client.get(f"/api/v1/admin/profiles/{profile_id}/progress/daily", headers=h)).json()
    assert len(days) == 1  # all three attempts happened today
    day = days[0]
    assert day["attempt_count"] == 3
    assert day["curriculum_attempts"] == 2 and day["adhoc_attempts"] == 1
    assert day["best_score_pct"] == 96.0
    assert day["avg_score_pct"] == 75.33


async def test_lesson_progress_covers_every_lesson(client, admin_token, profile_id):
    h = {"X-Admin-Token": admin_token}
    await client.post("/api/v1/attempts", json=curriculum_attempt(profile_id, 24, lesson_id="2.1"))
    rows = (await client.get(f"/api/v1/admin/profiles/{profile_id}/lesson-progress", headers=h)).json()
    assert len(rows) == 46
    by_id = {r["lesson_id"]: r for r in rows}
    assert by_id["2.1"]["completed"] is True and by_id["2.1"]["attempts_count"] == 1
    assert by_id["2.1"]["last_attempt_at"] is not None
    assert by_id["10.6"] == {**by_id["10.6"], "completed": False, "attempts_count": 0, "best_score_pct": 0.0}


async def test_unknown_profile_is_404(client, admin_token):
    h = {"X-Admin-Token": admin_token}
    for suffix in ("attempts", "progress/daily", "lesson-progress"):
        assert (await client.get(f"/api/v1/admin/profiles/{GHOST}/{suffix}", headers=h)).status_code == 404
