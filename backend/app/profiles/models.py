"""Child profiles."""

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


class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = (
        UniqueConstraint("email", name="uq_profiles_email"),
        CheckConstraint("grade IN ('6', '7')", name="ck_profiles_grade"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    # Owning parent. NULL only for profiles made before parent sign-in, not yet claimed.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("parents.id"), nullable=True, index=True
    )
    # Only the old email sign-in has one; children added by a parent have no email.
    email: Mapped[str | None] = mapped_column(Text, nullable=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    grade: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow, server_default=func.now()
    )
