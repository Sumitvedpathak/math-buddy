import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    Uuid,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# JSONB on Postgres, plain JSON elsewhere (the test suite runs on SQLite).
JsonType = JSON().with_variant(JSONB(), "postgresql")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        UniqueConstraint("email", name="uq_profiles_email"),
        CheckConstraint("grade IN ('6', '7')", name="ck_profiles_grade"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    grade: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now()
    )


class LessonProgress(Base):
    """Derived summary: one row per (profile, curriculum lesson)."""

    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint("profile_id", "lesson_id", name="uq_lesson_progress_profile_lesson"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id"), nullable=False
    )
    lesson_id: Mapped[str] = mapped_column(Text, nullable=False)
    best_score_pct: Mapped[float] = mapped_column(
        Numeric(5, 2, asdecimal=False), nullable=False, default=0, server_default="0"
    )
    attempts_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )
    completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    last_attempt_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class PracticeAttempt(Base):
    """Append-only history of every practice session (curriculum and ad-hoc)."""

    __tablename__ = "practice_attempts"
    __table_args__ = (
        CheckConstraint("mode IN ('curriculum', 'adhoc')", name="ck_practice_attempts_mode"),
        CheckConstraint(
            "(mode = 'curriculum' AND lesson_id IS NOT NULL AND topic_id IS NULL)"
            " OR (mode = 'adhoc' AND topic_id IS NOT NULL AND lesson_id IS NULL)",
            name="ck_practice_attempts_mode_target",
        ),
        Index("ix_practice_attempts_profile_created", "profile_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id"), nullable=False
    )
    mode: Mapped[str] = mapped_column(Text, nullable=False)
    lesson_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[float] = mapped_column(Numeric(8, 2, asdecimal=False), nullable=False)
    max_score: Mapped[float] = mapped_column(Numeric(8, 2, asdecimal=False), nullable=False)
    questions_snapshot: Mapped[list] = mapped_column(JsonType, nullable=False)
    evaluation_snapshot: Mapped[list] = mapped_column(JsonType, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now()
    )
