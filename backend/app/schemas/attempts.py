import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.profiles import LessonStatus


class AttemptCreate(BaseModel):
    profile_id: uuid.UUID
    mode: Literal["curriculum", "adhoc"]
    lesson_id: str | None = None  # required iff mode == "curriculum"
    topic_id: str | None = None  # required iff mode == "adhoc"
    questions: list[dict[str, Any]] = Field(..., min_length=1)
    evaluation: list[dict[str, Any]] = Field(..., min_length=1)
    score: float = Field(..., ge=0)
    max_score: float = Field(..., gt=0)

    @model_validator(mode="after")
    def _check_consistency(self) -> "AttemptCreate":
        if self.score > self.max_score:
            raise ValueError("score cannot exceed max_score")
        if self.mode == "curriculum":
            if not self.lesson_id or self.topic_id:
                raise ValueError("curriculum attempts need lesson_id and no topic_id")
        elif not self.topic_id or self.lesson_id:
            raise ValueError("adhoc attempts need topic_id and no lesson_id")
        return self


class AttemptSaved(BaseModel):
    attempt_id: uuid.UUID
    score_pct: float
    # True when *this* attempt reached the mastery threshold (curriculum mode only).
    mastered: bool
    # Best-so-far state of the lesson after this attempt (curriculum mode only).
    lesson: LessonStatus | None = None
