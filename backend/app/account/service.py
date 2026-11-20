"""Parent sign-in (Google) and signed-in device sessions (refresh, logout)."""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi.concurrency import run_in_threadpool
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.account.models import AuthIdentity, AuthSession, Parent
from app.account.tokens import hash_refresh_token, new_refresh_token
from app.core.db import utcnow

logger = logging.getLogger(__name__)

GOOGLE = "google"
_google_request = google_requests.Request()  # fetches Google's public keys

# A session ends after this long without a refresh; every refresh pushes it forward.
IDLE_LIMIT = {"parent": timedelta(days=60), "child": timedelta(days=180)}
# Two tabs refreshing at the same moment both send the same token.
RACE_WINDOW = timedelta(seconds=30)


class SignInFailed(Exception):
    """Google did not vouch for this person. The reason is logged, never returned."""


class ConsentRequired(Exception):
    """New parent who has not accepted the current terms yet."""


class RefreshFailed(Exception):
    """Unknown, revoked, expired or stolen refresh token. The reason is logged only."""


class RefreshRace(Exception):
    """The token was just rotated by another tab; retrying with the new one works."""


@dataclass(frozen=True)
class GoogleUser:
    sub: str
    email: str
    name: str


async def verify_google_id_token(id_token: str, client_ids: list[str]) -> GoogleUser:
    """Check signature, expiry, issuer and that it was made for one of our client IDs."""
    try:
        # Blocking call (may download Google's keys), so keep it off the event loop.
        claims = await run_in_threadpool(
            google_id_token.verify_oauth2_token, id_token, _google_request, client_ids
        )
    except (ValueError, GoogleAuthError) as exc:
        raise SignInFailed(f"Google rejected the ID token: {exc}") from exc
    if claims.get("email_verified") is not True:
        raise SignInFailed("Google email is not verified")
    sub, email = claims.get("sub"), claims.get("email")
    if not sub or not email:
        raise SignInFailed("ID token has no sub or email")
    name = (claims.get("name") or "").strip() or email.split("@")[0]
    return GoogleUser(sub=sub, email=email, name=name)


async def sign_in_with_google(
    session: AsyncSession,
    user: GoogleUser,
    accepted_terms_version: str | None,
    current_terms_version: str,
) -> Parent:
    """Returning parent: found by Google's `sub` (not email). New parent: needs consent."""
    now = utcnow()
    identity = await session.scalar(
        select(AuthIdentity).where(
            AuthIdentity.provider == GOOGLE, AuthIdentity.subject == user.sub
        )
    )
    if identity is not None:
        parent = await session.get(Parent, identity.parent_id)
        parent.email = user.email  # a Google account's email can change
        parent.last_login_at = now
        await session.commit()
        logger.info("Parent signed in", extra={"parent_id": str(parent.id)})
        return parent

    if accepted_terms_version != current_terms_version:
        raise ConsentRequired()

    parent = Parent(
        email=user.email,
        display_name=user.name,
        accepted_terms_version=current_terms_version,
        accepted_terms_at=now,
        last_login_at=now,
    )
    session.add(parent)
    await session.flush()  # assigns parent.id
    session.add(
        AuthIdentity(
            parent_id=parent.id,
            provider=GOOGLE,
            subject=user.sub,
            email_at_signin=user.email,
        )
    )
    await session.commit()
    logger.info("Parent signed up", extra={"parent_id": str(parent.id)})
    return parent


async def get_parent(session: AsyncSession, parent_id: uuid.UUID) -> Parent | None:
    return await session.get(Parent, parent_id)


# --- Sessions (one per signed-in device) ----------------------------------------


def _aware(dt: datetime) -> datetime:
    """SQLite hands back naive datetimes; treat them as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def start_session(
    session: AsyncSession, parent: Parent, user_agent: str | None
) -> tuple[AuthSession, str]:
    """New parent session. Returns it with its first refresh token."""
    now = utcnow()
    token = new_refresh_token()
    auth_session = AuthSession(
        kind="parent",
        parent_id=parent.id,
        refresh_hash=hash_refresh_token(token),
        rotated_at=now,
        user_agent=(user_agent or "")[:300] or None,
        created_at=now,
        last_used_at=now,
        idle_expires_at=now + IDLE_LIMIT["parent"],
    )
    session.add(auth_session)
    await session.commit()
    logger.info("Session started", extra={"session_id": str(auth_session.id)})
    return auth_session, token


async def _find_session(session: AsyncSession, token_hash: str) -> AuthSession | None:
    return await session.scalar(
        select(AuthSession)
        .where(
            or_(
                AuthSession.refresh_hash == token_hash,
                AuthSession.prev_refresh_hash == token_hash,
                AuthSession.older_refresh_hash == token_hash,
            )
        )
        .with_for_update()  # two refreshes of one session run one after the other
    )


async def refresh_session(session: AsyncSession, token: str) -> tuple[AuthSession, str]:
    """Swap a refresh token for a new one (rotation with reuse detection)."""
    now = utcnow()
    token_hash = hash_refresh_token(token)
    row = await _find_session(session, token_hash)
    if row is None:
        raise RefreshFailed("unknown refresh token")
    if row.revoked_at is not None:
        raise RefreshFailed("session revoked")
    if _aware(row.idle_expires_at) <= now:
        raise RefreshFailed("session idle-expired")

    new_token = new_refresh_token()
    new_hash = hash_refresh_token(new_token)
    if token_hash == row.refresh_hash:
        # Normal case: the newest token.
        row.older_refresh_hash = row.prev_refresh_hash
        row.prev_refresh_hash = row.refresh_hash
    elif token_hash == row.prev_refresh_hash:
        if now - _aware(row.rotated_at) < RACE_WINDOW:
            raise RefreshRace()
        # The reply to the last refresh was lost, so its token was never used by
        # this device. Keep that token as `older`: if it ever shows up, it was stolen.
        row.older_refresh_hash = row.refresh_hash
    else:
        # A token that has already been replaced twice: someone copied it.
        row.revoked_at = now
        await session.commit()
        raise RefreshFailed(f"old refresh token reused, session {row.id} revoked")

    row.refresh_hash = new_hash
    row.rotated_at = now
    row.last_used_at = now
    row.idle_expires_at = now + IDLE_LIMIT[row.kind]
    await session.commit()
    return row, new_token


async def end_session(session: AsyncSession, token: str) -> None:
    """Sign this device out. Unknown or already-ended tokens are ignored."""
    row = await _find_session(session, hash_refresh_token(token))
    if row is not None and row.revoked_at is None:
        row.revoked_at = utcnow()
        await session.commit()
        logger.info("Session ended", extra={"session_id": str(row.id)})
