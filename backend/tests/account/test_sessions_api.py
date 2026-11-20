"""Step 2: a parent stays signed in (POST /auth/refresh) and can sign out (POST /auth/logout).

Web clients carry the refresh token in the `mb_refresh` cookie; native clients
(client="native") get it in the JSON body. Most tests use the body form because
it is simpler to drive; the cookie form gets its own tests.
"""

from datetime import timedelta

import jwt
import pytest

from app.core.db import utcnow
from tests.account.helpers import REFRESH_HEADERS, TERMS

REFRESH = "/api/v1/auth/refresh"
LOGOUT = "/api/v1/auth/logout"


@pytest.fixture
def clock(monkeypatch):
    """Lets a test move the server's clock forward."""

    class Clock:
        now = utcnow()

        def advance(self, **kwargs):
            self.now += timedelta(**kwargs)

    c = Clock()
    monkeypatch.setattr("app.account.service.utcnow", lambda: c.now)
    return c


async def native_sign_in(client):
    resp = await client.post(
        "/api/v1/auth/google",
        json={
            "id_token": "token-ana",
            "accepted_terms_version": TERMS,
            "client": "native",
        },
    )
    assert resp.status_code == 200
    return resp.json()


async def refresh(client, token):
    return await client.post(REFRESH, json={"refresh_token": token})


def cookie_from(resp):
    """The raw Set-Cookie header for mb_refresh, or None."""
    for header in resp.headers.get_list("set-cookie"):
        if header.startswith("mb_refresh="):
            return header
    return None


def cookie_value(set_cookie):
    return set_cookie.split(";", 1)[0].split("=", 1)[1]


# --- What sign-in hands out ---------------------------------------------------


async def test_web_sign_in_sets_refresh_cookie(client):
    resp = await client.post(
        "/api/v1/auth/google",
        json={"id_token": "token-ana", "accepted_terms_version": TERMS},
    )
    assert resp.status_code == 200
    assert "refresh_token" not in resp.json() or resp.json()["refresh_token"] is None
    cookie = cookie_from(resp)
    assert cookie is not None
    lowered = cookie.lower()
    assert "httponly" in lowered
    assert "secure" in lowered
    assert "samesite=strict" in lowered
    assert "path=/api/v1/auth" in lowered


async def test_native_sign_in_returns_refresh_token_in_body(client):
    resp = await client.post(
        "/api/v1/auth/google",
        json={
            "id_token": "token-ana",
            "accepted_terms_version": TERMS,
            "client": "native",
        },
    )
    assert resp.json()["refresh_token"]
    assert cookie_from(resp) is None


async def test_access_token_names_its_session(client):
    body = await native_sign_in(client)
    claims = jwt.decode(body["access_token"], options={"verify_signature": False})
    assert claims["sid"]


# --- Refresh ------------------------------------------------------------------


async def test_refresh_gives_new_tokens_for_same_parent(client, clock):
    first = await native_sign_in(client)
    resp = await refresh(client, first["refresh_token"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["access_token"]
    assert body["expires_in"] == 900
    assert body["refresh_token"] != first["refresh_token"]
    assert body["me"] == first["me"]

    me = await client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200


async def test_refresh_keeps_working_token_after_token(client, clock):
    token = (await native_sign_in(client))["refresh_token"]
    for _ in range(3):
        clock.advance(minutes=20)
        resp = await refresh(client, token)
        assert resp.status_code == 200
        token = resp.json()["refresh_token"]


@pytest.mark.parametrize("body", [{}, {"refresh_token": "made-up"}])
async def test_refresh_without_known_token_is_401(client, body):
    resp = await client.post(REFRESH, json=body)
    assert resp.status_code == 401


async def test_two_tabs_refreshing_together_get_409_race(client, clock):
    old = (await native_sign_in(client))["refresh_token"]
    new = (await refresh(client, old)).json()["refresh_token"]
    clock.advance(seconds=5)
    resp = await refresh(client, old)
    assert resp.status_code == 409
    assert resp.json() == {"detail": "refresh_race"}
    # The winner's token is untouched.
    assert (await refresh(client, new)).status_code == 200


async def test_lost_reply_is_forgiven(client, clock):
    """The reply to a refresh never arrived, so the device retries its old token later."""
    old = (await native_sign_in(client))["refresh_token"]
    lost = (await refresh(client, old)).json()["refresh_token"]
    clock.advance(minutes=10)

    retry = await refresh(client, old)
    assert retry.status_code == 200
    kept = retry.json()["refresh_token"]
    assert kept not in (old, lost)
    assert (await refresh(client, kept)).status_code == 200
    del lost  # never seen by the real device


async def test_using_the_lost_token_later_means_theft(client, clock):
    """Someone else had the 'lost' token: when it shows up, the whole session ends."""
    old = (await native_sign_in(client))["refresh_token"]
    lost = (await refresh(client, old)).json()["refresh_token"]
    clock.advance(minutes=10)
    kept = (await refresh(client, old)).json()["refresh_token"]

    assert (await refresh(client, lost)).status_code == 401
    assert (await refresh(client, kept)).status_code == 401


async def test_replaying_an_old_token_ends_the_session(client, clock):
    t1 = (await native_sign_in(client))["refresh_token"]
    t2 = (await refresh(client, t1)).json()["refresh_token"]
    clock.advance(minutes=1)
    t3 = (await refresh(client, t2)).json()["refresh_token"]
    clock.advance(minutes=1)

    assert (await refresh(client, t1)).status_code == 401  # two rotations old
    assert (await refresh(client, t3)).status_code == 401  # session revoked


async def test_idle_parent_session_expires_after_60_days(client, clock):
    token = (await native_sign_in(client))["refresh_token"]
    clock.advance(days=61)
    assert (await refresh(client, token)).status_code == 401


async def test_each_refresh_pushes_idle_expiry_forward(client, clock):
    token = (await native_sign_in(client))["refresh_token"]
    clock.advance(days=59)
    token = (await refresh(client, token)).json()["refresh_token"]
    clock.advance(days=59)
    assert (await refresh(client, token)).status_code == 200


async def test_sign_in_twice_makes_two_independent_sessions(client):
    laptop = (await native_sign_in(client))["refresh_token"]
    phone = (await native_sign_in(client))["refresh_token"]
    await client.post(LOGOUT, json={"refresh_token": laptop})
    assert (await refresh(client, phone)).status_code == 200


# --- Web: refresh token in a cookie -------------------------------------------


async def web_sign_in_cookie(client):
    resp = await client.post(
        "/api/v1/auth/google",
        json={"id_token": "token-ana", "accepted_terms_version": TERMS},
    )
    return cookie_value(cookie_from(resp))


async def test_web_refresh_reads_and_rotates_cookie(client):
    value = await web_sign_in_cookie(client)
    resp = await client.post(
        REFRESH, headers={**REFRESH_HEADERS, "Cookie": f"mb_refresh={value}"}
    )
    assert resp.status_code == 200
    assert resp.json().get("refresh_token") is None
    new_cookie = cookie_from(resp)
    assert new_cookie is not None
    assert cookie_value(new_cookie) != value


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "http://localhost:5173"},  # no X-Requested-With
        {"X-Requested-With": "mathbuddy"},  # no Origin
        {"X-Requested-With": "mathbuddy", "Origin": "https://evil.example"},
    ],
)
async def test_web_refresh_needs_csrf_headers(client, headers):
    value = await web_sign_in_cookie(client)
    resp = await client.post(
        REFRESH, headers={**headers, "Cookie": f"mb_refresh={value}"}
    )
    assert resp.status_code == 403


async def test_failed_web_refresh_clears_cookie(client):
    resp = await client.post(
        REFRESH, headers={**REFRESH_HEADERS, "Cookie": "mb_refresh=made-up"}
    )
    assert resp.status_code == 401
    cleared = cookie_from(resp)
    assert cleared is not None and "max-age=0" in cleared.lower()


# --- Logout ---------------------------------------------------------------------


async def test_logout_ends_the_session(client):
    token = (await native_sign_in(client))["refresh_token"]
    resp = await client.post(LOGOUT, json={"refresh_token": token})
    assert resp.status_code == 204
    assert (await refresh(client, token)).status_code == 401


async def test_web_logout_ends_session_and_clears_cookie(client):
    value = await web_sign_in_cookie(client)
    cookie = {"Cookie": f"mb_refresh={value}"}
    resp = await client.post(LOGOUT, headers={**REFRESH_HEADERS, **cookie})
    assert resp.status_code == 204
    assert "max-age=0" in cookie_from(resp).lower()
    again = await client.post(REFRESH, headers={**REFRESH_HEADERS, **cookie})
    assert again.status_code == 401


async def test_logout_with_unknown_token_is_still_204(client):
    resp = await client.post(LOGOUT, json={"refresh_token": "made-up"})
    assert resp.status_code == 204
