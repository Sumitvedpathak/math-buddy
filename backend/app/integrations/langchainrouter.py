import os
import json
from dotenv import load_dotenv
import asyncio
from langchain_openai import ChatOpenAI

load_dotenv()

OPENROUTER_API_KEY = os.getenv("MATH_BUDDY_OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("MATH_BUDDY_OPENROUTER_MODEL")
os.environ["LANGSMITH_PROJECT"] = "Math-Buddy"

class LLMServiceError(Exception):
    """Raised when the LangChain Router LLM call fails."""

def _get_model():
    """Get the LangChain Router model."""
    return ChatOpenAI(
        model=OPENROUTER_MODEL,
        api_key=OPENROUTER_API_KEY,
        base_url="https://openrouter.ai/api/v1")

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

async def call_llm(prompt: str, images: list[str] | None = None) -> dict:
    """Call the LangChain Router model."""
    model = _get_model()

    if images:
        messages = _filter_images(prompt, images)
    else:
        messages = [{"role": "user", "content": prompt}]
    response = model.invoke(messages, response_format={"type": "json_object"})
    result = json.loads(response.content)
    return result


# async def main():
#     result = await call_llm("What is your name?")
#     print(result)

# if __name__ == "__main__":
#     asyncio.run(main())