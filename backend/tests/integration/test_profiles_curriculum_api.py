"""Profile lookup/create split and the static curriculum endpoint."""

PROFILE = {"email": "Kid@Example.com ", "display_name": " Sam ", "grade": "7"}


async def test_lookup_never_creates(client):
    resp = await client.get("/api/v1/profiles/lookup", params={"email": "new@example.com"})
    assert resp.status_code == 200
    assert resp.json() == {"exists": False, "profile": None}

    # A second lookup still finds nothing: lookup had no side effects.
    resp = await client.get("/api/v1/profiles/lookup", params={"email": "new@example.com"})
    assert resp.json()["exists"] is False


async def test_create_then_lookup_normalizes_email(client):
    created = await client.post("/api/v1/profiles", json=PROFILE)
    assert created.status_code == 201
    body = created.json()
    assert body["email"] == "kid@example.com"
    assert body["display_name"] == "Sam"
    assert body["grade"] == "7"

    found = await client.get("/api/v1/profiles/lookup", params={"email": "KID@example.com"})
    assert found.json()["exists"] is True
    assert found.json()["profile"]["id"] == body["id"]


async def test_duplicate_email_returns_409(client):
    assert (await client.post("/api/v1/profiles", json=PROFILE)).status_code == 201
    dup = await client.post("/api/v1/profiles", json={**PROFILE, "display_name": "Other"})
    assert dup.status_code == 409


async def test_invalid_profile_input_rejected(client):
    assert (await client.post("/api/v1/profiles", json={**PROFILE, "grade": "8"})).status_code == 422
    assert (await client.post("/api/v1/profiles", json={**PROFILE, "email": "nope"})).status_code == 422
    assert (await client.post("/api/v1/profiles", json={**PROFILE, "display_name": "  "})).status_code == 422
    assert (await client.get("/api/v1/profiles/lookup", params={"email": "nope"})).status_code == 422


async def test_curriculum_has_all_units_and_lessons(client):
    resp = await client.get("/api/v1/curriculum")
    assert resp.status_code == 200
    units = resp.json()["units"]
    assert [u["number"] for u in units] == [2, 3, 4, 5, 6, 7, 8, 10]
    lesson_ids = [l["id"] for u in units for l in u["lessons"]]
    assert len(lesson_ids) == 46
    assert len(set(lesson_ids)) == 46
    for unit in units:
        for lesson in unit["lessons"]:
            assert lesson["id"].startswith(f"{unit['number']}.")
            assert lesson["title"] and lesson["focus"] and lesson["keywords"]


async def test_curriculum_grade_filter(client):
    grade7 = (await client.get("/api/v1/curriculum", params={"grade": "7"})).json()["units"]
    grade6 = (await client.get("/api/v1/curriculum", params={"grade": "6"})).json()["units"]
    assert len(grade7) == 8
    assert grade6 == []
    assert (await client.get("/api/v1/curriculum", params={"grade": "9"})).status_code == 422
