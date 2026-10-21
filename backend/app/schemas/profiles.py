import re
import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints, field_validator

Grade = Literal["6", "7"]

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalize_email(value: str) -> str:
    """Trim + lowercase so the same address always maps to the same profile."""
    value = value.strip().lower()
    if len(value) > 254 or not _EMAIL_RE.match(value):
        raise ValueError("Invalid email address")
    return value


class ProfileCreate(BaseModel):
    email: str
    display_name: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
    ]
    grade: Grade

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, value: str) -> str:
        return normalize_email(value)


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str
    grade: Grade
    created_at: datetime


class ProfileLookupResponse(BaseModel):
    exists: bool
    profile: ProfileOut | None = None


class LessonStatus(BaseModel):
    """Child-facing lesson state: no timestamps, no history."""

    model_config = ConfigDict(from_attributes=True)

    lesson_id: str
    completed: bool
    best_score_pct: float
