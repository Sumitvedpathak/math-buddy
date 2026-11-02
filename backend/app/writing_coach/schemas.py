import re
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.writing_coach.levels import LEVELS, clamp_percent_to_level, percent_matches_level

Subject = Literal["history", "language", "school"]
SubmissionKind = Literal["draft", "rewrite"]

COMMAND_WORDS = ["Describe", "Explain", "Compare", "Analyse", "Evaluate", "Justify"]
MODEL_ANSWER_WORDS = (130, 280)  # brief asks 150-250; a little tolerance avoids pointless retries


def word_count(text: str) -> int:
    return len(re.findall(r"\S+", text))


class GeneratedItem(BaseModel):
    """Practice Generator output."""

    question: str = Field(min_length=10)
    command_words: list[str] = Field(min_length=1, max_length=3)
    parts: int = Field(ge=1, le=4)
    thinking_focus: str = Field(min_length=3)
    background: str = Field(min_length=40)
    key_terms: list[str] = Field(min_length=4, max_length=6)
    extend_hints: list[str] = Field(min_length=2, max_length=3)
    model_answer: str
    text_kind: Literal["card", "novel", "poem", "media"] = "card"

    @field_validator("command_words")
    @classmethod
    def _normalise_command_words(cls, v: list[str]) -> list[str]:
        out = [w.strip().capitalize() for w in v if w.strip()]
        if not out:
            raise ValueError("at least one command word")
        return out

    @field_validator("model_answer")
    @classmethod
    def _model_answer_length(cls, v: str) -> str:
        lo, hi = MODEL_ANSWER_WORDS
        if not lo <= word_count(v) <= hi:
            raise ValueError(f"model_answer must be {lo}-{hi} words, got {word_count(v)}")
        return v


class ReaderResult(BaseModel):
    """Handwriting Reader output: the transcription, nothing else."""

    transcript: str = Field(min_length=1)


Score = Annotated[int, Field(ge=0, le=2)]


class StepScore(BaseModel):
    score: Score
    note: str = ""


class Scores(BaseModel):
    restate: StepScore
    answer: StepScore
    cite: StepScore
    explain: StepScore
    extend: StepScore


class Categories(BaseModel):
    knowledge: str = ""
    thinking: str = ""
    communication: str = ""
    application: str = ""


class SentenceTag(BaseModel):
    sentence: str
    tag: Literal["restate", "answer", "cite", "explain", "extend", "other"]


class SentenceUpgrade(BaseModel):
    original: str = ""
    better: str = ""


class Review(BaseModel):
    """Reviewer output (strict JSON from the brief)."""

    level: str
    percent: int = Field(ge=0, le=100)
    summary: str
    allPartsAnswered: bool
    missedParts: list[str] = []
    scores: Scores
    categories: Categories
    sentenceTags: list[SentenceTag] = []
    strengths: list[str] = []
    nextSteps: list[str] = []
    pushQuestion: str = ""
    sentenceUpgrade: SentenceUpgrade = SentenceUpgrade()
    conventions: list[str] = []

    @field_validator("level")
    @classmethod
    def _known_level(cls, v: str) -> str:
        v = v.strip().replace("−", "-")  # a real minus sign -> hyphen
        if v not in LEVELS:
            raise ValueError(f"level must be one of {LEVELS}")
        return v

    @field_validator("conventions")
    @classmethod
    def _max_two_conventions(cls, v: list[str]) -> list[str]:
        return v[:2]

    @model_validator(mode="after")
    def _consistent(self) -> "Review":
        # The level is the Reviewer's judgement: pull a stray percent back into its band.
        if not percent_matches_level(self.level, self.percent):
            self.percent = clamp_percent_to_level(self.level, self.percent)
        # Missed parts and the boolean must agree.
        self.allPartsAnswered = len(self.missedParts) == 0
        return self

    def drop_unmatched_tags(self, transcript: str) -> None:
        """Keep only sentence tags whose sentence really appears in the transcript."""
        norm = " ".join(transcript.split())
        self.sentenceTags = [t for t in self.sentenceTags if " ".join(t.sentence.split()) in norm]


# ---- request bodies ----

class SessionCreate(BaseModel):
    subject: Subject | None = None  # None = today's scheduled subject
    school_question: str | None = Field(default=None, max_length=1500)


class DecodeAnswer(BaseModel):
    command_words: list[str]
    parts: int = Field(ge=1, le=10)
    thinking_focus: str


class ReadRequest(BaseModel):
    kind: SubmissionKind
    images: list[str] = Field(min_length=1, max_length=6)

    @field_validator("images")
    @classmethod
    def _data_uris(cls, v: list[str]) -> list[str]:
        for img in v:
            if not img.startswith("data:image/"):
                raise ValueError("images must be data:image/... URIs")
            if len(img) > 6_000_000:
                raise ValueError("image too large (compress it before upload)")
        return v


class TranscriptUpdate(BaseModel):
    text: str = Field(min_length=1, max_length=8000)


class SessionFinish(BaseModel):
    next_time: str = Field(min_length=1, max_length=500)
    model_move: str | None = Field(default=None, max_length=500)


class SettingsUpdate(BaseModel):
    history_strand: Literal["A", "B", "both"] | None = None
    rubric_override: str | None = Field(default=None, max_length=6000)
    focus_week: int | None = Field(default=None, ge=1, le=4)
