import logging

from fastapi import APIRouter, HTTPException

from app.api.deps import SessionDep
from app.schemas.attempts import AttemptCreate, AttemptSaved
from app.schemas.profiles import LessonStatus
from app.services.attempt_service import (
    ProfileNotFoundError,
    UnknownLessonError,
    is_mastered,
    save_attempt,
)

logger = logging.getLogger(__name__)
router = APIRouter()


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
