"""profiles, lesson_progress, practice_attempts

Revision ID: 0001
Revises:
Create Date: 2026-10-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

json_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    op.create_table(
        "profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("grade", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("email", name="uq_profiles_email"),
        sa.CheckConstraint("grade IN ('6', '7')", name="ck_profiles_grade"),
    )

    op.create_table(
        "lesson_progress",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("profile_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("lesson_id", sa.Text(), nullable=False),
        sa.Column("best_score_pct", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("attempts_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint(
            "profile_id", "lesson_id", name="uq_lesson_progress_profile_lesson"
        ),
    )

    op.create_table(
        "practice_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("profile_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("mode", sa.Text(), nullable=False),
        sa.Column("lesson_id", sa.Text(), nullable=True),
        sa.Column("topic_id", sa.Text(), nullable=True),
        sa.Column("question_count", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(8, 2), nullable=False),
        sa.Column("max_score", sa.Numeric(8, 2), nullable=False),
        sa.Column("questions_snapshot", json_type, nullable=False),
        sa.Column("evaluation_snapshot", json_type, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "mode IN ('curriculum', 'adhoc')", name="ck_practice_attempts_mode"
        ),
        sa.CheckConstraint(
            "(mode = 'curriculum' AND lesson_id IS NOT NULL AND topic_id IS NULL)"
            " OR (mode = 'adhoc' AND topic_id IS NOT NULL AND lesson_id IS NULL)",
            name="ck_practice_attempts_mode_target",
        ),
    )
    op.create_index(
        "ix_practice_attempts_profile_created",
        "practice_attempts",
        ["profile_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_practice_attempts_profile_created", table_name="practice_attempts")
    op.drop_table("practice_attempts")
    op.drop_table("lesson_progress")
    op.drop_table("profiles")
