from fastapi import APIRouter, Depends

from app.core.deps import require_signed_in
from app.curriculum.schemas import CurriculumResponse
from app.curriculum.service import get_curriculum
from app.profiles.schemas import Grade

# Any signed-in parent or child.
router = APIRouter(tags=["curriculum"], dependencies=[Depends(require_signed_in)])


@router.get("/curriculum", response_model=CurriculumResponse)
async def get_curriculum_endpoint(grade: Grade | None = None):
    """Static unit/lesson content, optionally filtered by grade."""
    return get_curriculum(grade)
