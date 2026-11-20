"""Account: sign-in, staying signed in, signing out, "who am I", children,
and linking a child's device."""

import logging
import time
import uuid
from collections import defaultdict, deque
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from app.account.models import AuthSession, Parent
from app.account.schemas import (
    ChildCreate,
    ChildMe,
    ChildOut,
    ChildUpdate,
    Client,
    DeviceOut,
    DeviceRename,
    GoogleSignIn,
    LinkCodeOut,
    LinkIn,
    Me,
    ParentChildOut,
    ParentMe,
    ParentOut,
    RefreshIn,
    SignedIn,
)
from app.account.service import (
    IDLE_LIMIT,
    ChildNotFound,
    CodeNotValid,
    ConsentRequired,
    DeviceNotFound,
    RefreshFailed,
    RefreshRace,
    SignInFailed,
    TooManyLinkCodes,
    add_child,
    cancel_link_codes,
    create_link_code,
    end_session,
    get_child,
    get_parent,
    linked_device_counts,
    list_children,
    list_devices,
    redeem_link_code,
    refresh_session,
    rename_device,
    sign_in_with_google,
    start_session,
    unlink_device,
    update_child,
    verify_google_id_token,
)
from app.account.tokens import ACCESS_TOKEN_TTL, issue_access_token
from app.core.config import get_settings
from app.core.deps import ParentDep, SessionDep, SignedInDep

logger = logging.getLogger(__name__)
router = APIRouter(tags=["account"])

COOKIE_NAME = "mb_refresh"
COOKIE_PATH = "/api/v1/auth"  # the browser sends it to /auth/* only
CSRF_HEADER_VALUE = "mathbuddy"


class FailureLimiter:
    """Counts failures per key (here: client IP) in a sliding window, in memory.

    Per server instance only. Enough for link codes: a code has ~40 bits and lives
    10 minutes, so guessing is hopeless even across instances.
    """

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str) -> deque[float]:
        hits = self._hits[key]
        cutoff = time.monotonic() - self.window
        while hits and hits[0] < cutoff:
            hits.popleft()
        return hits

    def blocked(self, key: str) -> bool:
        return len(self._prune(key)) >= self.limit

    def record(self, key: str) -> None:
        self._prune(key).append(time.monotonic())

    def clear(self) -> None:
        self._hits.clear()


link_failures = FailureLimiter(limit=10, window_seconds=15 * 60)


# --- Helpers ----------------------------------------------------------------------


async def _for_parent(session, parent_id, children) -> list[ParentChildOut]:
    """Children as the parent sees them, with their linked-device counts."""
    counts = await linked_device_counts(session, parent_id)
    return [
        ParentChildOut(
            id=c.id,
            display_name=c.display_name,
            grade=c.grade,
            linked_devices=counts.get(c.id, 0),
        )
        for c in children
    ]


async def _parent_me(session, parent: Parent) -> ParentMe:
    children = await list_children(session, parent.id)
    return ParentMe(
        parent=ParentOut.model_validate(parent),
        children=await _for_parent(session, parent.id, children),
    )


def _device_out(device: AuthSession) -> DeviceOut:
    return DeviceOut(
        session_id=device.id,
        device_name=device.device_name,
        created_at=device.created_at,
        last_used_at=device.last_used_at,
    )


async def _me_for_session(session, auth_session: AuthSession) -> ParentMe | ChildMe:
    if auth_session.kind == "child":
        child = await get_child(
            session, auth_session.parent_id, auth_session.child_profile_id
        )
        return ChildMe(profile=ChildOut.model_validate(child))
    parent = await get_parent(session, auth_session.parent_id)
    return await _parent_me(session, parent)


async def _signed_in(
    session,
    response: Response,
    auth_session: AuthSession,
    refresh_token: str,
    client: Client,
) -> SignedIn:
    """Access token in the body; refresh token in a cookie (web) or the body (native)."""
    settings = get_settings()
    is_child = auth_session.kind == "child"
    access = issue_access_token(
        settings.jwt_secret,
        sub=auth_session.child_profile_id if is_child else auth_session.parent_id,
        kind=auth_session.kind,
        pid=auth_session.parent_id,
        sid=auth_session.id,
    )
    body = SignedIn(
        access_token=access,
        expires_in=int(ACCESS_TOKEN_TTL.total_seconds()),
        me=await _me_for_session(session, auth_session),
    )
    if client == "native":
        body.refresh_token = refresh_token
    else:
        response.set_cookie(
            COOKIE_NAME,
            refresh_token,
            max_age=int(IDLE_LIMIT[auth_session.kind].total_seconds()),
            path=COOKIE_PATH,
            secure=settings.cookie_secure,
            httponly=True,
            samesite="strict",
        )
    return body


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(
        COOKIE_NAME,
        path=COOKIE_PATH,
        secure=get_settings().cookie_secure,
        httponly=True,
        samesite="strict",
    )


def _presented_token(
    request: Request, data: RefreshIn | None, x_requested_with: str | None
) -> tuple[str | None, Client]:
    """The refresh token from the body (native) or the cookie (web).

    The cookie is sent by the browser automatically, so a cookie request must
    also prove it came from our own app (CSRF guard on top of SameSite=Strict).
    """
    if data is not None and data.refresh_token:
        return data.refresh_token, "native"
    token = request.cookies.get(COOKIE_NAME)
    if token:
        origin = request.headers.get("origin")
        if (
            x_requested_with != CSRF_HEADER_VALUE
            or origin not in get_settings().cors_origins_list
        ):
            raise HTTPException(status_code=403, detail="Forbidden")
    return token, "web"


def _not_signed_in(client: Client) -> JSONResponse:
    resp = JSONResponse(status_code=401, content={"detail": "Not signed in"})
    if client == "web":
        _clear_cookie(resp)
    return resp


def _require_configured() -> None:
    settings = get_settings()
    if not settings.google_client_ids_list or not settings.jwt_secret:
        raise HTTPException(status_code=503, detail="Sign-in is not configured.")


# --- Routes -----------------------------------------------------------------------


@router.post("/auth/google", response_model=SignedIn, response_model_exclude_none=True)
async def google_sign_in(
    data: GoogleSignIn, request: Request, response: Response, session: SessionDep
):
    """Sign in (or, the first time, sign up) a parent with a Google ID token."""
    _require_configured()
    settings = get_settings()
    try:
        user = await verify_google_id_token(
            data.id_token, settings.google_client_ids_list
        )
        parent = await sign_in_with_google(
            session, user, data.accepted_terms_version, settings.terms_version
        )
    except SignInFailed as exc:
        logger.warning("Google sign-in failed", extra={"reason": str(exc)})
        raise HTTPException(status_code=401, detail="Sign-in failed") from exc
    except ConsentRequired as exc:
        raise HTTPException(status_code=409, detail="consent_required") from exc

    auth_session, refresh_token = await start_session(
        session, parent, request.headers.get("user-agent")
    )
    return await _signed_in(session, response, auth_session, refresh_token, data.client)


@router.post("/auth/refresh", response_model=SignedIn, response_model_exclude_none=True)
async def refresh(
    request: Request,
    response: Response,
    session: SessionDep,
    data: RefreshIn | None = None,
    x_requested_with: Annotated[str | None, Header()] = None,
):
    """New access token and a new (rotated) refresh token. Web: cookie; native: body."""
    _require_configured()
    token, client = _presented_token(request, data, x_requested_with)
    if not token:
        return _not_signed_in(client)
    try:
        auth_session, new_token = await refresh_session(session, token)
    except RefreshRace:
        return JSONResponse(status_code=409, content={"detail": "refresh_race"})
    except RefreshFailed as exc:
        logger.warning("Refresh refused", extra={"reason": str(exc)})
        return _not_signed_in(client)

    try:
        return await _signed_in(session, response, auth_session, new_token, client)
    except ChildNotFound:
        logger.warning("Refresh refused: child no longer belongs to the parent")
        return _not_signed_in(client)


@router.post("/auth/logout", status_code=204)
async def logout(
    request: Request,
    session: SessionDep,
    data: RefreshIn | None = None,
    x_requested_with: Annotated[str | None, Header()] = None,
):
    """Sign this device out. Always 204, even for an unknown token."""
    token, client = _presented_token(request, data, x_requested_with)
    if token:
        await end_session(session, token)
    resp = Response(status_code=204)
    if client == "web":
        _clear_cookie(resp)
    return resp


@router.post("/auth/link", response_model=SignedIn, response_model_exclude_none=True)
async def link_device(
    data: LinkIn, request: Request, response: Response, session: SessionDep
):
    """A child's device signs in with the one-time code the parent made."""
    _require_configured()
    ip = request.client.host if request.client else "unknown"
    if link_failures.blocked(ip):
        raise HTTPException(
            status_code=429, detail="Too many tries. Wait a few minutes."
        )
    try:
        auth_session, refresh_token = await redeem_link_code(
            session, data.code, request.headers.get("user-agent"), data.device_name
        )
    except CodeNotValid as exc:
        link_failures.record(ip)
        logger.warning("Link code refused", extra={"reason": str(exc), "client": ip})
        raise HTTPException(status_code=401, detail="Code not valid") from exc
    return await _signed_in(session, response, auth_session, refresh_token, data.client)


@router.get("/me", response_model=Me)
async def who_am_i(claims: SignedInDep, session: SessionDep):
    """A parent with their children, or the child a linked device belongs to."""
    if claims.kind == "child":
        try:
            child = await get_child(session, claims.pid, claims.sub)
        except ChildNotFound as exc:
            raise HTTPException(status_code=401, detail="Not signed in") from exc
        return ChildMe(profile=ChildOut.model_validate(child))
    parent = await get_parent(session, claims.sub)
    if parent is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    return await _parent_me(session, parent)


@router.get("/children", response_model=list[ParentChildOut])
async def get_children(claims: ParentDep, session: SessionDep):
    """This parent's children, oldest first, with how many devices each has."""
    return await _for_parent(
        session, claims.sub, await list_children(session, claims.sub)
    )


@router.post("/children", response_model=ParentChildOut, status_code=201)
async def create_child(data: ChildCreate, claims: ParentDep, session: SessionDep):
    """Add a child: a name and a grade, nothing else."""
    child = await add_child(session, claims.sub, data)
    return (await _for_parent(session, claims.sub, [child]))[0]


@router.patch("/children/{child_id}", response_model=ParentChildOut)
async def change_child(
    child_id: uuid.UUID, data: ChildUpdate, claims: ParentDep, session: SessionDep
):
    """Rename a child or change their grade. Another parent's child is a 404."""
    try:
        child = await update_child(session, claims.sub, child_id, data)
    except ChildNotFound as exc:
        raise HTTPException(status_code=404, detail="Child not found") from exc
    return (await _for_parent(session, claims.sub, [child]))[0]


@router.post(
    "/children/{child_id}/link-codes", response_model=LinkCodeOut, status_code=201
)
async def make_link_code(child_id: uuid.UUID, claims: ParentDep, session: SessionDep):
    """A one-time code (10 minutes) for linking this child's device."""
    try:
        code, expires_at = await create_link_code(session, claims.sub, child_id)
    except ChildNotFound as exc:
        raise HTTPException(status_code=404, detail="Child not found") from exc
    except TooManyLinkCodes as exc:
        raise HTTPException(
            status_code=429, detail="Too many codes. Try again later."
        ) from exc
    return LinkCodeOut(code=code, expires_at=expires_at)


@router.delete("/children/{child_id}/link-codes", status_code=204)
async def cancel_codes(child_id: uuid.UUID, claims: ParentDep, session: SessionDep):
    """Stop this child's unused code from working (the parent closed the panel)."""
    try:
        await cancel_link_codes(session, claims.sub, child_id)
    except ChildNotFound as exc:
        raise HTTPException(status_code=404, detail="Child not found") from exc
    return Response(status_code=204)


# --- Linked devices ----------------------------------------------------------------


@router.get("/children/{child_id}/devices", response_model=list[DeviceOut])
async def get_devices(child_id: uuid.UUID, claims: ParentDep, session: SessionDep):
    """Devices signed in as this child, oldest first."""
    try:
        devices = await list_devices(session, claims.sub, child_id)
    except ChildNotFound as exc:
        raise HTTPException(status_code=404, detail="Child not found") from exc
    return [_device_out(d) for d in devices]


@router.patch("/devices/{session_id}", response_model=DeviceOut)
async def change_device(
    session_id: uuid.UUID, data: DeviceRename, claims: ParentDep, session: SessionDep
):
    """Rename a child's device, for example "Aarav's laptop"."""
    try:
        device = await rename_device(session, claims.sub, session_id, data.device_name)
    except DeviceNotFound as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc
    return _device_out(device)


@router.delete("/devices/{session_id}", status_code=204)
async def remove_device(session_id: uuid.UUID, claims: ParentDep, session: SessionDep):
    """Unlink a child's device: it is signed out at its next refresh."""
    try:
        await unlink_device(session, claims.sub, session_id)
    except DeviceNotFound as exc:
        raise HTTPException(status_code=404, detail="Device not found") from exc
    return Response(status_code=204)
