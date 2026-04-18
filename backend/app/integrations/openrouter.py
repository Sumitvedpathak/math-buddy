import json
import logging
from openai import (
    AsyncOpenAI,
    APIConnectionError,
    APIError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
)

from app.config import get_settings

logger = logging.getLogger(__name__)


class LLMServiceError(Exception):
    """Raised when the OpenRouter LLM call fails."""


_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncOpenAI(
            api_key=settings.openrouter_api_key,
            base_url="https://openrouter.ai/api/v1",
            timeout=30.0,
        )
    return _client


async def call_llm(prompt: str, images: list[str] | None = None) -> dict:
    """
    Send a prompt to the configured OpenRouter model and return the parsed JSON response.

    Args:
        prompt: The rendered prompt string to send.
        images: Optional list of base64 data URIs (data:image/png;base64,...) to send
                as vision content alongside the text prompt.

    Returns:
        Parsed JSON dict from the model response.

    Raises:
        LLMServiceError: On API error, timeout, connection failure, or JSON parse failure.
    """
    settings = get_settings()
    model = settings.openrouter_model
    client = _get_client()

    # Build message content — multimodal if images provided
    if images:
        content: list[dict] = [{"type": "text", "text": prompt}]
        for data_uri in images:
            content.append({
                "type": "image_url",
                "image_url": {"url": data_uri},
            })
        messages = [{"role": "user", "content": content}]
    else:
        messages = [{"role": "user", "content": prompt}]

    logger.debug(
        "LLM request dispatched",
        extra={
            "model": model,
            "prompt_chars": len(prompt),
            "image_count": len(images) if images else 0,
        },
    )

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        raw_content = response.choices[0].message.content
        result = json.loads(raw_content)
        logger.info(
            "LLM request succeeded",
            extra={"model": model, "response_chars": len(raw_content)},
        )
        return result

    except APITimeoutError as exc:
        msg = f"LLM request timed out after 30 s (model={model})"
        logger.error(msg, extra={"model": model})
        raise LLMServiceError(msg) from exc

    except AuthenticationError as exc:
        msg = (
            f"OpenRouter authentication failed (HTTP 401) — "
            f"verify that OPENROUTER_API_KEY is valid (model={model})"
        )
        logger.error(msg, extra={"model": model, "status_code": 401})
        raise LLMServiceError(msg) from exc

    except PermissionDeniedError as exc:
        msg = (
            f"OpenRouter denied access (HTTP 403) to model '{model}' — "
            f"the API key may lack permission for this model"
        )
        logger.error(msg, extra={"model": model, "status_code": 403})
        raise LLMServiceError(msg) from exc

    except NotFoundError as exc:
        # Common cause: wrong model slug in OPENROUTER_MODEL
        api_detail = getattr(exc, "message", str(exc))
        msg = (
            f"Model not found on OpenRouter (HTTP 404): '{model}' — "
            f"check the OPENROUTER_MODEL value in .env. "
            f"API detail: {api_detail}"
        )
        logger.error(msg, extra={"model": model, "status_code": 404, "api_detail": api_detail})
        raise LLMServiceError(msg) from exc

    except RateLimitError as exc:
        msg = (
            f"OpenRouter rate limit exceeded (HTTP 429) for model '{model}' — "
            f"the account has hit its request or token quota"
        )
        logger.warning(msg, extra={"model": model, "status_code": 429})
        raise LLMServiceError(msg) from exc

    except BadRequestError as exc:
        api_detail = getattr(exc, "message", str(exc))
        msg = (
            f"OpenRouter rejected the request (HTTP 400) for model '{model}' — "
            f"prompt may be malformed or exceed the model's context window. "
            f"API detail: {api_detail}"
        )
        logger.error(msg, extra={"model": model, "status_code": 400, "api_detail": api_detail})
        raise LLMServiceError(msg) from exc

    except APIConnectionError as exc:
        msg = (
            f"Cannot connect to OpenRouter API (model={model}) — "
            f"check network connectivity or OpenRouter status. "
            f"Cause: {exc}"
        )
        logger.error(msg, extra={"model": model, "cause": str(exc)})
        raise LLMServiceError(msg) from exc

    except APIError as exc:
        # Catch-all for any other OpenAI/OpenRouter HTTP errors
        status_code = getattr(exc, "status_code", "unknown")
        api_detail = getattr(exc, "message", str(exc))
        msg = (
            f"OpenRouter API error (HTTP {status_code}) for model '{model}': {api_detail}"
        )
        logger.error(
            msg,
            extra={"model": model, "status_code": status_code, "api_detail": api_detail},
        )
        raise LLMServiceError(msg) from exc

    except (json.JSONDecodeError, ValueError) as exc:
        msg = (
            f"Failed to parse JSON response from model '{model}': {exc}. "
            f"The model may have returned non-JSON output."
        )
        logger.error(msg, extra={"model": model, "parse_error": str(exc)})
        raise LLMServiceError(msg) from exc

