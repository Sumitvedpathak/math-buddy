"""Signed-in children for tests of the child-only endpoints.

`make_kid` goes through the real flow (parent Google sign-in with Google faked,
add child, link code, link device), so the child exists in the database with a
parent. `token_headers` makes a token without the database, for endpoints that
only check the token (generate/evaluate/curriculum).
"""

import uuid
from dataclasses import dataclass
from unittest.mock import patch

from app.account.tokens import issue_access_token
from app.core.config import get_settings

TERMS = "2026-11-draft"


def _fake_google(token, request, audience):
    return {
        "sub": f"sub-{token}",
        "email": f"{token}@example.com",
        "email_verified": True,
        "name": "Parent",
    }


@dataclass
class Kid:
    id: str
    headers: dict  # Authorization: Bearer <child access token>
    parent_headers: dict


async def make_kid(client, grade="7", name="Kid", parent="parent-a") -> Kid:
    with patch("google.oauth2.id_token.verify_oauth2_token", _fake_google):
        signed_in = await client.post(
            "/api/v1/auth/google",
            json={"id_token": parent, "accepted_terms_version": TERMS, "client": "native"},
        )
    assert signed_in.status_code == 200, signed_in.text
    parent_headers = {"Authorization": f"Bearer {signed_in.json()['access_token']}"}

    child = await client.post(
        "/api/v1/children",
        json={"display_name": name, "grade": grade},
        headers=parent_headers,
    )
    assert child.status_code == 201, child.text
    child_id = child.json()["id"]

    code = await client.post(
        f"/api/v1/children/{child_id}/link-codes", headers=parent_headers
    )
    linked = await client.post(
        "/api/v1/auth/link", json={"code": code.json()["code"], "client": "native"}
    )
    assert linked.status_code == 200, linked.text
    return Kid(
        id=child_id,
        headers={"Authorization": f"Bearer {linked.json()['access_token']}"},
        parent_headers=parent_headers,
    )


def token_headers(kind="child") -> dict:
    """A valid access token for a made-up child (or parent); nothing in the database."""
    some = uuid.uuid4()
    token = issue_access_token(
        get_settings().jwt_secret, sub=some, kind=kind, pid=uuid.uuid4(), sid=uuid.uuid4()
    )
    return {"Authorization": f"Bearer {token}"}


CHILD = token_headers  # readability at call sites: headers=CHILD()
