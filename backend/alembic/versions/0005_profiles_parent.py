"""Children belong to a parent; new children have no email (parent sign-in, step 3)

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-19
"""

from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # batch mode so the same migration also runs on SQLite
    with op.batch_alter_table("profiles") as batch:
        batch.add_column(sa.Column("parent_id", sa.Uuid(), nullable=True))
        batch.create_foreign_key(
            "fk_profiles_parent_id_parents", "parents", ["parent_id"], ["id"]
        )
        batch.create_index("ix_profiles_parent_id", ["parent_id"])
        batch.alter_column("email", existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    # Fails if a child without email exists: those rows would need an email first.
    with op.batch_alter_table("profiles") as batch:
        batch.alter_column("email", existing_type=sa.Text(), nullable=False)
        batch.drop_index("ix_profiles_parent_id")
        batch.drop_constraint("fk_profiles_parent_id_parents", type_="foreignkey")
        batch.drop_column("parent_id")
