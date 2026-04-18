import logging

from fastapi import APIRouter, HTTPException

from app.integrations.openrouter import LLMServiceError
from app.schemas.evaluation import EvaluateAnswersRequest, EvaluateAnswersResponse
from app.services.evaluation_service import evaluate_answers

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/answers/evaluate", response_model=EvaluateAnswersResponse)
async def evaluate_answers_endpoint(request: EvaluateAnswersRequest):
    """Evaluate student answers and return marks + feedback."""
    logger.info(
        "Evaluate answers request received",
        extra={"question_count": len(request.questions), "answer_count": len(request.answers)},
    )
    try:
        return await evaluate_answers(request)
    except LLMServiceError as exc:
        logger.error(
            "Evaluate answers endpoint returning 503",
            extra={"error": str(exc)},
        )
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
