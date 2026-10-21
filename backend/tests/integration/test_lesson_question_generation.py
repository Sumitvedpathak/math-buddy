"""Lesson-scoped question generation: prompt context and relaxed validation."""

from unittest.mock import AsyncMock, patch

LESSON_RESPONSE = {
    "questions": [
        {
            "id": f"q{i}",
            "topic": "Variables in Expressions",
            "problem_type": "lesson",
            "text": f"Evaluate 3n + {i} when n = 2.",
            "difficulty_tier": i,
        }
        for i in range(1, 6)
    ],
    "fun_facts": [f"Fact {i}" for i in range(15)],
}

BODY = {
    "topics": ["Variables in Expressions"],
    "age_group": "11-12",
    "question_count": 5,
    "lesson_id": "10.3",
}


async def test_lesson_prompt_includes_lesson_context(client):
    mock = AsyncMock(return_value=LESSON_RESPONSE)
    with patch("app.services.question_service.call_llm", new=mock):
        resp = await client.post("/api/v1/questions/generate", json=BODY)
    assert resp.status_code == 200
    prompt = mock.call_args.args[0]
    assert "Lesson 10.3: Variables in Expressions" in prompt
    assert "algebraic expression" in prompt  # lesson keyword
    assert 'Set problem_type to exactly "lesson"' in prompt
    assert "MANDATORY PROBLEM TYPES" not in prompt


async def test_lesson_questions_skip_mandatory_type_check(client):
    # Five "lesson" questions would fail the generic mandatory-types validation.
    with patch("app.services.question_service.call_llm", new=AsyncMock(return_value=LESSON_RESPONSE)):
        resp = await client.post("/api/v1/questions/generate", json=BODY)
    assert resp.status_code == 200
    assert {q["problem_type"] for q in resp.json()["questions"]} == {"lesson"}


async def test_no_lesson_keeps_existing_prompt(client):
    generic = {**BODY}
    del generic["lesson_id"]
    types = ["multiplication", "division", "fractions", "mixed_fractions", "squares"]
    generic_response = {
        **LESSON_RESPONSE,
        "questions": [
            {**q, "problem_type": t} for q, t in zip(LESSON_RESPONSE["questions"], types)
        ],
    }
    mock = AsyncMock(return_value=generic_response)
    with patch("app.services.question_service.call_llm", new=mock):
        await client.post("/api/v1/questions/generate", json=generic)
    prompt = mock.call_args.args[0]
    assert "MANDATORY PROBLEM TYPES" in prompt
    assert "LESSON FOCUS" not in prompt


async def test_unknown_lesson_returns_422(client):
    mock = AsyncMock(return_value=LESSON_RESPONSE)
    with patch("app.services.question_service.call_llm", new=mock):
        resp = await client.post("/api/v1/questions/generate", json={**BODY, "lesson_id": "99.9"})
    assert resp.status_code == 422
    mock.assert_not_called()
