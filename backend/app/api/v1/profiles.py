import logging
import uuid

from fastapi import APIRouter, HTTPException, Query

from app.api.deps import SessionDep
from app.schemas.profiles import (
    LessonStatus,
    ProfileCreate,
    ProfileLookupResponse,
    ProfileOut,
    normalize_email,
)
from app.services import profile_service
from app.services.profile_service import ProfileExistsError, ProfileNotFoundError

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.get("/profiles/{profile_id}/lesson-status", response_model=list[LessonStatus])
async def get_lesson_status(profile_id: uuid.UUID, session: SessionDep):
    """Current state per attempted lesson. Lessons never attempted are simply absent."""
    try:
        await profile_service.require_profile(session, profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Profile not found") from exc
    rows = await profile_service.list_lesson_progress(session, profile_id)
    return [LessonStatus.model_validate(r) for r in rows]
