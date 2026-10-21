import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.profiles import ProfileOut


class AdminProfile(ProfileOut):
    attempt_count: int
    last_attempt_at: datetime | None = None


class AdminAttempt(BaseModel):
    id: uuid.UUID
    mode: str
    lesson_id: str | None
    topic_id: str | None
    question_count: int
    score: float
    max_score: float
    score_pct: float
    created_at: datetime


class AdminAttemptDetail(AdminAttempt):
    questions_snapshot: list[Any]
    evaluation_snapshot: list[Any]


class DailyProgress(BaseModel):
    date: date
    attempt_count: int
    curriculum_attempts: int
    adhoc_attempts: int
    avg_score_pct: float
    best_score_pct: float


class AdminLessonProgress(BaseModel):
    lesson_id: str
    lesson_title: str
    unit_id: str
    unit_title: str
    completed: bool
    best_score_pct: float
    attempts_count: int
    last_attempt_at: datetime | None = None
