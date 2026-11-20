"""Step 1: parent signs in with Google (POST /auth/google) and asks who they are (GET /me).

Google's own check is replaced by a fake: each fake ID token maps to the claims
Google would have returned for it.
"""

import pytest

from app.core.config import get_settings

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


@pytest.fixture(autouse=True)
def fake_google(monkeypatch):
    calls = []

    def verify(token, request, audience):
        calls.append(audience)
        if token not in GOOGLE_CLAIMS:
            raise ValueError("Token signature is invalid")
        return GOOGLE_CLAIMS[token]

    monkeypatch.setattr("google.oauth2.id_token.verify_oauth2_token", verify)
    return calls


async def sign_in(client, id_token, terms=None):
    body = {"id_token": id_token}
    if terms is not None:
        body["accepted_terms_version"] = terms
    return await client.post("/api/v1/auth/google", json=body)


async def test_first_sign_in_needs_consent(client):
    resp = await sign_in(client, "token-ana")
    assert resp.status_code == 409
    assert resp.json() == {"detail": "consent_required"}


async def test_first_sign_in_with_consent_creates_parent(client):
    resp = await sign_in(client, "token-ana", terms=TERMS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["expires_in"] == 900
    assert body["me"]["kind"] == "parent"
    parent = body["me"]["parent"]
    assert parent["email"] == "ana@example.com"
    assert parent["display_name"] == "Ana Parent"
    assert parent["id"]


async def test_google_check_uses_our_client_ids(client, fake_google):
    await sign_in(client, "token-ana", terms=TERMS)
    assert fake_google == [get_settings().google_client_ids_list]


async def test_old_terms_version_still_needs_consent(client):
    resp = await sign_in(client, "token-ana", terms="2020-01")
    assert resp.status_code == 409


async def test_returning_parent_is_same_parent_without_consent(client):
    first = (await sign_in(client, "token-ana", terms=TERMS)).json()
    again = await sign_in(client, "token-ana")
    assert again.status_code == 200
    assert again.json()["me"]["parent"]["id"] == first["me"]["parent"]["id"]


async def test_parent_is_found_by_google_sub_not_email(client):
    first = (await sign_in(client, "token-ana", terms=TERMS)).json()
    again = (await sign_in(client, "token-ana-new-email")).json()
    assert again["me"]["parent"]["id"] == first["me"]["parent"]["id"]
    assert again["me"]["parent"]["email"] == "ana.new@example.com"


async def test_two_parents_are_kept_apart(client):
    ana = (await sign_in(client, "token-ana", terms=TERMS)).json()
    ben = (await sign_in(client, "token-ben", terms=TERMS)).json()
    assert ana["me"]["parent"]["id"] != ben["me"]["parent"]["id"]
    # No name from Google: fall back to the start of the email.
    assert ben["me"]["parent"]["display_name"] == "ben"


async def test_invalid_google_token_refused(client):
    resp = await sign_in(client, "forged", terms=TERMS)
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Sign-in failed"}


async def test_unverified_google_email_refused(client):
    resp = await sign_in(client, "token-unverified", terms=TERMS)
    assert resp.status_code == 401
    assert resp.json() == {"detail": "Sign-in failed"}


async def test_sign_in_not_configured_returns_503(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "google_client_ids", "")
    resp = await sign_in(client, "token-ana", terms=TERMS)
    assert resp.status_code == 503


async def test_me_returns_signed_in_parent(client):
    signed_in = (await sign_in(client, "token-ana", terms=TERMS)).json()
    resp = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {signed_in['access_token']}"}
    )
    assert resp.status_code == 200
    assert resp.json() == signed_in["me"]


@pytest.mark.parametrize(
    "headers",
    [{}, {"Authorization": "Bearer not-a-token"}, {"Authorization": "Basic abc"}],
)
async def test_me_without_valid_token_is_401(client, headers):
    resp = await client.get("/api/v1/me", headers=headers)
    assert resp.status_code == 401
