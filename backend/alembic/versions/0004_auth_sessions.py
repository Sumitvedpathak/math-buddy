"""Signed-in device sessions (parent sign-in, step 2: refresh and logout)

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-19
"""

import sqlalchemy as sa

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("parents.id"), nullable=False),
        sa.Column(
            "child_profile_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=True
        ),
        sa.Column("refresh_hash", sa.Text(), nullable=False),
        sa.Column("prev_refresh_hash", sa.Text(), nullable=True),
        sa.Column("older_refresh_hash", sa.Text(), nullable=True),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("device_name", sa.Text(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idle_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("kind IN ('parent', 'child')", name="ck_auth_sessions_kind"),
    )
    for column in (
        "parent_id",
        "child_profile_id",
        "refresh_hash",
        "prev_refresh_hash",
        "older_refresh_hash",
    ):
        op.create_index(f"ix_auth_sessions_{column}", "auth_sessions", [column])


def downgrade() -> None:
    op.drop_table("auth_sessions")  # drops its indexes too
