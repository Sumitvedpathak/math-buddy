"""The three Writing Coach agents: Generator, Reader, Reviewer.

Each is a small function: render a Jinja2 prompt, call the shared LLM client, validate the
JSON against a schema, retry once with a repair note if invalid. They never call each other;
the API layer sequences them.
"""

import json
import logging
import os
import random
from pathlib import Path
from typing import TypeVar

from jinja2 import Environment, FileSystemLoader
from pydantic import BaseModel, ValidationError

from app.config import get_settings
from app.integrations.langchainrouter import LLMServiceError, call_llm_with_usage
from app.writing_coach.schemas import (
    COMMAND_WORDS,
    GeneratedItem,
    ReaderResult,
    Review,
)

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

BASE_DIR = Path(__file__).parent
_jinja = Environment(loader=FileSystemLoader(str(BASE_DIR / "prompts")))

GENERATOR_TEMPERATURE = 0.7
READER_TEMPERATURE = 0.0
REVIEWER_TEMPERATURE = 0.1


class AgentOutputError(LLMServiceError):
    """The model replied, but not with output that passes the schema (after one retry)."""


def _model_for(env_name: str) -> str:
    """Per-agent model from env, falling back to the app-wide model."""
    return os.getenv(env_name) or get_settings().openrouter_model


def generator_model() -> str:
    return _model_for("WC_GENERATOR_MODEL")


def reader_model() -> str:
    return _model_for("WC_READER_MODEL")


def reviewer_model() -> str:
    return _model_for("WC_REVIEWER_MODEL")


def log_usage(agent: str, usage: dict) -> None:
    """Token counts only. Never prompt text, answers or images."""
    logger.info(
        "Writing Coach LLM usage",
        extra={
            "wc_agent": agent,
            "model": usage.get("model"),
            "input_tokens": usage.get("input_tokens"),
            "output_tokens": usage.get("output_tokens"),
        },
    )


async def run_agent(
    name: str,
    template: str,
    variables: dict,
    schema: type[T],
    *,
    model: str,
    temperature: float,
    images: list[str] | None = None,
) -> T:
    """Render -> call -> validate; one retry that tells the model what was wrong."""
    prompt = _jinja.get_template(template).render(**variables)
    last_error = ""
    for attempt in (1, 2):
        text = prompt if attempt == 1 else (
            prompt
            + "\n\nYour previous reply was not valid. Problem: "
            + last_error
            + "\nReturn the JSON again, fixed."
        )
        try:
            raw, usage = await call_llm_with_usage(
                text, images, model=model, temperature=temperature
            )
        except ValueError as exc:  # json.JSONDecodeError: the reply was not JSON
            last_error = f"not valid JSON ({exc})"
            logger.warning("Writing Coach reply was not JSON", extra={"wc_agent": name})
            continue
        log_usage(name, usage)
        try:
            return schema.model_validate(raw)
        except ValidationError as exc:
            last_error = "; ".join(
                f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()[:6]
            )
            logger.warning(
                "Writing Coach reply failed validation",
                extra={"wc_agent": name, "attempt": attempt, "error": last_error[:300]},
            )
    raise AgentOutputError("The writing helper could not produce a valid answer. Please try again.")


# ---------------------------------------------------------------- Generator

def _load_json(name: str) -> dict:
    return json.loads((BASE_DIR / "data" / name).read_text(encoding="utf-8"))


def history_topics(strand: str) -> list[dict]:
    """Topics for 'A', 'B' or 'both', each tagged with its strand."""
    strands = ["A", "B"] if strand == "both" else [strand]
    topics: list[dict] = []
    for s in strands:
        bank = _load_json(f"history_strand_{s.lower()}.json")
        topics.extend({**t, "strand": s} for t in bank["topics"])
    return topics


def language_types() -> list[dict]:
    return _load_json("language_types.json")["types"]


CONCEPTS = [
    "Historical Significance",
    "Cause and Consequence",
    "Continuity and Change",
    "Historical Perspective",
]
LANGUAGE_FOCUSES = ["Analysis", "Inference", "Author's craft", "Perspective", "Connection to the world"]


def _least_recent(options: list[str], recent: list[str]) -> str:
    """Pick the option used longest ago (recent is newest first); ties are random."""
    def last_seen(opt: str) -> int:
        return recent.index(opt) if opt in recent else len(recent) + 1

    best = max(last_seen(o) for o in options)
    return random.choice([o for o in options if last_seen(o) == best])


def pick_history(strand: str, recent_topic_ids: list[str], recent_concepts: list[str]) -> tuple[dict, str, str]:
    topics = history_topics(strand)
    by_id = {t["id"]: t for t in topics}
    topic = by_id[_least_recent(list(by_id), recent_topic_ids)]
    concept = _least_recent(CONCEPTS, recent_concepts)
    command_word = random.choice(COMMAND_WORDS)
    return topic, concept, command_word


def pick_language(recent_type_ids: list[str], recent_concepts: list[str]) -> tuple[dict, str, str]:
    types = {t["id"]: t for t in language_types()}
    qtype = types[_least_recent(list(types), recent_type_ids)]
    concept = _least_recent(LANGUAGE_FOCUSES, recent_concepts)
    return qtype, concept, random.choice(COMMAND_WORDS)


def _bank_text(topic: dict) -> str:
    return " ".join(topic["key_facts"] + topic["key_terms"] + topic["perspectives"]).lower()


async def generate_history(topic: dict, concept: str, command_word: str, recent_questions: list[str]) -> GeneratedItem:
    item = await run_agent(
        "generator",
        "generator_history.txt",
        {
            "topic": topic,
            "concept": concept,
            "command_word": command_word,
            "max_parts": 2,
            "recent_questions": recent_questions,
        },
        GeneratedItem,
        model=generator_model(),
        temperature=GENERATOR_TEMPERATURE,
    )
    item.thinking_focus = concept
    # Accuracy guard: key terms must come from the bank so the card stays on stored facts.
    bank = _bank_text(topic)
    allowed = [t for t in item.key_terms if t.lower() in bank]
    item.key_terms = allowed if len(allowed) >= 4 else topic["key_terms"][:6]
    return item


async def generate_language(qtype: dict, concept: str, command_word: str, recent_questions: list[str]) -> GeneratedItem:
    item = await run_agent(
        "generator",
        "generator_language.txt",
        {
            "qtype": qtype,
            "concept": concept,
            "command_word": command_word,
            "max_parts": 2,
            "recent_questions": recent_questions,
        },
        GeneratedItem,
        model=generator_model(),
        temperature=GENERATOR_TEMPERATURE,
    )
    item.text_kind = qtype["kind"]
    return item


async def generate_school(school_question: str) -> GeneratedItem:
    item = await run_agent(
        "generator",
        "generator_school.txt",
        {"school_question": school_question},
        GeneratedItem,
        model=generator_model(),
        temperature=GENERATOR_TEMPERATURE,
    )
    item.question = school_question  # never altered
    return item


# ------------------------------------------------------------------- Reader

async def read_handwriting(images: list[str]) -> str:
    """Verbatim transcription. The images are only held in memory for this call."""
    result = await run_agent(
        "reader",
        "reader.txt",
        {"page_count": len(images)},
        ReaderResult,
        model=reader_model(),
        temperature=READER_TEMPERATURE,
        images=images,
    )
    return result.transcript


# ----------------------------------------------------------------- Reviewer

async def review_answer(
    *,
    subject: str,
    kind: str,
    item: dict,
    focus: str,
    rubric_override: str | None,
    transcript: str,
) -> tuple[Review, str]:
    """Grade the CONFIRMED transcript. Returns (review, model used)."""
    review = await run_agent(
        "reviewer",
        "reviewer.txt",
        {
            "subject": subject,
            "kind": kind,
            "question": item["question"],
            "command_words": item["command_words"],
            "parts": item["parts"],
            "key_terms": item["key_terms"],
            "focus": focus,
            "rubric_override": (rubric_override or "").strip() or None,
            "transcript": transcript,
        },
        Review,
        model=reviewer_model(),
        temperature=REVIEWER_TEMPERATURE,
    )
    review.drop_unmatched_tags(transcript)
    if subject == "history":
        review.conventions = []
    return review, reviewer_model()
