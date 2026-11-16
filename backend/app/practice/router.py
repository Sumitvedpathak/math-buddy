"""Practice: generate questions and mark answers. Both call the LLM."""

import logging

from fastapi import APIRouter, HTTPException

from app.core.llm import LLMServiceError
from app.curriculum.service import UnknownLessonError
from app.practice.evaluation_service import evaluate_answers
from app.practice.question_service import generate_questions
from app.practice.schemas import (
    EvaluateAnswersRequest,
    EvaluateAnswersResponse,
    GenerateQuestionsRequest,
    GenerateQuestionsResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["practice"])


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
        logger.error("Generate questions endpoint returning 503", extra={"error": str(exc)})
        raise HTTPException(status_code=503, detail=str(exc)) from exc


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
        logger.error("Evaluate answers endpoint returning 503", extra={"error": str(exc)})
        raise HTTPException(status_code=503, detail=str(exc)) from exc
