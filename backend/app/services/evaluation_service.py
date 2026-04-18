"""
Evaluation service: calls the LLM to mark student answers,
computes total score and per-topic breakdown.
"""

import logging
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader
from pydantic import ValidationError

from app.integrations.openrouter import call_llm, LLMServiceError
from app.schemas.evaluation import (
    EvaluateAnswersRequest,
    EvaluateAnswersResponse,
    QuestionResultSchema,
    TopicScoreSchema,
    AnswerSchema,
)
from app.schemas.questions import QuestionSchema

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent.parent.parent / "prompts"
_jinja_env = Environment(loader=FileSystemLoader(str(PROMPTS_DIR)))

MAX_MARKS_PER_QUESTION = 2


def _build_items(
    questions: list[QuestionSchema],
    answers: list[AnswerSchema],
) -> list[dict]:
    """Zip questions with their answers (None if not answered)."""
    answer_map = {a.question_id: a for a in answers}
    return [
        {"question": q, "answer": answer_map.get(q.id)}
        for q in questions
    ]


def _parse_llm_results(
    raw: dict,
    questions: list[QuestionSchema],
) -> list[QuestionResultSchema]:
    """
    Parse the LLM response dict into a list of QuestionResultSchema.
    Fills in 0-mark results for any questions not returned by the LLM.
    """
    raw_results = raw.get("results", [])
    result_map: dict[str, QuestionResultSchema] = {}
    for item in raw_results:
        try:
            r = QuestionResultSchema.model_validate(item)
            result_map[r.question_id] = r
        except (ValidationError, KeyError) as exc:
            logger.warning(
                "Skipping malformed result item from LLM response",
                extra={"item": item, "error": str(exc)},
            )

    results = []
    for q in questions:
        if q.id in result_map:
            results.append(result_map[q.id])
        else:
            results.append(
                QuestionResultSchema(
                    question_id=q.id,
                    marks=0,
                    feedback="No answer was submitted for this question.",
                )
            )
    return results


def _compute_totals(
    results: list[QuestionResultSchema],
    questions: list[QuestionSchema],
) -> tuple[int, int, dict[str, TopicScoreSchema]]:
    """Compute total_score, max_score, and per-topic breakdown."""
    question_map = {q.id: q for q in questions}
    topic_buckets: dict[str, dict] = {}

    for r in results:
        q = question_map.get(r.question_id)
        topic = q.topic if q else "Unknown"
        if topic not in topic_buckets:
            topic_buckets[topic] = {"score": 0, "max_score": 0, "question_count": 0}
        topic_buckets[topic]["score"] += r.marks
        topic_buckets[topic]["max_score"] += MAX_MARKS_PER_QUESTION
        topic_buckets[topic]["question_count"] += 1

    total_score = sum(r.marks for r in results)
    max_score = len(results) * MAX_MARKS_PER_QUESTION
    topic_breakdown = {
        topic: TopicScoreSchema(**data) for topic, data in topic_buckets.items()
    }
    return total_score, max_score, topic_breakdown


async def evaluate_answers(
    request: EvaluateAnswersRequest,
) -> EvaluateAnswersResponse:
    """
    Render the evaluation prompt, call the LLM (with vision for sketch answers), parse results.

    Raises:
        LLMServiceError: On LLM failure or unrecoverable parse error.
    """
    template = _jinja_env.get_template("evaluate_answers.txt")
    items = _build_items(request.questions, request.answers)
    prompt = template.render(
        items=items,
        age_group="9-12",
    )

    # Collect sketch images to pass as vision content
    sketch_images = [
        item["answer"].content
        for item in items
        if item["answer"] is not None
        and item["answer"].mode == "sketch"
        and item["answer"].content.startswith("data:image/")
    ]

    logger.info(
        "Evaluation started",
        extra={
            "question_count": len(request.questions),
            "sketch_image_count": len(sketch_images),
            "text_answer_count": sum(
                1 for item in items
                if item["answer"] is not None and item["answer"].mode == "text"
            ),
            "unanswered_count": sum(1 for item in items if item["answer"] is None),
            "prompt_chars": len(prompt),
        },
    )

    try:
        raw = await call_llm(prompt, images=sketch_images if sketch_images else None)
    except LLMServiceError:
        logger.error(
            "Evaluation failed — LLM call unsuccessful",
            extra={"question_count": len(request.questions)},
        )
        raise

    results = _parse_llm_results(raw, request.questions)
    total_score, max_score, topic_breakdown = _compute_totals(results, request.questions)

    logger.info(
        "Evaluation completed",
        extra={
            "total_score": total_score,
            "max_score": max_score,
            "pct": round(total_score / max_score * 100, 1) if max_score else 0,
        },
    )

    return EvaluateAnswersResponse(
        results=results,
        total_score=total_score,
        max_score=max_score,
        topic_breakdown=topic_breakdown,
    )
