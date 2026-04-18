"""
Unit tests for evaluation_service.py:
- Score computation
- Topic breakdown
- Missing answers get 0 marks
"""

import pytest
from unittest.mock import AsyncMock, patch

from app.services.evaluation_service import evaluate_answers
from app.schemas.evaluation import EvaluateAnswersRequest
from app.schemas.questions import QuestionSchema


def _make_request(questions=None, answers=None):
    if questions is None:
        questions = [
            QuestionSchema(id="q1", topic="Algebra", problem_type="division", text="144÷12", difficulty_tier=1),
            QuestionSchema(id="q2", topic="Vedic Maths", problem_type="multiplication", text="13×17", difficulty_tier=2),
        ]
    if answers is None:
        answers = []
    return EvaluateAnswersRequest(questions=questions, answers=answers)


MOCK_LLM_RESULT = {
    "results": [
        {"question_id": "q1", "marks": 2, "feedback": "Great!"},
        {"question_id": "q2", "marks": 1, "feedback": "Nearly there!"},
    ]
}


@pytest.mark.asyncio
async def test_total_score_computed_correctly():
    with patch("app.services.evaluation_service.call_llm", new=AsyncMock(return_value=MOCK_LLM_RESULT)):
        result = await evaluate_answers(_make_request())
    assert result.total_score == 3
    assert result.max_score == 4


@pytest.mark.asyncio
async def test_topic_breakdown_keys():
    with patch("app.services.evaluation_service.call_llm", new=AsyncMock(return_value=MOCK_LLM_RESULT)):
        result = await evaluate_answers(_make_request())
    assert "Algebra" in result.topic_breakdown
    assert "Vedic Maths" in result.topic_breakdown


@pytest.mark.asyncio
async def test_missing_answer_scores_zero():
    """Question with no submitted answer gets 0 marks when LLM omits it."""
    partial_llm = {"results": [{"question_id": "q1", "marks": 2, "feedback": "Correct!"}]}
    with patch("app.services.evaluation_service.call_llm", new=AsyncMock(return_value=partial_llm)):
        result = await evaluate_answers(_make_request())
    q2_result = next(r for r in result.results if r.question_id == "q2")
    assert q2_result.marks == 0


@pytest.mark.asyncio
async def test_results_length_matches_questions():
    with patch("app.services.evaluation_service.call_llm", new=AsyncMock(return_value=MOCK_LLM_RESULT)):
        result = await evaluate_answers(_make_request())
    assert len(result.results) == 2
