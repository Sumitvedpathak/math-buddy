"""Access tokens: what a valid one carries and which ones are refused."""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.account.tokens import (
    ACCESS_TOKEN_TTL,
    InvalidAccessToken,
    hash_refresh_token,
    issue_access_token,
    new_refresh_token,
    verify_access_token,
)

SECRET = "unit-test-secret-0123456789abcdef0123"
PARENT_ID = uuid.uuid4()
SESSION_ID = uuid.uuid4()


def test_valid_token_round_trips():
    token = issue_access_token(
        SECRET, sub=PARENT_ID, kind="parent", pid=PARENT_ID, sid=SESSION_ID
    )
    claims = verify_access_token(SECRET, token)
    assert claims.sub == PARENT_ID
    assert claims.kind == "parent"
    assert claims.pid == PARENT_ID
    assert claims.sid == SESSION_ID


def test_token_lasts_fifteen_minutes():
    assert ACCESS_TOKEN_TTL == timedelta(minutes=15)
    now = datetime.now(timezone.utc)
    token = issue_access_token(
        SECRET, sub=PARENT_ID, kind="parent", pid=PARENT_ID, sid=SESSION_ID, now=now
    )
    payload = jwt.decode(token, options={"verify_signature": False})
    assert payload["exp"] - payload["iat"] == 15 * 60


def test_expired_token_refused():
    long_ago = datetime.now(timezone.utc) - timedelta(minutes=16)
    token = issue_access_token(
        SECRET,
        sub=PARENT_ID,
        kind="parent",
        pid=PARENT_ID,
        sid=SESSION_ID,
        now=long_ago,
    )
    with pytest.raises(InvalidAccessToken):
        verify_access_token(SECRET, token)


def test_token_signed_with_other_secret_refused():
    token = issue_access_token(
        "another-secret-0123456789abcdef0123",
        sub=PARENT_ID,
        kind="parent",
        pid=PARENT_ID,
        sid=SESSION_ID,
    )
    with pytest.raises(InvalidAccessToken):
        verify_access_token(SECRET, token)


def test_token_for_other_audience_refused():
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {
            "sub": str(PARENT_ID),
            "kind": "parent",
            "pid": str(PARENT_ID),
            "sid": str(SESSION_ID),
            "iss": "math-buddy",
            "aud": "someone-else",
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        SECRET,
        algorithm="HS256",
    )
    with pytest.raises(InvalidAccessToken):
        verify_access_token(SECRET, token)


def test_unknown_kind_refused():
    token = issue_access_token(
        SECRET, sub=PARENT_ID, kind="admin", pid=PARENT_ID, sid=SESSION_ID
    )
    with pytest.raises(InvalidAccessToken):
        verify_access_token(SECRET, token)


@pytest.mark.parametrize("garbage", ["", "not-a-jwt", "a.b.c"])
def test_garbage_refused(garbage):
    with pytest.raises(InvalidAccessToken):
        verify_access_token(SECRET, garbage)


def test_refresh_tokens_are_random_and_long():
    a, b = new_refresh_token(), new_refresh_token()
    assert a != b
    assert len(a) >= 43  # 32 random bytes, base64url


def test_refresh_token_hash_is_stable_and_hides_the_token():
    token = new_refresh_token()
    assert hash_refresh_token(token) == hash_refresh_token(token)
    assert hash_refresh_token(token) != hash_refresh_token(new_refresh_token())
    assert token not in hash_refresh_token(token)
