"""Parent sign-in: check Google's ID token, then find or create the parent."""

import logging
import uuid
from dataclasses import dataclass

from fastapi.concurrency import run_in_threadpool
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.account.models import AuthIdentity, Parent
from app.core.db import utcnow

logger = logging.getLogger(__name__)

GOOGLE = "google"
_google_request = google_requests.Request()  # fetches Google's public keys


class SignInFailed(Exception):
    """Google did not vouch for this person. The reason is logged, never returned."""


class ConsentRequired(Exception):
    """New parent who has not accepted the current terms yet."""


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
