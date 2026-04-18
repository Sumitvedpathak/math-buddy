"""
Unit tests for question_service.py:
- Validates that missing mandatory problem types raise ValueError
- Validates Vedic Maths pattern enforcement
- Validates that questions are sorted by difficulty_tier ascending
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.question_service import generate_questions, _validate_vedic
from app.schemas.questions import GenerateQuestionsRequest


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
        {"id": "id1", "topic": "Vedic Maths", "problem_type": "multiplication", "text": "13 × 17", "difficulty_tier": 3},
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
    """question_service raises LLMServiceError when a mandatory type is absent."""
    incomplete = _all_types_response()
    # Remove all "squares" type questions
    incomplete["questions"] = [q for q in incomplete["questions"] if q["problem_type"] != "squares"]

    from app.integrations.openrouter import LLMServiceError
    with patch(
        "app.services.question_service.call_llm",
        new=AsyncMock(return_value=incomplete),
    ):
        with pytest.raises(LLMServiceError):
            await generate_questions(_make_request())


@pytest.mark.asyncio
async def test_invalid_vedic_pattern_raises():
    """question_service raises LLMServiceError when a Vedic Maths question has invalid operands."""
    invalid = _all_types_response()
    # Replace the Vedic Maths question with an invalid one (25 is not Teen/ReverseTeen)
    invalid["questions"][0] = {
        "id": "id1", "topic": "Vedic Maths", "problem_type": "multiplication",
        "text": "12 × 25", "difficulty_tier": 3
    }

    from app.integrations.openrouter import LLMServiceError
    with patch(
        "app.services.question_service.call_llm",
        new=AsyncMock(return_value=invalid),
    ):
        with pytest.raises(LLMServiceError):
            await generate_questions(_make_request())


@pytest.mark.asyncio
async def test_questions_sorted_by_difficulty():
    """generate_questions returns questions sorted ascending by difficulty_tier."""
    unsorted = _all_types_response()
    # Already unsorted in fixture (tiers: 3,2,1,4,5)

    with patch(
        "app.services.question_service.call_llm",
        new=AsyncMock(return_value=unsorted),
    ):
        result = await generate_questions(_make_request())

    tiers = [q.difficulty_tier for q in result.questions]
    assert tiers == sorted(tiers), f"Expected sorted tiers, got: {tiers}"


def test_valid_vedic_patterns():
    """_validate_vedic accepts all four valid Vedic patterns."""
    assert _validate_vedic("13 × 17")   # Teen × Teen
    assert _validate_vedic("15 × 31")   # Teen × ReverseTeen
    assert _validate_vedic("21 × 14")   # ReverseTeen × Teen
    assert _validate_vedic("31 × 41")   # ReverseTeen × ReverseTeen


def test_invalid_vedic_patterns():
    """_validate_vedic rejects operands that are not Teen or ReverseTeen."""
    assert not _validate_vedic("12 × 25")
    assert not _validate_vedic("20 × 30")
    assert not _validate_vedic("5 × 7")
