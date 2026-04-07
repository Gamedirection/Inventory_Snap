"""Add item floor plan pin instances

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-07
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "item_floor_plan_pins",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("pin_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("x", sa.Double(), nullable=False),
        sa.Column("y", sa.Double(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_item_floor_plan_pins_item_id", "item_floor_plan_pins", ["item_id"])
    op.create_unique_constraint(
        "uq_item_floor_plan_pins_item_index",
        "item_floor_plan_pins",
        ["item_id", "pin_index"],
    )

    op.execute(
        """
        INSERT INTO item_floor_plan_pins (item_id, pin_index, x, y)
        SELECT id, 0, floor_plan_x, floor_plan_y
        FROM items
        WHERE floor_plan_x IS NOT NULL AND floor_plan_y IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_constraint("uq_item_floor_plan_pins_item_index", "item_floor_plan_pins", type_="unique")
    op.drop_index("ix_item_floor_plan_pins_item_id", table_name="item_floor_plan_pins")
    op.drop_table("item_floor_plan_pins")
