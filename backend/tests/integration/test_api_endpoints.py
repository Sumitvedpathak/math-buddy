"""
Integration tests: POST /api/v1/questions/generate with mocked OpenRouter.
Verifies the full request→service→response pipeline.
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


GOOD_LLM_RESPONSE = {
    "questions": [
        {"id": "id1", "topic": "Vedic Maths", "problem_type": "multiplication", "text": "13 × 17", "difficulty_tier": 1},
        {"id": "id2", "topic": "Algebra", "problem_type": "division", "text": "144 ÷ 12", "difficulty_tier": 2},
        {"id": "id3", "topic": "Algebra", "problem_type": "fractions", "text": "3/6", "difficulty_tier": 3},
        {"id": "id4", "topic": "Algebra", "problem_type": "mixed_fractions", "text": "1½ + 2¼", "difficulty_tier": 4},
        {"id": "id5", "topic": "Algebra", "problem_type": "squares", "text": "7²", "difficulty_tier": 5},
    ],
    "fun_facts": [f"Fact {i}" for i in range(15)],
}


@pytest.mark.asyncio
async def test_generate_questions_success():
    """Full pipeline returns 200 with correct structure when LLM responds correctly."""
    with patch(
        "app.services.question_service.call_llm",
        new=AsyncMock(return_value=GOOD_LLM_RESPONSE),
    ):
        resp = client.post(
            "/api/v1/questions/generate",
            json={"topics": ["Vedic Maths", "Algebra"], "age_group": "9-10", "question_count": 5},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["questions"]) == 5
    assert len(body["fun_facts"]) == 15
    # Verify ascending difficulty ordering
    tiers = [q["difficulty_tier"] for q in body["questions"]]
    assert tiers == sorted(tiers)


@pytest.mark.asyncio
async def test_generate_questions_llm_error_returns_503():
    """Service layer failure returns HTTP 503."""
    from app.integrations.openrouter import LLMServiceError
    with patch(
        "app.services.question_service.call_llm",
        new=AsyncMock(side_effect=LLMServiceError("connection error")),
    ):
        resp = client.post(
            "/api/v1/questions/generate",
            json={"topics": ["Vedic Maths"], "age_group": "11-12", "question_count": 5},
        )
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_generate_questions_missing_required_field_returns_422():
    """Missing required body field returns HTTP 422 Unprocessable Entity."""
    resp = client.post(
        "/api/v1/questions/generate",
        json={"topics": ["Vedic Maths"]},  # age_group missing
    )
    assert resp.status_code == 422
