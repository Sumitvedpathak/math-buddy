"""Math Buddy tokens. Pure functions: no database, no settings.

- Access token: a short-lived JWT sent on every API call.
- Refresh token: a long random string, only ever stored as its SHA-256.
"""

import hashlib
import secrets
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
    sid: uuid.UUID  # auth session (device) id


def issue_access_token(
    secret: str,
    *,
    sub: uuid.UUID,
    kind: str,
    pid: uuid.UUID,
    sid: uuid.UUID,
    now: datetime | None = None,
) -> str:
    now = now or datetime.now(timezone.utc)
    payload = {
        "sub": str(sub),
        "kind": kind,
        "pid": str(pid),
        "sid": str(sid),
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
            options={
                "require": ["sub", "kind", "pid", "sid", "iat", "exp", "iss", "aud"]
            },
        )
        if payload["kind"] not in KINDS:
            raise InvalidAccessToken("unknown kind")
        return TokenClaims(
            sub=uuid.UUID(payload["sub"]),
            kind=payload["kind"],
            pid=uuid.UUID(payload["pid"]),
            sid=uuid.UUID(payload["sid"]),
        )
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise InvalidAccessToken(str(exc)) from exc


def new_refresh_token() -> str:
    return secrets.token_urlsafe(32)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# --- Link codes (parent -> child device) -------------------------------------------

# No look-alikes: no 0/O, no 1/I.
LINK_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
LINK_CODE_LENGTH = 8


def new_link_code() -> str:
    """A one-time code shown to the parent, e.g. "7K4Q-9PXM" (40 bits)."""
    raw = "".join(secrets.choice(LINK_CODE_ALPHABET) for _ in range(LINK_CODE_LENGTH))
    return f"{raw[:4]}-{raw[4:]}"


def normalize_link_code(typed: str) -> str | None:
    """What the child typed -> the 8 code characters, or None if it cannot be a code.

    Case-insensitive; spaces and dashes are ignored.
    """
    code = "".join(ch for ch in (typed or "").upper() if ch not in " -")
    if len(code) != LINK_CODE_LENGTH or any(c not in LINK_CODE_ALPHABET for c in code):
        return None
    return code


def hash_link_code(normalized: str) -> str:
    return hashlib.sha256(normalized.encode()).hexdigest()
