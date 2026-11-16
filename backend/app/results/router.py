"""Results: save a finished practice and read a child's lesson progress."""

import logging
import uuid

from fastapi import APIRouter, HTTPException

from app.core.deps import SessionDep
from app.curriculum.service import UnknownLessonError
from app.profiles.service import ProfileNotFoundError, require_profile
from app.results.schemas import AttemptCreate, AttemptSaved, LessonStatus
from app.results.service import is_mastered, list_lesson_progress, save_attempt

logger = logging.getLogger(__name__)
router = APIRouter(tags=["results"])


@router.post("/attempts", response_model=AttemptSaved, status_code=201)
async def save_attempt_endpoint(data: AttemptCreate, session: SessionDep):
    """Persist one practice attempt; curriculum attempts also update lesson progress."""
    try:
        attempt, pct, progress = await save_attempt(session, data)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Profile not found") from exc
    except UnknownLessonError as exc:
        raise HTTPException(
            status_code=422, detail=f"Unknown lesson_id: {data.lesson_id}"
        ) from exc
    return AttemptSaved(
        attempt_id=attempt.id,
        score_pct=pct,
        mastered=data.mode == "curriculum" and is_mastered(pct),
        lesson=LessonStatus.model_validate(progress) if progress else None,
    )


@router.get("/profiles/{profile_id}/lesson-status", response_model=list[LessonStatus])
async def get_lesson_status(profile_id: uuid.UUID, session: SessionDep):
    """Current state per attempted lesson. Lessons never attempted are simply absent."""
    try:
        await require_profile(session, profile_id)
    except ProfileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Profile not found") from exc
    rows = await list_lesson_progress(session, profile_id)
    return [LessonStatus.model_validate(r) for r in rows]
