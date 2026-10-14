from uuid import uuid4

from alembic import op
import sqlalchemy as sa

revision = "20261013_0002"
down_revision = "20261013_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("public_id", sa.String(length=36), nullable=True))
    op.add_column("orders", sa.Column("idempotency_key", sa.String(length=36), nullable=True))
    connection = op.get_bind()
    for order_id in connection.execute(sa.text("SELECT id FROM orders")).scalars().all():
        connection.execute(
            sa.text("UPDATE orders SET public_id = :public_id, idempotency_key = :key WHERE id = :id"),
            {"id": order_id, "public_id": str(uuid4()), "key": str(uuid4())},
        )
    for table, column in (
        ("products", "region"),
        ("waves", "direction"),
        ("waves", "status"),
        ("orders", "recipient_region"),
        ("orders", "status"),
    ):
        connection.execute(sa.text(f"UPDATE {table} SET {column} = lower({column})"))
    with op.batch_alter_table("orders") as batch_op:
        batch_op.alter_column("public_id", existing_type=sa.String(36), nullable=False)
        batch_op.alter_column("idempotency_key", existing_type=sa.String(36), nullable=False)
    op.create_index("ix_orders_public_id", "orders", ["public_id"], unique=True)
    op.create_index("ix_orders_idempotency_key", "orders", ["idempotency_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_orders_idempotency_key", table_name="orders")
    op.drop_index("ix_orders_public_id", table_name="orders")
    with op.batch_alter_table("orders") as batch_op:
        batch_op.drop_column("idempotency_key")
        batch_op.drop_column("public_id")
