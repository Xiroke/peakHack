from alembic import op
import sqlalchemy as sa

revision = "20261014_0003"
down_revision = "20261013_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("has_temp_sensitive_products", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(
        "UPDATE orders SET has_temp_sensitive_products = 1 WHERE EXISTS ("
        "SELECT 1 FROM order_items JOIN products ON products.id = order_items.product_id "
        "WHERE order_items.order_id = orders.id AND products.temp_sensitive = 1)"
    )
    op.add_column(
        "orders",
        sa.Column("thermal_packaging_applied", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("orders", "thermal_packaging_applied")
    op.drop_column("orders", "has_temp_sensitive_products")
