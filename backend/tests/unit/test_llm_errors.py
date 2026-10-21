"""LLM failures must surface as LLMServiceError (-> HTTP 503), never as a raw 500."""

import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from openai import APIConnectionError, AuthenticationError, RateLimitError

from app.integrations import langchainrouter as router
from app.integrations import openrouter
from app.integrations.langchainrouter import BUSY_MESSAGE, FAILED_MESSAGE, LLMServiceError, call_llm


def _response(status: int) -> httpx.Response:
    return httpx.Response(status, request=httpx.Request("POST", "https://openrouter.ai/api/v1"))


def _model_raising(exc: Exception):
    return SimpleNamespace(ainvoke=AsyncMock(side_effect=exc))


def _model_returning(content):
    return SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content=content)))


def test_one_shared_error_class():
    # The API layer catches openrouter.LLMServiceError; the services raise the router's.
    assert router.LLMServiceError is openrouter.LLMServiceError


async def test_rate_limit_becomes_a_busy_error():
    exc = RateLimitError("rate limited", response=_response(429), body=None)
    with patch.object(router, "_get_model", return_value=_model_raising(exc)):
        with pytest.raises(LLMServiceError) as info:
            await call_llm("prompt")
    assert str(info.value) == BUSY_MESSAGE
    assert info.value.__cause__ is exc


async def test_connection_error_is_treated_as_transient():
    exc = APIConnectionError(request=httpx.Request("POST", "https://openrouter.ai"))
    with patch.object(router, "_get_model", return_value=_model_raising(exc)):
        with pytest.raises(LLMServiceError) as info:
            await call_llm("prompt")
    assert str(info.value) == BUSY_MESSAGE


async def test_other_failures_get_a_generic_message_not_the_raw_error():
    exc = AuthenticationError("bad key sk-secret", response=_response(401), body=None)
    with patch.object(router, "_get_model", return_value=_model_raising(exc)):
        with pytest.raises(LLMServiceError) as info:
            await call_llm("prompt")
    assert str(info.value) == FAILED_MESSAGE
    assert "sk-secret" not in str(info.value)


async def test_valid_json_is_returned():
    with patch.object(router, "_get_model", return_value=_model_returning('{"a": 1}')):
        assert await call_llm("prompt") == {"a": 1}


async def test_json_inside_a_markdown_fence_is_accepted():
    fenced = '```json\n{"a": 1}\n```'
    with patch.object(router, "_get_model", return_value=_model_returning(fenced)):
        assert await call_llm("prompt") == {"a": 1}


async def test_invalid_json_raises_value_error_so_generation_can_retry():
    with patch.object(router, "_get_model", return_value=_model_returning("not json")):
        with pytest.raises(json.JSONDecodeError):
            await call_llm("prompt")
