"""Account: sign-in and "who am I"."""

import logging

from fastapi import APIRouter, HTTPException

from app.account.schemas import GoogleSignIn, ParentMe, ParentOut, SignedIn
from app.account.service import (
    ConsentRequired,
    SignInFailed,
    get_parent,
    sign_in_with_google,
    verify_google_id_token,
)
from app.account.tokens import ACCESS_TOKEN_TTL, issue_access_token
from app.core.config import get_settings
from app.core.deps import SessionDep, SignedInDep

logger = logging.getLogger(__name__)
router = APIRouter(tags=["account"])


@router.post("/auth/google", response_model=SignedIn)
async def google_sign_in(data: GoogleSignIn, session: SessionDep):
    """Sign in (or, the first time, sign up) a parent with a Google ID token."""
    settings = get_settings()
    if not settings.google_client_ids_list or not settings.jwt_secret:
        raise HTTPException(status_code=503, detail="Sign-in is not configured.")
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

    token = issue_access_token(
        settings.jwt_secret, sub=parent.id, kind="parent", pid=parent.id
    )
    return SignedIn(
        access_token=token,
        expires_in=int(ACCESS_TOKEN_TTL.total_seconds()),
        me=ParentMe(parent=ParentOut.model_validate(parent)),
    )


@router.get("/me", response_model=ParentMe)
async def who_am_i(claims: SignedInDep, session: SessionDep):
    """The signed-in parent. (Children are added in a later step.)"""
    parent = await get_parent(session, claims.sub) if claims.kind == "parent" else None
    if parent is None:
        raise HTTPException(status_code=401, detail="Not signed in")
    return ParentMe(parent=ParentOut.model_validate(parent))
