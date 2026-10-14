"""Create the initial marketplace schema.

Revision ID: 20261013_0001
Revises:
Create Date: 2026-10-13
"""

from alembic import op
import sqlalchemy as sa

revision = "20261013_0001"
down_revision = None
branch_labels = None
depends_on = None

region = sa.Enum("yakutia", "dnr", name="region", native_enum=False, create_constraint=True)
wave_direction = sa.Enum(
    "yakutia_to_dnr",
    "dnr_to_yakutia",
    name="wave_direction",
    native_enum=False,
    create_constraint=True,
)
order_status = sa.Enum(
    "accepted",
    "assembling",
    "in_transit",
    "pickup_point",
    "received",
    name="order_status",
    native_enum=False,
    create_constraint=True,
)
wave_status = sa.Enum(
    "open",
    "closed",
    "dispatched",
    "completed",
    name="wave_status",
    native_enum=False,
    create_constraint=True,
)


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("region", region, nullable=False),
        sa.Column("manufacturer", sa.String(length=160), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("category", sa.String(length=120), nullable=False),
        sa.Column("weight_g", sa.Integer(), nullable=False),
        sa.Column("price_rub", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("temp_sensitive", sa.Boolean(), nullable=False),
        sa.Column("shelf_life_days", sa.Integer(), nullable=False),
        sa.Column("photo", sa.String(length=500), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_products_region", "products", ["region"])
    op.create_index("ix_products_manufacturer", "products", ["manufacturer"])
    op.create_index("ix_products_name", "products", ["name"])
    op.create_index("ix_products_category", "products", ["category"])
    op.create_index("ix_products_is_active", "products", ["is_active"])

    op.create_table(
        "waves",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("direction", wave_direction, nullable=False),
        sa.Column("dispatch_date", sa.Date(), nullable=False),
        sa.Column("order_deadline", sa.Date(), nullable=False),
        sa.Column("min_weight_kg", sa.Integer(), nullable=False),
        sa.Column("max_weight_kg", sa.Integer(), nullable=False),
        sa.Column("status", wave_status, nullable=False),
    )
    op.create_index("ix_waves_direction", "waves", ["direction"])
    op.create_index("ix_waves_dispatch_date", "waves", ["dispatch_date"])
    op.create_index("ix_waves_order_deadline", "waves", ["order_deadline"])

    op.create_table(
        "orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("wave_id", sa.Integer(), sa.ForeignKey("waves.id"), nullable=False),
        sa.Column("recipient_region", region, nullable=False),
        sa.Column("recipient_name", sa.String(length=160), nullable=False),
        sa.Column("recipient_phone", sa.String(length=32), nullable=False),
        sa.Column("recipient_address", sa.String(length=500), nullable=False),
        sa.Column("card_message", sa.Text(), nullable=True),
        sa.Column("is_gift", sa.Boolean(), nullable=False),
        sa.Column("status", order_status, nullable=False),
        sa.Column("products_total_rub", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("shipping_cost_rub", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("thermal_packaging_cost_rub", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("total_rub", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_orders_wave_id", "orders", ["wave_id"])

    op.create_table(
        "order_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit_price_rub", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("weight_g", sa.Integer(), nullable=False),
    )
    op.create_index("ix_order_items_order_id", "order_items", ["order_id"])
    op.create_index("ix_order_items_product_id", "order_items", ["product_id"])


def downgrade() -> None:
    op.drop_index("ix_order_items_product_id", table_name="order_items")
    op.drop_index("ix_order_items_order_id", table_name="order_items")
    op.drop_table("order_items")
    op.drop_index("ix_orders_wave_id", table_name="orders")
    op.drop_table("orders")
    op.drop_index("ix_waves_order_deadline", table_name="waves")
    op.drop_index("ix_waves_dispatch_date", table_name="waves")
    op.drop_index("ix_waves_direction", table_name="waves")
    op.drop_table("waves")
    op.drop_index("ix_products_is_active", table_name="products")
    op.drop_index("ix_products_category", table_name="products")
    op.drop_index("ix_products_name", table_name="products")
    op.drop_index("ix_products_manufacturer", table_name="products")
    op.drop_index("ix_products_region", table_name="products")
    op.drop_table("products")
