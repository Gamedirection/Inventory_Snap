"""Initial schema

Revision ID: 0001
Revises:
Create Date: 2026-04-06
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.Text(), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("is_superuser", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── sites ─────────────────────────────────────────────────────────────────
    op.create_table(
        "sites",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Double(), nullable=True),
        sa.Column("longitude", sa.Double(), nullable=True),
        sa.Column("timezone", sa.String(64), server_default="UTC", nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── site_memberships ──────────────────────────────────────────────────────
    op.create_table(
        "site_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("invite_token", sa.String(64), nullable=True),
        sa.Column("invite_email", sa.String(255), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["invited_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("site_id", "user_id", name="uq_site_membership"),
        sa.UniqueConstraint("invite_token"),
    )
    op.create_index("ix_site_memberships_site_id", "site_memberships", ["site_id"])
    op.create_index("ix_site_memberships_user_id", "site_memberships", ["user_id"])
    op.create_index("ix_site_memberships_invite_token", "site_memberships", ["invite_token"])

    # ── locations ─────────────────────────────────────────────────────────────
    op.create_table(
        "locations",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("level", sa.String(20), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("floor_plan_x", sa.Double(), nullable=True),
        sa.Column("floor_plan_y", sa.Double(), nullable=True),
        sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["parent_id"], ["locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_locations_site_id", "locations", ["site_id"])
    op.create_index("ix_locations_parent_id", "locations", ["parent_id"])
    op.create_index("ix_locations_site_level", "locations", ["site_id", "level"])

    # ── floor_maps ────────────────────────────────────────────────────────────
    op.create_table(
        "floor_maps",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("image_object_key", sa.Text(), nullable=True),
        sa.Column("vector_data", postgresql.JSONB(), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("location_id"),
    )

    # ── photos ────────────────────────────────────────────────────────────────
    op.create_table(
        "photos",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("original_object_key", sa.Text(), nullable=False),
        sa.Column("thumbnail_object_key", sa.Text(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("upload_ip", postgresql.INET(), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("mime_type", sa.String(50), nullable=True),
        sa.Column("exif_data", postgresql.JSONB(), nullable=True),
        sa.Column("gps_latitude", sa.Double(), nullable=True),
        sa.Column("gps_longitude", sa.Double(), nullable=True),
        sa.Column("ai_status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("ai_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ai_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ai_provider", sa.String(50), nullable=True),
        sa.Column("ai_model", sa.String(100), nullable=True),
        sa.Column("ai_raw_response", postgresql.JSONB(), nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_photos_site_id", "photos", ["site_id"])
    op.create_index("ix_photos_location_id", "photos", ["location_id"])
    op.create_index("ix_photos_ai_status", "photos", ["ai_status"])
    op.create_index("ix_photos_site_ai_status", "photos", ["site_id", "ai_status"])

    # ── items ─────────────────────────────────────────────────────────────────
    op.create_table(
        "items",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("location_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("item_type", sa.String(20), server_default="unique", nullable=False),
        sa.Column("object_name", sa.String(255), nullable=False),
        sa.Column("short_description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("brand", sa.String(100), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("condition", sa.String(20), server_default="unknown", nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("owner_contact_name", sa.String(255), nullable=True),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("serial_numbers", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("barcodes", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("purchase_location", sa.String(255), nullable=True),
        sa.Column("purchase_price_cents", sa.Integer(), nullable=True),
        sa.Column("estimated_value_cents", sa.Integer(), nullable=True),
        sa.Column("currency_code", sa.String(3), server_default="USD", nullable=False),
        sa.Column("warranty_expires_at", sa.Date(), nullable=True),
        sa.Column("warranty_notes", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("custom_tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("primary_photo_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("gps_latitude", sa.Double(), nullable=True),
        sa.Column("gps_longitude", sa.Double(), nullable=True),
        sa.Column("confidence_score", sa.Double(), nullable=True),
        sa.Column("verification_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("source_proposed_item_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("lost_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["primary_photo_id"], ["photos.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_items_site_id", "items", ["site_id"])
    op.create_index("ix_items_location_id", "items", ["location_id"])
    op.create_index("ix_items_site_location", "items", ["site_id", "location_id"])
    op.create_index("ix_items_category", "items", ["category"])
    op.create_index("ix_items_owner", "items", ["owner_user_id"])
    # Full-text search index
    op.execute("""
        CREATE INDEX ix_items_fts ON items
        USING gin(to_tsvector('english',
            coalesce(object_name,'') || ' ' ||
            coalesce(short_description,'') || ' ' ||
            coalesce(notes,'') || ' ' ||
            coalesce(brand,'') || ' ' ||
            coalesce(model,'')
        ))
    """)

    # ── proposed_items ────────────────────────────────────────────────────────
    op.create_table(
        "proposed_items",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("photo_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("detection_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("bounding_box", postgresql.JSONB(), nullable=True),
        sa.Column("object_name", sa.String(255), nullable=True),
        sa.Column("short_description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("brand", sa.String(100), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("serial_numbers", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("barcodes", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("confidence_score", sa.Double(), nullable=True),
        sa.Column("ai_suggested_tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("duplicate_of_proposed_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("duplicate_of_item_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("review_status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("merged_into_item_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["duplicate_of_item_id"], ["items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["duplicate_of_proposed_id"], ["proposed_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["merged_into_item_id"], ["items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_proposed_items_photo_id", "proposed_items", ["photo_id"])
    op.create_index("ix_proposed_items_review_status", "proposed_items", ["review_status"])

    # Add FK from items.source_proposed_item_id (after proposed_items table exists)
    op.create_foreign_key(
        "fk_items_source_proposed",
        "items", "proposed_items",
        ["source_proposed_item_id"], ["id"],
        ondelete="SET NULL"
    )

    # ── item_photos ───────────────────────────────────────────────────────────
    op.create_table(
        "item_photos",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("photo_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("proposed_item_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("is_primary", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["proposed_item_id"], ["proposed_items.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("item_id", "photo_id", name="uq_item_photo"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_item_photos_item_id", "item_photos", ["item_id"])
    op.create_index("ix_item_photos_photo_id", "item_photos", ["photo_id"])

    # ── item_documents ────────────────────────────────────────────────────────
    op.create_table(
        "item_documents",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("object_key", sa.Text(), nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=True),
        sa.Column("document_type", sa.String(20), server_default="other", nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_item_documents_item_id", "item_documents", ["item_id"])

    # ── movements ─────────────────────────────────────────────────────────────
    op.create_table(
        "movements",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("item_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("from_location_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("to_location_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("moved_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("moved_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("photo_evidence_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("proposed_item_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["from_location_id"], ["locations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["item_id"], ["items.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["moved_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["photo_evidence_id"], ["photos.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["proposed_item_id"], ["proposed_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["to_location_id"], ["locations.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_movements_item_id", "movements", ["item_id"])
    op.create_index("ix_movements_item_moved_at", "movements", ["item_id", "moved_at"])

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("before_state", postgresql.JSONB(), nullable=True),
        sa.Column("after_state", postgresql.JSONB(), nullable=True),
        sa.Column("ip_address", postgresql.INET(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_site_id", "audit_logs", ["site_id"])
    op.create_index("ix_audit_logs_actor", "audit_logs", ["actor_user_id"])
    op.create_index("ix_audit_logs_resource", "audit_logs", ["resource_type", "resource_id"])
    op.create_index("ix_audit_logs_created_at", "audit_logs", ["created_at"])

    # ── export_jobs ───────────────────────────────────────────────────────────
    op.create_table(
        "export_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=False), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=False), nullable=True),
        sa.Column("filters", postgresql.JSONB(), nullable=True),
        sa.Column("format", sa.String(10), server_default="xlsx", nullable=False),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("object_key", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["requested_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["site_id"], ["sites.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_export_jobs_site_id", "export_jobs", ["site_id"])
    op.create_index("ix_export_jobs_status", "export_jobs", ["status"])


def downgrade() -> None:
    op.drop_table("export_jobs")
    op.drop_table("audit_logs")
    op.drop_table("movements")
    op.drop_table("item_documents")
    op.drop_table("item_photos")
    op.drop_constraint("fk_items_source_proposed", "items", type_="foreignkey")
    op.drop_table("proposed_items")
    op.drop_table("items")
    op.drop_table("photos")
    op.drop_table("floor_maps")
    op.drop_table("locations")
    op.drop_table("site_memberships")
    op.drop_table("sites")
    op.drop_table("users")
