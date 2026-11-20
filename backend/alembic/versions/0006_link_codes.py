"""One-time link codes for a child's device (parent sign-in, step 4)

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-20
"""

from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "link_codes",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "child_profile_id", sa.Uuid(), sa.ForeignKey("profiles.id"), nullable=False
        ),
        sa.Column("parent_id", sa.Uuid(), sa.ForeignKey("parents.id"), nullable=False),
        sa.Column("code_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_link_codes_child_profile_id", "link_codes", ["child_profile_id"]
    )
    op.create_index("ix_link_codes_parent_id", "link_codes", ["parent_id"])


def downgrade() -> None:
    op.drop_table("link_codes")
