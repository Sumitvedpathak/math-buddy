"""
Contract tests: verify the API response bodies match their documented JSON schemas.
These tests run against the FastAPI TestClient with mocked OpenRouter calls.
"""

import json
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


MOCK_QUESTIONS_RESPONSE = {
    "questions": [
        {
            "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "topic": "Vedic Maths",
            "problem_type": "multiplication",
            "text": "Calculate: 13 × 17",
            "difficulty_tier": 1,
        },
        {
            "id": "7bc91e32-1234-4ab2-c5de-6f78901bcd23",
            "topic": "Algebra",
            "problem_type": "division",
            "text": "Divide: 144 ÷ 12",
            "difficulty_tier": 2,
        },
        {
            "id": "aaa00001-0000-0000-0000-000000000001",
            "topic": "Algebra",
            "problem_type": "fractions",
            "text": "Simplify: 3/6",
            "difficulty_tier": 3,
        },
        {
            "id": "aaa00002-0000-0000-0000-000000000002",
            "topic": "Algebra",
            "problem_type": "mixed_fractions",
            "text": "Add: 1½ + 2¼",
            "difficulty_tier": 4,
        },
        {
            "id": "aaa00003-0000-0000-0000-000000000003",
            "topic": "Algebra",
            "problem_type": "squares",
            "text": "Calculate: 7²",
            "difficulty_tier": 5,
        },
    ],
    "fun_facts": [f"Fact {i}" for i in range(15)],
}


MOCK_EVALUATE_RESPONSE = {
    "results": [
        {
            "question_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
            "marks": 2,
            "feedback": "Great work!",
        }
    ],
    "total_score": 2,
    "max_score": 2,
    "topic_breakdown": {
        "Vedic Maths": {"score": 2, "max_score": 2, "question_count": 1}
    },
}


@pytest.mark.asyncio
async def test_generate_questions_response_schema():
    """Response body matches GenerateQuestionsResponse schema."""
    with patch(
        "app.services.question_service.call_llm",
        new=AsyncMock(return_value=MOCK_QUESTIONS_RESPONSE),
    ):
        response = client.post(
            "/api/v1/questions/generate",
            json={"topics": ["Vedic Maths", "Algebra"], "age_group": "9-10", "question_count": 5},
        )
    assert response.status_code == 200
    body = response.json()
    assert "questions" in body
    assert "fun_facts" in body
    assert len(body["questions"]) > 0
    assert len(body["fun_facts"]) >= 10
    q = body["questions"][0]
    for field in ("id", "topic", "problem_type", "text", "difficulty_tier"):
        assert field in q, f"Missing field: {field}"


@pytest.mark.asyncio
async def test_evaluate_answers_response_schema():
    """Response body matches EvaluateAnswersResponse schema."""
    questions = MOCK_QUESTIONS_RESPONSE["questions"][:1]
    answers = [
        {
            "question_id": questions[0]["id"],
            "mode": "text",
            "content": "221",
        }
    ]
    with patch(
        "app.services.evaluation_service.call_llm",
        new=AsyncMock(return_value={
            "results": [
                {"question_id": questions[0]["id"], "marks": 2, "feedback": "Correct!"}
            ]
        }),
    ):
        response = client.post(
            "/api/v1/answers/evaluate",
            json={"questions": questions, "answers": answers},
        )
    assert response.status_code == 200
    body = response.json()
    assert "results" in body
    assert "total_score" in body
    assert "max_score" in body
    assert "topic_breakdown" in body
    assert body["total_score"] <= body["max_score"]
    assert len(body["results"]) == len(questions)
