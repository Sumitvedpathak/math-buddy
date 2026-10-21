"""A model failure becomes a 503 with a kid-safe message on both LLM endpoints."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
from openai import RateLimitError

from app.integrations import langchainrouter as router
from app.integrations.langchainrouter import BUSY_MESSAGE, LLMServiceError

GENERATE = {"topics": ["Geometry"], "age_group": "11-12", "question_count": 5, "lesson_id": "7.1"}
EVALUATE = {
    "questions": [
        {"id": "q1", "topic": "Geometry", "problem_type": "lesson", "text": "2 + 2", "difficulty_tier": 1}
    ],
    "answers": [{"question_id": "q1", "mode": "text", "content": "4"}],
}


def _rate_limited_model():
    request = httpx.Request("POST", "https://openrouter.ai/api/v1")
    exc = RateLimitError("429 from provider", response=httpx.Response(429, request=request), body=None)
    return SimpleNamespace(ainvoke=AsyncMock(side_effect=exc))


async def test_generate_rate_limit_is_a_503_with_a_friendly_message(client):
    with patch.object(router, "_get_model", return_value=_rate_limited_model()):
        resp = await client.post("/api/v1/questions/generate", json=GENERATE)
    assert resp.status_code == 503
    assert resp.json()["detail"] == BUSY_MESSAGE


async def test_evaluate_rate_limit_is_a_503_with_a_friendly_message(client):
    with patch.object(router, "_get_model", return_value=_rate_limited_model()):
        resp = await client.post("/api/v1/answers/evaluate", json=EVALUATE)
    assert resp.status_code == 503
    assert resp.json()["detail"] == BUSY_MESSAGE


async def test_generate_service_error_message_is_passed_through(client):
    with patch(
        "app.services.question_service.call_llm",
        new=AsyncMock(side_effect=LLMServiceError("busy right now")),
    ):
        resp = await client.post("/api/v1/questions/generate", json=GENERATE)
    assert resp.status_code == 503
    assert resp.json()["detail"] == "busy right now"


async def test_evaluate_garbled_model_reply_is_a_503(client):
    garbled = SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content="not json")))
    with patch.object(router, "_get_model", return_value=garbled):
        resp = await client.post("/api/v1/answers/evaluate", json=EVALUATE)
    assert resp.status_code == 503
    assert "garbled" in resp.json()["detail"]
