"""Parents, how they sign in, and the signed-in devices (sessions)."""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, utcnow


class Parent(Base):
    __tablename__ = "parents"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Latest email from Google: for display and contact only, never to find the parent.
    email: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    accepted_terms_version: Mapped[str] = mapped_column(Text, nullable=False)
    accepted_terms_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
    )
    last_login_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
    )


class AuthIdentity(Base):
    """One sign-in method of a parent: Google now, Apple later."""

    __tablename__ = "auth_identities"
    __table_args__ = (
        UniqueConstraint(
            "provider", "subject", name="uq_auth_identities_provider_subject"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    parent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("parents.id"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(Text, nullable=False)  # "google"
    subject: Mapped[str] = mapped_column(Text, nullable=False)  # Google's stable "sub"
    email_at_signin: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
    )


class AuthSession(Base):
    """One signed-in device. Holds hashes of its refresh tokens, never the tokens.

    Each refresh rotates: older <- prev <- current <- new. Seeing `prev` again
    means a race or a lost reply; seeing `older` again means the token was stolen.
    """

    __tablename__ = "auth_sessions"
    __table_args__ = (
        CheckConstraint("kind IN ('parent', 'child')", name="ck_auth_sessions_kind"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    # The owning parent, for both kinds.
    parent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("parents.id"), nullable=False, index=True
    )
    # Set only for kind='child' (linked devices, a later step).
    child_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("profiles.id"), nullable=True, index=True
    )
    refresh_hash: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    prev_refresh_hash: Mapped[str | None] = mapped_column(Text, index=True)
    older_refresh_hash: Mapped[str | None] = mapped_column(Text, index=True)
    rotated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    device_name: Mapped[str | None] = mapped_column(Text)
    user_agent: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=func.now(),
    )
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    idle_expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
