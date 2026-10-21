import logging

from fastapi import APIRouter, HTTPException

from app.schemas.questions import GenerateQuestionsRequest, GenerateQuestionsResponse
from app.services.curriculum_service import UnknownLessonError
from app.services.question_service import generate_questions
from app.integrations.openrouter import LLMServiceError

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/questions/generate", response_model=GenerateQuestionsResponse)
async def generate_questions_endpoint(request: GenerateQuestionsRequest):
    logger.info(
        "Generate questions request received",
        extra={
            "topics": request.topics,
            "age_group": request.age_group,
            "question_count": request.question_count,
        },
    )
    try:
        return await generate_questions(request)
    except UnknownLessonError as exc:
        raise HTTPException(
            status_code=422, detail=f"Unknown lesson_id: {request.lesson_id}"
        ) from exc
    except LLMServiceError as exc:
        logger.error(
            "Generate questions endpoint returning 503",
            extra={"error": str(exc)},
        )
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
