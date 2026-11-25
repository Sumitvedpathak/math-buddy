"""Results: save a finished practice and read the child's lesson progress.

Both are for a signed-in child; the child always comes from the access token."""

import logging

from fastapi import APIRouter, HTTPException

from app.core.deps import ChildProfileDep, SessionDep
from app.curriculum.service import UnknownLessonError
from app.results.schemas import AttemptCreate, AttemptSaved, LessonStatus
from app.results.service import is_mastered, list_lesson_progress, save_attempt

logger = logging.getLogger(__name__)
router = APIRouter(tags=["results"])


@router.post("/attempts", response_model=AttemptSaved, status_code=201)
async def save_attempt_endpoint(
    data: AttemptCreate, child: ChildProfileDep, session: SessionDep
):
    """Persist one practice attempt; curriculum attempts also update lesson progress."""
    try:
        attempt, pct, progress = await save_attempt(session, child.id, data)
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


@router.get("/me/lesson-status", response_model=list[LessonStatus])
async def get_lesson_status(child: ChildProfileDep, session: SessionDep):
    """Current state per attempted lesson. Lessons never attempted are simply absent."""
    rows = await list_lesson_progress(session, child.id)
    return [LessonStatus.model_validate(r) for r in rows]
