import logging
import os
import json
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI

# One shared error type: the API layer catches this class and returns a 503.
from app.integrations.openrouter import LLMServiceError

load_dotenv()

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("MATH_BUDDY_OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("MATH_BUDDY_OPENROUTER_MODEL")
os.environ["LANGSMITH_PROJECT"] = "Math-Buddy"

# The OpenAI client retries rate limits (429), 5xx and connection errors with exponential
# backoff (honouring Retry-After); upstream providers rate-limit in short bursts.
MAX_RETRIES = 4
REQUEST_TIMEOUT_S = 90

BUSY_MESSAGE = "The AI helper is busy right now. Please try again in a moment."
FAILED_MESSAGE = "The AI helper ran into a problem. Please try again."


def _get_model():
    """Get the LangChain Router model."""
    return ChatOpenAI(
        model=OPENROUTER_MODEL,
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1",
        max_retries=MAX_RETRIES,
        timeout=REQUEST_TIMEOUT_S)

def _filter_images(prompt: str, images: list[str] | None) -> list[str]:
    """Filter the images to be sent to the LangChain Router model."""
    content: list[dict] = [{"type": "text", "text": prompt}]
    for data_uri in images:
        content.append({
            "type": "image_url",
            "image_url": {"url": data_uri},
        })
    messages = [{"role": "user", "content": content}]
    return messages


def _is_transient(exc: Exception) -> bool:
    """Rate limits, timeouts, dropped connections and provider 5xx are worth a retry later."""
    status = getattr(exc, "status_code", None)
    return (
        type(exc).__name__ in {"RateLimitError", "APITimeoutError", "APIConnectionError"}
        or (isinstance(status, int) and (status == 429 or status >= 500))
    )


def _parse_json(content) -> dict:
    """Parse the model's JSON reply, tolerating a markdown code fence around it."""
    if not isinstance(content, str):  # some providers return a list of content parts
        content = "".join(p.get("text", "") if isinstance(p, dict) else str(p) for p in content)
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text[:4].lower() == "json":
            text = text[4:]
    return json.loads(text)


async def call_llm(prompt: str, images: list[str] | None = None) -> dict:
    """Call the LangChain Router model.

    Raises:
        LLMServiceError: the call failed (after retries) — rate limit, timeout, provider error.
        ValueError (json.JSONDecodeError): the model replied, but not with valid JSON.
    """
    model = _get_model()

    if images:
        messages = _filter_images(prompt, images)
    else:
        messages = [{"role": "user", "content": prompt}]
    try:
        response = await model.ainvoke(messages, response_format={"type": "json_object"})
    except Exception as exc:
        transient = _is_transient(exc)
        logger.error(
            "LLM call failed",
            extra={"exc_type": type(exc).__name__, "transient": transient, "error": str(exc)[:300]},
        )
        raise LLMServiceError(BUSY_MESSAGE if transient else FAILED_MESSAGE) from exc
    return _parse_json(response.content)
