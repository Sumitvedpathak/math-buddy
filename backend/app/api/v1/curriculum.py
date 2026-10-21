from fastapi import APIRouter

from app.schemas.curriculum import CurriculumResponse
from app.schemas.profiles import Grade
from app.services.curriculum_service import get_curriculum

router = APIRouter()


@router.get("/curriculum", response_model=CurriculumResponse)
async def get_curriculum_endpoint(grade: Grade | None = None):
    """Static unit/lesson content, optionally filtered by grade."""
    return get_curriculum(grade)
