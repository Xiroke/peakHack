from alembic import op
import sqlalchemy as sa

revision = "20261014_0005"
down_revision = "20261014_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE products SET photo = replace(photo, '.webp', '.jpg') WHERE photo LIKE '/media/products/%.webp'")
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE products SET photo = replace(photo, '.jpg', '.webp') WHERE photo LIKE '/media/products/%.jpg'")
    )
