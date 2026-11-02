"""Writing Coach tables (temporary feature; downgrade removes them)

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-02
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "wc_settings",
        sa.Column("profile_id", sa.Uuid(), sa.ForeignKey("profiles.id"), primary_key=True),
        sa.Column("history_strand", sa.Text(), nullable=False, server_default="A"),
        sa.Column("rubric_override", sa.Text(), nullable=True),
        sa.Column("focus_week", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("history_strand IN ('A', 'B', 'both')", name="ck_wc_settings_strand"),
        sa.CheckConstraint("focus_week BETWEEN 1 AND 4", name="ck_wc_settings_week"),
    )

    op.create_table(
        "wc_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("profile_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("topic_id", sa.Text(), nullable=False),
        sa.Column("concept", sa.Text(), nullable=False),
        sa.Column("item", json_type, nullable=False),
        sa.Column("focus_week", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("decode", json_type, nullable=True),
        sa.Column("next_time", sa.Text(), nullable=True),
        sa.Column("model_move", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="started"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "subject IN ('history', 'language', 'school')", name="ck_wc_sessions_subject"
        ),
    )
    op.create_index(
        "ix_wc_sessions_profile_created", "wc_sessions", ["profile_id", "created_at"]
    )

    op.create_table(
        "wc_submissions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("session_id", sa.Uuid(), sa.ForeignKey("wc_sessions.id"), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("transcript_original", sa.Text(), nullable=False),
        sa.Column("transcript_confirmed", sa.Text(), nullable=True),
        sa.Column("diff", json_type, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint("kind IN ('draft', 'rewrite')", name="ck_wc_submissions_kind"),
        sa.UniqueConstraint("session_id", "kind", name="uq_wc_submissions_session_kind"),
    )

    op.create_table(
        "wc_reviews",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "submission_id",
            sa.Uuid(),
            sa.ForeignKey("wc_submissions.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("review", json_type, nullable=False),
        sa.Column("level", sa.Text(), nullable=False),
        sa.Column("percent", sa.Integer(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    op.drop_table("wc_reviews")
    op.drop_table("wc_submissions")
    op.drop_index("ix_wc_sessions_profile_created", table_name="wc_sessions")
    op.drop_table("wc_sessions")
    op.drop_table("wc_settings")
