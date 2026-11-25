"""
Unit tests for question_service.py:
- A response missing a mandatory problem type is refused (when there are enough questions)
- Questions are sorted by difficulty_tier ascending
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.practice.question_service import generate_questions
from app.practice.schemas import GenerateQuestionsRequest


def _make_request(**kwargs):
    defaults = {
        "topics": ["Vedic Maths", "Algebra"],
        "age_group": "9-10",
        "question_count": 5,
    }
    defaults.update(kwargs)
    return GenerateQuestionsRequest(**defaults)


def _all_types_response(question_overrides=None):
    questions = [
        {
            "id": "id1",
            "topic": "Vedic Maths",
            "problem_type": "multiplication",
            "text": "13 × 17",
            "difficulty_tier": 3,
        },
        {"id": "id2", "topic": "Algebra", "problem_type": "division", "text": "144 ÷ 12", "difficulty_tier": 2},
        {"id": "id3", "topic": "Algebra", "problem_type": "fractions", "text": "3/6", "difficulty_tier": 1},
        {"id": "id4", "topic": "Algebra", "problem_type": "mixed_fractions", "text": "1½ + 2¼", "difficulty_tier": 4},
        {"id": "id5", "topic": "Algebra", "problem_type": "squares", "text": "7²", "difficulty_tier": 5},
    ]
    if question_overrides:
        questions = question_overrides
    return {"questions": questions, "fun_facts": [f"Fact {i}" for i in range(15)]}


@pytest.mark.asyncio
async def test_missing_mandatory_type_raises():
    """With at least 5 questions, all 5 problem types must be there; otherwise the reply is refused."""
    incomplete = _all_types_response()
    # Still 5 questions, but the "squares" one is now another fraction: no squares at all.
    incomplete["questions"][4] = {
        "id": "id5", "topic": "Algebra", "problem_type": "fractions", "text": "2/8", "difficulty_tier": 5
    }

    from app.core.llm import LLMServiceError
    with patch(
        "app.practice.question_service.call_llm",
        new=AsyncMock(return_value=incomplete),
    ):
        with pytest.raises(LLMServiceError):
            await generate_questions(_make_request())


@pytest.mark.asyncio
async def test_fewer_questions_than_types_need_not_cover_every_type():
    """With fewer than 5 questions they cannot all be there, so the check is skipped."""
    four = _all_types_response()
    four["questions"] = [q for q in four["questions"] if q["problem_type"] != "squares"]
    with patch(
        "app.practice.question_service.call_llm",
        new=AsyncMock(return_value=four),
    ):
        result = await generate_questions(_make_request(question_count=4))
    assert len(result.questions) == 4


@pytest.mark.asyncio
async def test_questions_sorted_by_difficulty():
    """generate_questions returns questions sorted ascending by difficulty_tier."""
    unsorted = _all_types_response()
    # Already unsorted in fixture (tiers: 3,2,1,4,5)

    with patch(
        "app.practice.question_service.call_llm",
        new=AsyncMock(return_value=unsorted),
    ):
        result = await generate_questions(_make_request())

    tiers = [q.difficulty_tier for q in result.questions]
    assert tiers == sorted(tiers), f"Expected sorted tiers, got: {tiers}"
