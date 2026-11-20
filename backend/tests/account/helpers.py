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
