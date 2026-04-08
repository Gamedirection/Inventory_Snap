"""Add annotation_bbox to item_photos and location_id update support

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-08
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Store where in a photo an item was pinned — set by AI review or manual pinning
    op.add_column(
        "item_photos",
        sa.Column("annotation_bbox", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("item_photos", "annotation_bbox")
