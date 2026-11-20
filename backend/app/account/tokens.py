"""Math Buddy access tokens (JWT). Pure functions: no database, no settings."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt

ACCESS_TOKEN_TTL = timedelta(minutes=15)
ISSUER = "math-buddy"
AUDIENCE = "math-buddy-api"
ALGORITHM = "HS256"
KINDS = ("parent", "child")


class InvalidAccessToken(Exception):
    """Missing, expired, tampered or otherwise unusable access token."""


@dataclass(frozen=True)
class TokenClaims:
    sub: uuid.UUID  # parent id, or child profile id
    kind: str  # "parent" | "child"
    pid: uuid.UUID  # owning parent id


def issue_access_token(
    secret: str,
    *,
    sub: uuid.UUID,
    kind: str,
    pid: uuid.UUID,
    now: datetime | None = None,
) -> str:
    now = now or datetime.now(timezone.utc)
    payload = {
        "sub": str(sub),
        "kind": kind,
        "pid": str(pid),
        "iss": ISSUER,
        "aud": AUDIENCE,
        "iat": now,
        "exp": now + ACCESS_TOKEN_TTL,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def verify_access_token(secret: str, token: str) -> TokenClaims:
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[ALGORITHM],
            audience=AUDIENCE,
            issuer=ISSUER,
            options={"require": ["sub", "kind", "pid", "iat", "exp", "iss", "aud"]},
        )
        if payload["kind"] not in KINDS:
            raise InvalidAccessToken("unknown kind")
        return TokenClaims(
            sub=uuid.UUID(payload["sub"]),
            kind=payload["kind"],
            pid=uuid.UUID(payload["pid"]),
        )
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise InvalidAccessToken(str(exc)) from exc
