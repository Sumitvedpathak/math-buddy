"""The old email profile endpoints are gone; the curriculum needs a sign-in."""

import pytest

from tests.kids import CHILD, token_headers

PROFILE = {"email": "kid@example.com", "display_name": "Sam", "grade": "7"}


@pytest.mark.parametrize(
    "method, url, body",
    [
        ("GET", "/api/v1/profiles/lookup?email=kid@example.com", None),
        ("POST", "/api/v1/profiles", PROFILE),
    ],
)
async def test_email_profile_endpoints_are_removed(client, method, url, body):
    resp = await client.request(method, url, json=body, headers=CHILD())
    assert resp.status_code in (404, 405)


async def test_curriculum_needs_a_sign_in(client):
    assert (await client.get("/api/v1/curriculum")).status_code == 401
    assert (await client.get("/api/v1/curriculum", headers=CHILD())).status_code == 200
    parent = token_headers(kind="parent")
    assert (await client.get("/api/v1/curriculum", headers=parent)).status_code == 200


async def test_curriculum_has_all_units_and_lessons(client):
    resp = await client.get("/api/v1/curriculum", headers=CHILD())
    assert resp.status_code == 200
    units = resp.json()["units"]
    assert [u["number"] for u in units] == [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    lesson_ids = [l["id"] for u in units for l in u["lessons"]]
    assert len(lesson_ids) == 58
    assert len(set(lesson_ids)) == 58
    for unit in units:
        for lesson in unit["lessons"]:
            assert lesson["id"].startswith(f"{unit['number']}.")
            assert lesson["title"] and lesson["focus"] and lesson["keywords"]


async def test_every_lesson_has_theory_pages(client):
    units = (await client.get("/api/v1/curriculum", headers=CHILD())).json()["units"]
    counts = {l["id"]: l["theory_pages"] for u in units for l in u["lessons"]}
    assert len(counts) == 58
    assert all(isinstance(n, int) and n >= 1 for n in counts.values())


async def test_curriculum_grade_filter(client):
    grade7 = (await client.get("/api/v1/curriculum", params={"grade": "7"}, headers=CHILD())).json()["units"]
    grade6 = (await client.get("/api/v1/curriculum", params={"grade": "6"}, headers=CHILD())).json()["units"]
    assert len(grade7) == 10
    assert grade6 == []
    assert (await client.get("/api/v1/curriculum", params={"grade": "9"}, headers=CHILD())).status_code == 422
