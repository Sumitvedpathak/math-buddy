"""Parent sign-in (Google), children, link codes, and device sessions."""

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi.concurrency import run_in_threadpool
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.account.models import AuthIdentity, AuthSession, LinkCode, Parent
from app.account.schemas import ChildCreate, ChildUpdate
from app.account.tokens import (
    hash_link_code,
    hash_refresh_token,
    new_link_code,
    new_refresh_token,
    normalize_link_code,
)
from app.core.db import utcnow
from app.profiles.models import Profile

logger = logging.getLogger(__name__)

GOOGLE = "google"
_google_request = google_requests.Request()  # fetches Google's public keys

# A session ends after this long without a refresh; every refresh pushes it forward.
IDLE_LIMIT = {"parent": timedelta(days=60), "child": timedelta(days=180)}
# Two tabs refreshing at the same moment both send the same token.
RACE_WINDOW = timedelta(seconds=30)
LINK_CODE_TTL = timedelta(minutes=10)
LINK_CODES_PER_HOUR = 20  # per parent


class SignInFailed(Exception):
    """Google did not vouch for this person. The reason is logged, never returned."""


class ConsentRequired(Exception):
    """New parent who has not accepted the current terms yet."""


class RefreshFailed(Exception):
    """Unknown, revoked, expired or stolen refresh token. The reason is logged only."""


class ChildNotFound(Exception):
    """No such child, or it belongs to another parent (same answer for both)."""


class TooManyLinkCodes(Exception):
    """This parent made too many codes in the last hour."""


class CodeNotValid(Exception):
    """Unknown, used, cancelled or expired link code. The reason is logged only."""


class DeviceNotFound(Exception):
    """No such linked device, or it belongs to another parent's child."""


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


BROWSERS = [
    ("Edg/", "Edge"),
    ("OPR/", "Opera"),
    ("Firefox/", "Firefox"),
    ("Chrome/", "Chrome"),
    ("Safari/", "Safari"),
]
SYSTEMS = [
    ("Windows", "Windows"),
    ("iPhone", "iPhone"),
    ("iPad", "iPad"),
    ("Android", "Android"),
    ("CrOS", "Chromebook"),
    ("Mac OS X", "Mac"),
    ("Linux", "Linux"),
]


def friendly_device_name(user_agent: str | None) -> str:
    """For example "Chrome on Windows". Good enough to tell devices apart in a list;
    the parent can rename it later."""
    ua = user_agent or ""
    browser = next((name for key, name in BROWSERS if key in ua), None)
    system = next((name for key, name in SYSTEMS if key in ua), None)
    if browser and system:
        return f"{browser} on {system}"
    return browser or system or "Unknown device"


async def _new_session(
    session: AsyncSession,
    *,
    kind: str,
    parent_id: uuid.UUID,
    child_profile_id: uuid.UUID | None,
    user_agent: str | None,
    device_name: str | None,
) -> tuple[AuthSession, str]:
    """Add (not commit) a device session. Returns it with its first refresh token."""
    now = utcnow()
    token = new_refresh_token()
    auth_session = AuthSession(
        kind=kind,
        parent_id=parent_id,
        child_profile_id=child_profile_id,
        refresh_hash=hash_refresh_token(token),
        rotated_at=now,
        device_name=device_name or friendly_device_name(user_agent),
        user_agent=(user_agent or "")[:300] or None,
        created_at=now,
        last_used_at=now,
        idle_expires_at=now + IDLE_LIMIT[kind],
    )
    session.add(auth_session)
    await session.flush()  # assigns auth_session.id
    return auth_session, token


async def start_session(
    session: AsyncSession, parent: Parent, user_agent: str | None
) -> tuple[AuthSession, str]:
    """New parent session. Returns it with its first refresh token."""
    auth_session, token = await _new_session(
        session,
        kind="parent",
        parent_id=parent.id,
        child_profile_id=None,
        user_agent=user_agent,
        device_name=None,
    )
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


# --- Children (profiles owned by a parent) -----------------------------------------


async def list_children(session: AsyncSession, parent_id: uuid.UUID) -> list[Profile]:
    rows = await session.scalars(
        select(Profile)
        .where(Profile.parent_id == parent_id)
        .order_by(Profile.created_at, Profile.id)
    )
    return list(rows)


async def add_child(
    session: AsyncSession, parent_id: uuid.UUID, data: ChildCreate
) -> Profile:
    child = Profile(
        parent_id=parent_id, display_name=data.display_name, grade=data.grade
    )
    session.add(child)
    await session.commit()
    logger.info(
        "Child added", extra={"parent_id": str(parent_id), "profile_id": str(child.id)}
    )
    return child


async def update_child(
    session: AsyncSession, parent_id: uuid.UUID, child_id: uuid.UUID, data: ChildUpdate
) -> Profile:
    child = await get_child(session, parent_id, child_id)
    if data.display_name is not None:
        child.display_name = data.display_name
    if data.grade is not None:
        child.grade = data.grade
    await session.commit()
    return child


async def get_child(
    session: AsyncSession, parent_id: uuid.UUID, child_id: uuid.UUID
) -> Profile:
    """This parent's child, or ChildNotFound (also for another parent's child)."""
    child = await session.get(Profile, child_id)
    if child is None or child.parent_id != parent_id:
        raise ChildNotFound()
    return child


# --- Link codes ---------------------------------------------------------------------


async def create_link_code(
    session: AsyncSession, parent_id: uuid.UUID, child_id: uuid.UUID
) -> tuple[str, datetime]:
    """A new one-time code for this child. Cancels the child's earlier unused codes."""
    await get_child(session, parent_id, child_id)
    now = utcnow()
    made_last_hour = await session.scalar(
        select(func.count())
        .select_from(LinkCode)
        .where(
            LinkCode.parent_id == parent_id,
            LinkCode.created_at > now - timedelta(hours=1),
        )
    )
    if made_last_hour >= LINK_CODES_PER_HOUR:
        raise TooManyLinkCodes()

    await _cancel_codes(session, child_id, now)
    code = new_link_code()
    expires_at = now + LINK_CODE_TTL
    session.add(
        LinkCode(
            child_profile_id=child_id,
            parent_id=parent_id,
            code_hash=hash_link_code(normalize_link_code(code)),
            expires_at=expires_at,
            created_at=now,
        )
    )
    await session.commit()
    logger.info(
        "Link code made",
        extra={"parent_id": str(parent_id), "profile_id": str(child_id)},
    )
    return code, expires_at


async def _cancel_codes(
    session: AsyncSession, child_id: uuid.UUID, now: datetime
) -> None:
    """Make every unused code of this child stop working now (no commit)."""
    unused = await session.scalars(
        select(LinkCode).where(
            LinkCode.child_profile_id == child_id, LinkCode.used_at.is_(None)
        )
    )
    for row in unused:
        if _aware(row.expires_at) > now:
            row.expires_at = now


async def cancel_link_codes(
    session: AsyncSession, parent_id: uuid.UUID, child_id: uuid.UUID
) -> None:
    """The parent closed the code panel: the shown code stops working."""
    await get_child(session, parent_id, child_id)
    await _cancel_codes(session, child_id, utcnow())
    await session.commit()


async def redeem_link_code(
    session: AsyncSession,
    typed_code: str,
    user_agent: str | None,
    device_name: str | None,
) -> tuple[AuthSession, str]:
    """Use a code once: start a child session on this device."""
    normalized = normalize_link_code(typed_code)
    if normalized is None:
        raise CodeNotValid("not a code")
    now = utcnow()
    row = await session.scalar(
        select(LinkCode).where(LinkCode.code_hash == hash_link_code(normalized))
    )
    if row is None:
        raise CodeNotValid("unknown code")
    if row.used_at is not None or _aware(row.expires_at) <= now:
        raise CodeNotValid(f"code {row.id} used, cancelled or expired")
    # Mark used only if still unused: two devices typing the same code at once
    # cannot both win.
    claimed = await session.execute(
        update(LinkCode)
        .where(LinkCode.id == row.id, LinkCode.used_at.is_(None))
        .values(used_at=now)
    )
    if claimed.rowcount != 1:
        raise CodeNotValid(f"code {row.id} already used")
    child = await session.get(Profile, row.child_profile_id)
    if child is None or child.parent_id != row.parent_id:
        raise CodeNotValid(f"code {row.id}: child no longer belongs to its parent")

    auth_session, token = await _new_session(
        session,
        kind="child",
        parent_id=row.parent_id,
        child_profile_id=child.id,
        user_agent=user_agent,
        device_name=device_name,
    )
    await session.commit()
    logger.info(
        "Device linked",
        extra={"session_id": str(auth_session.id), "profile_id": str(child.id)},
    )
    return auth_session, token


# --- Linked devices (child sessions) --------------------------------------------------


def _signed_in_child_devices(parent_id: uuid.UUID):
    """Child sessions of this parent that can still refresh."""
    return select(AuthSession).where(
        AuthSession.kind == "child",
        AuthSession.parent_id == parent_id,
        AuthSession.revoked_at.is_(None),
        AuthSession.idle_expires_at > utcnow(),
    )


async def linked_device_counts(
    session: AsyncSession, parent_id: uuid.UUID
) -> dict[uuid.UUID, int]:
    """Child profile id -> number of devices signed in as that child."""
    devices = _signed_in_child_devices(parent_id).subquery()
    rows = await session.execute(
        select(devices.c.child_profile_id, func.count()).group_by(
            devices.c.child_profile_id
        )
    )
    return {child_id: count for child_id, count in rows}


async def list_devices(
    session: AsyncSession, parent_id: uuid.UUID, child_id: uuid.UUID
) -> list[AuthSession]:
    await get_child(session, parent_id, child_id)
    rows = await session.scalars(
        _signed_in_child_devices(parent_id)
        .where(AuthSession.child_profile_id == child_id)
        .order_by(AuthSession.created_at, AuthSession.id)
    )
    return list(rows)


async def _get_device(
    session: AsyncSession, parent_id: uuid.UUID, session_id: uuid.UUID
) -> AuthSession:
    device = await session.scalar(
        _signed_in_child_devices(parent_id).where(AuthSession.id == session_id)
    )
    if device is None:
        raise DeviceNotFound()
    return device


async def rename_device(
    session: AsyncSession, parent_id: uuid.UUID, session_id: uuid.UUID, name: str
) -> AuthSession:
    device = await _get_device(session, parent_id, session_id)
    device.device_name = name
    await session.commit()
    return device


async def unlink_device(
    session: AsyncSession, parent_id: uuid.UUID, session_id: uuid.UUID
) -> None:
    """Sign the device out: its next refresh fails and it shows the start screen."""
    device = await _get_device(session, parent_id, session_id)
    device.revoked_at = utcnow()
    await session.commit()
    logger.info(
        "Device unlinked",
        extra={"parent_id": str(parent_id), "session_id": str(session_id)},
    )
