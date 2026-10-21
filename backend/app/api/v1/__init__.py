from fastapi import APIRouter

from app.api.v1.questions import router as questions_router
from app.api.v1.evaluate import router as evaluate_router
from app.api.v1.profiles import router as profiles_router
from app.api.v1.curriculum import router as curriculum_router
from app.api.v1.attempts import router as attempts_router
from app.api.v1.admin import router as admin_router

router = APIRouter()
router.include_router(questions_router)
router.include_router(evaluate_router)
router.include_router(profiles_router)
router.include_router(curriculum_router)
router.include_router(attempts_router)
router.include_router(admin_router)
