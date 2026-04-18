import json
import asyncio
from openai import AsyncOpenAI, APIError, APITimeoutError

from app.config import get_settings


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
        LLMServiceError: On API error, timeout, or JSON parse failure.
    """
    settings = get_settings()
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

    try:
        response = await client.chat.completions.create(
            model=settings.openrouter_model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except APITimeoutError as exc:
        raise LLMServiceError("LLM call timed out after 30 seconds.") from exc
    except APIError as exc:
        raise LLMServiceError(f"OpenRouter API error: {exc}") from exc
    except (json.JSONDecodeError, ValueError) as exc:
        raise LLMServiceError(f"Failed to parse LLM JSON response: {exc}") from exc
