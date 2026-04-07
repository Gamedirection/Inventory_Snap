"""Add per-item floor plan pin coordinates

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-07
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("items", sa.Column("floor_plan_x", sa.Double(), nullable=True))
    op.add_column("items", sa.Column("floor_plan_y", sa.Double(), nullable=True))


def downgrade() -> None:
    op.drop_column("items", "floor_plan_y")
    op.drop_column("items", "floor_plan_x")
