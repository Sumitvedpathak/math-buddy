import logging
import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from pydantic import ValidationError

from app.integrations.openrouter import call_llm, LLMServiceError
from app.schemas.questions import GenerateQuestionsRequest, GenerateQuestionsResponse

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"
_jinja_env = Environment(loader=FileSystemLoader(str(PROMPTS_DIR)))

MANDATORY_TYPES = {
    "multiplication",
    "division",
    "fractions",
    "mixed_fractions",
    "squares",
}

# Vedic Maths pattern: Teen × Teen, Teen × ReverseTeen, ReverseTeen × Teen, ReverseTeen × ReverseTeen
# Teen: 11–19; ReverseTeen: 11, 21, 31, 41, 51, 61, 71, 81, 91
_TEEN = r"(?:1[1-9])"
_REVERSE_TEEN = r"(?:[1-9]1)"
_VEDIC_PATTERN = re.compile(
    rf"({_TEEN}|{_REVERSE_TEEN})\s*[×x\*]\s*({_TEEN}|{_REVERSE_TEEN})",
    re.IGNORECASE,
)

FUN_FACTS_COUNT = 15
MAX_RETRIES = 2


def _validate_vedic(question_text: str) -> bool:
    return bool(_VEDIC_PATTERN.search(question_text))


def _validate_response(data: dict) -> GenerateQuestionsResponse:
    """Parse and validate the LLM response dict. Raises ValueError on failure."""
    try:
        response = GenerateQuestionsResponse.model_validate(data)
    except ValidationError as exc:
        logger.warning(
            "LLM response failed Pydantic validation",
            extra={"validation_errors": str(exc)},
        )
        raise ValueError(f"LLM response failed Pydantic validation: {exc}") from exc

    present_types = {q.problem_type for q in response.questions}
    missing = MANDATORY_TYPES - present_types
    # Only enforce all 5 types when enough questions were requested to accommodate them
    if missing and len(response.questions) >= len(MANDATORY_TYPES):
        logger.warning(
            "LLM response missing mandatory problem types",
            extra={"missing_types": list(missing), "present_types": list(present_types)},
        )
        raise ValueError(f"LLM response missing mandatory problem types: {missing}")

    return response


async def generate_questions(
    request: GenerateQuestionsRequest,
) -> GenerateQuestionsResponse:
    """
    Render the generation prompt, call the LLM, validate and sort the response.
    Retries up to MAX_RETRIES times on validation failure.

    Raises:
        LLMServiceError: If the LLM call fails on all attempts.
        ValueError: If validation consistently fails (should not reach caller normally).
    """
    template = _jinja_env.get_template("generate_questions.txt")
    prompt = template.render(
        topics=request.topics,
        age_group=request.age_group,
        question_count=request.question_count,
        facts_count=FUN_FACTS_COUNT,
    )

    logger.info(
        "Question generation started",
        extra={
            "topics": request.topics,
            "age_group": request.age_group,
            "question_count": request.question_count,
            "prompt_chars": len(prompt),
        },
    )

    last_error: Exception | None = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            if attempt > 0:
                logger.info(
                    "Retrying question generation",
                    extra={"attempt": attempt + 1, "max_attempts": MAX_RETRIES + 1},
                )
            raw = await call_llm(prompt)
            response = _validate_response(raw)
            # Sort by difficulty_tier ascending
            response.questions.sort(key=lambda q: q.difficulty_tier)
            logger.info(
                "Question generation succeeded",
                extra={
                    "question_count": len(response.questions),
                    "fact_count": len(getattr(response, "fun_facts", []) or []),
                    "attempt": attempt + 1,
                },
            )
            return response
        except (ValueError, LLMServiceError) as exc:
            last_error = exc
            if isinstance(exc, LLMServiceError):
                # Don't retry on hard LLM failures (network/auth/model-not-found)
                logger.error(
                    "Question generation aborted — hard LLM failure, not retrying",
                    extra={"error": str(exc)},
                )
                break
            logger.warning(
                "Question generation validation failed, will retry",
                extra={"attempt": attempt + 1, "error": str(exc)},
            )

    final_msg = f"Question generation failed after {MAX_RETRIES + 1} attempt(s): {last_error}"
    logger.error(final_msg)
    raise LLMServiceError(final_msg) from last_error
