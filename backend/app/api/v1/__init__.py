from fastapi import APIRouter

from app.api.v1.questions import router as questions_router
from app.api.v1.evaluate import router as evaluate_router

router = APIRouter()
router.include_router(questions_router)
router.include_router(evaluate_router)
