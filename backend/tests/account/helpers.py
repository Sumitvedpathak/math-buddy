"""Shared test data and calls for the account tests."""

TERMS = "2026-11-draft"

GOOGLE_CLAIMS = {
    "token-ana": {
        "sub": "google-sub-ana",
        "email": "ana@example.com",
        "email_verified": True,
        "name": "Ana Parent",
    },
    "token-ana-new-email": {
        "sub": "google-sub-ana",
        "email": "ana.new@example.com",
        "email_verified": True,
        "name": "Ana Parent",
    },
    "token-ben": {
        "sub": "google-sub-ben",
        "email": "ben@example.com",
        "email_verified": True,
    },
    "token-unverified": {
        "sub": "google-sub-eve",
        "email": "eve@example.com",
        "email_verified": False,
        "name": "Eve",
    },
}

REFRESH_HEADERS = {"X-Requested-With": "mathbuddy", "Origin": "http://localhost:5173"}


async def sign_in(client, id_token, terms=None):
    body = {"id_token": id_token}
    if terms is not None:
        body["accepted_terms_version"] = terms
    return await client.post("/api/v1/auth/google", json=body)


async def parent_headers(client, id_token="token-ana"):
    resp = await client.post(
        "/api/v1/auth/google",
        json={
            "id_token": id_token,
            "accepted_terms_version": TERMS,
            "client": "native",
        },
    )
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


async def add_child(client, headers, name="Aarav", grade="7"):
    resp = await client.post(
        "/api/v1/children", json={"display_name": name, "grade": grade}, headers=headers
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def make_code(client, headers, child_id):
    resp = await client.post(f"/api/v1/children/{child_id}/link-codes", headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()["code"]


async def link_device(client, headers, child_id, user_agent="Mozilla/5.0"):
    """Link a new (native) device to the child. Returns the sign-in reply."""
    code = await make_code(client, headers, child_id)
    resp = await client.post(
        "/api/v1/auth/link",
        json={"code": code, "client": "native"},
        headers={"User-Agent": user_agent},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()
