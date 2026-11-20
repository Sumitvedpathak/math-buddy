"""Account: sign-in, staying signed in, signing out, "who am I", and children."""

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse

from app.account.models import AuthSession, Parent
from app.account.schemas import (
    ChildCreate,
    ChildOut,
    ChildUpdate,
    Client,
    GoogleSignIn,
    ParentMe,
    ParentOut,
    RefreshIn,
    SignedIn,
)
from app.account.service import (
    IDLE_LIMIT,
    ChildNotFound,
    ConsentRequired,
    RefreshFailed,
    RefreshRace,
    SignInFailed,
    add_child,
    end_session,
    get_parent,
    list_children,
    refresh_session,
    sign_in_with_google,
    start_session,
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


# --- Helpers ----------------------------------------------------------------------


async def _parent_me(session, parent: Parent) -> ParentMe:
    children = await list_children(session, parent.id)
    return ParentMe(
        parent=ParentOut.model_validate(parent),
        children=[ChildOut.model_validate(c) for c in children],
    )


async def _signed_in(
    session,
    response: Response,
    auth_session: AuthSession,
    parent: Parent,
    refresh_token: str,
    client: Client,
) -> SignedIn:
    """Access token in the body; refresh token in a cookie (web) or the body (native)."""
    settings = get_settings()
    access = issue_access_token(
        settings.jwt_secret,
        sub=parent.id,
        kind="parent",
        pid=parent.id,
        sid=auth_session.id,
    )
    body = SignedIn(
        access_token=access,
        expires_in=int(ACCESS_TOKEN_TTL.total_seconds()),
        me=await _parent_me(session, parent),
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
    return await _signed_in(
        session, response, auth_session, parent, refresh_token, data.client
    )


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

    parent = await get_parent(session, auth_session.parent_id)
    return await _signed_in(session, response, auth_session, parent, new_token, client)


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


@router.get("/me", response_model=ParentMe)
async def who_am_i(claims: SignedInDep, session: SessionDep):
    """The signed-in parent with their children. (A child's device: a later step.)"""
    parent = await get_parent(session, claims.sub) if claims.kind == "parent" else None
    if parent is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    return await _parent_me(session, parent)


@router.get("/children", response_model=list[ChildOut])
async def get_children(claims: ParentDep, session: SessionDep):
    """This parent's children, oldest first."""
    return await list_children(session, claims.sub)


@router.post("/children", response_model=ChildOut, status_code=201)
async def create_child(data: ChildCreate, claims: ParentDep, session: SessionDep):
    """Add a child: a name and a grade, nothing else."""
    return await add_child(session, claims.sub, data)


@router.patch("/children/{child_id}", response_model=ChildOut)
async def change_child(
    child_id: uuid.UUID, data: ChildUpdate, claims: ParentDep, session: SessionDep
):
    """Rename a child or change their grade. Another parent's child is a 404."""
    try:
        return await update_child(session, claims.sub, child_id, data)
    except ChildNotFound as exc:
        raise HTTPException(status_code=404, detail="Child not found") from exc
