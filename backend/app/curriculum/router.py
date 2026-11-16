from fastapi import APIRouter

from app.curriculum.schemas import CurriculumResponse
from app.curriculum.service import get_curriculum
from app.profiles.schemas import Grade

router = APIRouter(tags=["curriculum"])


@router.get("/curriculum", response_model=CurriculumResponse)
async def get_curriculum_endpoint(grade: Grade | None = None):
    """Static unit/lesson content, optionally filtered by grade."""
    return get_curriculum(grade)
