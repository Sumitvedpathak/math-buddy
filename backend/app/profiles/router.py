import logging

from fastapi import APIRouter, HTTPException, Query

from app.core.deps import SessionDep
from app.profiles import service as profile_service
from app.profiles.schemas import (
    ProfileCreate,
    ProfileLookupResponse,
    ProfileOut,
    normalize_email,
)
from app.profiles.service import ProfileExistsError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["profiles"])


@router.get("/profiles/lookup", response_model=ProfileLookupResponse)
async def lookup_profile(session: SessionDep, email: str = Query(...)):
    """Read-only existence check — never creates a profile."""
    try:
        normalized = normalize_email(email)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    profile = await profile_service.find_by_email(session, normalized)
    if profile is None:
        return ProfileLookupResponse(exists=False)
    return ProfileLookupResponse(exists=True, profile=ProfileOut.model_validate(profile))


@router.post("/profiles", response_model=ProfileOut, status_code=201)
async def create_profile(data: ProfileCreate, session: SessionDep):
    try:
        return await profile_service.create_profile(session, data)
    except ProfileExistsError as exc:
        raise HTTPException(
            status_code=409, detail="A profile with this email already exists."
        ) from exc

