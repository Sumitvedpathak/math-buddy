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


# ---------------------------------------------------------------------------
# Writing Coach (temporary feature). All tables are prefixed wc_ and link to profiles.
# To remove the feature: alembic downgrade 0001, delete app/writing_coach, drop these classes.
# ---------------------------------------------------------------------------


class WcSettings(Base):
    __tablename__ = "wc_settings"
    __table_args__ = (
        CheckConstraint("history_strand IN ('A', 'B', 'both')", name="ck_wc_settings_strand"),
        CheckConstraint("focus_week BETWEEN 1 AND 4", name="ck_wc_settings_week"),
    )

    profile_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("profiles.id"), primary_key=True
    )
    history_strand: Mapped[str] = mapped_column(Text, nullable=False, default="A", server_default="A")
    rubric_override: Mapped[str | None] = mapped_column(Text, nullable=True)
    focus_week: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")


class WcSession(Base):
    __tablename__ = "wc_sessions"
    __table_args__ = (
        CheckConstraint("subject IN ('history', 'language', 'school')", name="ck_wc_sessions_subject"),
        Index("ix_wc_sessions_profile_created", "profile_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("profiles.id"), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    topic_id: Mapped[str] = mapped_column(Text, nullable=False)
    concept: Mapped[str] = mapped_column(Text, nullable=False)
    item: Mapped[dict] = mapped_column(JsonType, nullable=False)
    focus_week: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    decode: Mapped[dict | None] = mapped_column(JsonType, nullable=True)
    next_time: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_move: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="started", server_default="started")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now()
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WcSubmission(Base):
    """One handwritten answer (draft or rewrite). Only text is stored, never images."""

    __tablename__ = "wc_submissions"
    __table_args__ = (
        CheckConstraint("kind IN ('draft', 'rewrite')", name="ck_wc_submissions_kind"),
        UniqueConstraint("session_id", "kind", name="uq_wc_submissions_session_kind"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("wc_sessions.id"), nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    transcript_original: Mapped[str] = mapped_column(Text, nullable=False)
    transcript_confirmed: Mapped[str | None] = mapped_column(Text, nullable=True)
    diff: Mapped[list | None] = mapped_column(JsonType, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now()
    )


class WcReview(Base):
    __tablename__ = "wc_reviews"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("wc_submissions.id"), nullable=False, unique=True
    )
    review: Mapped[dict] = mapped_column(JsonType, nullable=False)
    level: Mapped[str] = mapped_column(Text, nullable=False)
    percent: Mapped[int] = mapped_column(Integer, nullable=False)
    model: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, server_default=func.now()
    )
