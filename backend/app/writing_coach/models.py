"""Writing Coach tables (temporary feature). All prefixed wc_ and linked to profiles.

To remove the feature: alembic downgrade 0001, then delete app/writing_coach.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, JsonType, utcnow


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
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
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
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
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
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
