"""Practice (generate/evaluate) is for signed-in children only. The model is never called
for anyone else."""

from unittest.mock import AsyncMock, patch

import pytest

from tests.kids import token_headers

GENERATE = {"topics": ["Algebra"], "age_group": "11-12", "question_count": 5}
EVALUATE = {
    "questions": [
        {"id": "q1", "topic": "Algebra", "problem_type": "lesson", "text": "2 + 2", "difficulty_tier": 1}
    ],
    "answers": [{"questionId": "q1", "mode": "text", "content": "4"}],
}
ROUTES = [
    ("/api/v1/questions/generate", GENERATE, "app.practice.question_service.call_llm"),
    ("/api/v1/answers/evaluate", EVALUATE, "app.practice.evaluation_service.call_llm"),
]


@pytest.mark.parametrize("url, body, llm", ROUTES)
async def test_no_token_is_401(client, url, body, llm):
    with patch(llm, new=AsyncMock()) as model:
        resp = await client.post(url, json=body)
    assert resp.status_code == 401
    model.assert_not_called()


@pytest.mark.parametrize("url, body, llm", ROUTES)
async def test_parent_token_is_403(client, url, body, llm):
    with patch(llm, new=AsyncMock()) as model:
        resp = await client.post(url, json=body, headers=token_headers(kind="parent"))
    assert resp.status_code == 403
    model.assert_not_called()


@pytest.mark.parametrize("url, body, llm", ROUTES)
async def test_bad_token_is_401(client, url, body, llm):
    with patch(llm, new=AsyncMock()) as model:
        resp = await client.post(url, json=body, headers={"Authorization": "Bearer nonsense"})
    assert resp.status_code == 401
    model.assert_not_called()
