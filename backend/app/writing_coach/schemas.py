import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.writing_coach.levels import (
    LEVELS,
    band_for_level,
    clamp_percent_to_level,
    level_for_percent,
    percent_matches_level,
)
from app.writing_coach.rubric import (
    MODEL_ANSWER_SENTENCES,
    NO_EVIDENCE_CRITERION_CAP,
    NO_EVIDENCE_OVERALL_CAP,
    sentence_stats,
    split_sentences,
)

Subject = Literal["history", "language", "school"]
SubmissionKind = Literal["draft", "rewrite"]

COMMAND_WORDS = ["Describe", "Explain", "Compare", "Analyse", "Evaluate", "Justify"]


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
        lo, hi = MODEL_ANSWER_SENTENCES
        count = len(split_sentences(v))
        if not lo <= count <= hi:
            raise ValueError(f"model_answer must be 5 to 7 sentences, got {count}")
        return v


class ReaderResult(BaseModel):
    """Handwriting Reader output: the transcription, nothing else."""

    transcript: str = Field(min_length=1)


class SentenceTag(BaseModel):
    sentence: str
    tag: Literal["restate", "answer", "cite", "explain", "extend", "other"]


class SentenceUpgrade(BaseModel):
    original: str = ""
    better: str = ""


# Fine-grained error categories, used by the personal error tracker.
CONVENTION_CATEGORIES = {
    "capital_place": "capitals on place names",
    "capital_person": "capitals on people's names",
    "capital_group": "capitals on nations and peoples",
    "capital_document": "capitals on treaties, documents and events",
    "capital_title": "capitals on book titles",
    "capital_sentence": "capitals at the start of sentences and for I",
    "fragment": "incomplete sentences",
    "run_on": "run-on sentences",
    "agreement": "subject-verb agreement",
    "tense": "tense changes",
    "comma_intro": "commas after introductory words",
    "apostrophe": "apostrophes",
    "quotation": "quotation marks",
    "spelling": "spelling",
    "punctuation_other": "other punctuation",
    "other": "other mistakes",
}
CONVENTION_TYPES = ["capitalization", "sentence", "agreement", "tense", "punctuation", "spelling", "other"]
MAX_CONVENTION_ERRORS = 10


class ConventionError(BaseModel):
    original: str
    correction: str
    type: str = "other"
    rule: str = ""
    category: str = "other"

    @field_validator("type")
    @classmethod
    def _known_type(cls, v: str) -> str:
        return v if v in CONVENTION_TYPES else "other"

    @field_validator("category")
    @classmethod
    def _known_category(cls, v: str) -> str:
        return v if v in CONVENTION_CATEGORIES else "other"


class Criterion(BaseModel):
    """One rubric criterion. The level is the Reviewer's judgement; a stray percent is pulled into it."""

    level: str
    percent: int = Field(ge=0, le=100)
    note: str = ""
    nextStep: str = ""

    @field_validator("level")
    @classmethod
    def _known_level(cls, v: str) -> str:
        v = v.strip().replace("\u2212", "-")  # a real minus sign -> hyphen
        if v not in LEVELS:
            raise ValueError(f"level must be one of {LEVELS}")
        return v

    @model_validator(mode="after")
    def _percent_fits_level(self) -> "Criterion":
        if not percent_matches_level(self.level, self.percent):
            self.percent = clamp_percent_to_level(self.level, self.percent)
        return self


class CommunicationCriterion(Criterion):
    errors: list[ConventionError] = []
    # Counted by the app from the transcript, never taken from the model.
    sentenceCount: int = 0
    repeatedOpeners: list[str] = []

    @field_validator("errors")
    @classmethod
    def _at_most_ten(cls, v: list[ConventionError]) -> list[ConventionError]:
        return v[:MAX_CONVENTION_ERRORS]


class Criteria(BaseModel):
    understanding: Criterion
    evidence: Criterion
    communication: CommunicationCriterion


class Overall(BaseModel):
    level: str = "1-"
    percent: int = 0
    capApplied: bool = False


class Review(BaseModel):
    """Reviewer output. `overall` is always worked out here, whatever the model sent."""

    summary: str
    allPartsAnswered: bool
    missedParts: list[str] = []
    hasSpecificEvidence: bool
    criteria: Criteria
    overall: Overall = Overall()
    sentenceTags: list[SentenceTag] = []
    strengths: list[str] = []
    nextSteps: list[str] = []
    pushQuestion: str = ""
    sentenceUpgrade: SentenceUpgrade = SentenceUpgrade()

    @model_validator(mode="after")
    def _work_out_marks(self) -> "Review":
        # Missed parts and the boolean must agree.
        self.allPartsAnswered = len(self.missedParts) == 0

        c = self.criteria
        capped = False
        if not self.hasSpecificEvidence:
            _, evidence_top = band_for_level(NO_EVIDENCE_CRITERION_CAP)
            if c.evidence.percent > evidence_top:
                c.evidence.level, c.evidence.percent = NO_EVIDENCE_CRITERION_CAP, evidence_top
                capped = True
        percent = round((c.understanding.percent + c.evidence.percent + c.communication.percent) / 3)
        if not self.hasSpecificEvidence:
            _, overall_top = band_for_level(NO_EVIDENCE_OVERALL_CAP)
            if percent > overall_top:
                percent = overall_top
                capped = True
        self.overall = Overall(level=level_for_percent(percent), percent=percent, capApplied=capped)
        return self

    def check_against_transcript(self, transcript: str) -> None:
        """Drop what the transcript does not support, and count sentences ourselves."""
        self.drop_unmatched_tags(transcript)
        comm = self.criteria.communication
        # An error must really appear, and a word the Reader marked [?] (ambiguous capital) never counts.
        comm.errors = [
            e for e in comm.errors
            if e.original and e.original in transcript and f"{e.original}[?]" not in transcript
        ]
        stats = sentence_stats(transcript)
        comm.sentenceCount = stats["sentenceCount"]
        comm.repeatedOpeners = stats["repeatedOpeners"]

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
    focus_week: int | None = Field(default=None, ge=1, le=4)
