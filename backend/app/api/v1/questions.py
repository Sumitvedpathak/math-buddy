from fastapi import APIRouter, HTTPException

from app.schemas.questions import GenerateQuestionsRequest, GenerateQuestionsResponse
from app.services.question_service import generate_questions
from app.integrations.openrouter import LLMServiceError

router = APIRouter()


@router.post("/questions/generate", response_model=GenerateQuestionsResponse)
async def generate_questions_endpoint(request: GenerateQuestionsRequest):
    try:
        return await generate_questions(request)
    except LLMServiceError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        ) from exc
