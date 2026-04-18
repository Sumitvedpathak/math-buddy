from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.integrations.openrouter import LLMServiceError
from app.schemas.evaluation import EvaluateAnswersRequest, EvaluateAnswersResponse
from app.services.evaluation_service import evaluate_answers

router = APIRouter()


@router.post("/answers/evaluate", response_model=EvaluateAnswersResponse)
async def evaluate_answers_endpoint(request: EvaluateAnswersRequest):
    """Evaluate student answers and return marks + feedback."""
    try:
        result = await evaluate_answers(request)
    except LLMServiceError as exc:
        return JSONResponse(
            status_code=503,
            content={"detail": f"Evaluation service unavailable: {exc}"},
        )
    return result
