from alembic import op
import sqlalchemy as sa

revision = "20261014_0004"
down_revision = "20261014_0003"
branch_labels = None
depends_on = None

PHOTO_PATHS = {
    1: "/media/products/yakutia-01-yakutskie-uzory.jpg",
    2: "/media/products/yakutia-02-lenskie-berega.jpg",
    3: "/media/products/yakutia-03-polyarnaya-zvezda.jpg",
    4: "/media/products/yakutia-04-marmelad-brusnika.jpg",
    5: "/media/products/yakutia-05-karamel-tayozhnaya.jpg",
    6: "/media/products/yakutia-06-pastila-chernika.jpg",
    7: "/media/products/yakutia-07-iris-zolotaya-tayga.jpg",
    8: "/media/products/yakutia-08-severnoe-siyanie.jpg",
    9: "/media/products/yakutia-09-vafli-aldan.jpg",
    10: "/media/products/yakutia-10-drazhe-kedrovy-oreh.jpg",
    11: "/media/products/dnr-11-donetskiy-vecher.jpg",
    12: "/media/products/dnr-12-shahtyorskiy.jpg",
    14: "/media/products/dnr-14-pechenye-terrikony.jpg",
    15: "/media/products/dnr-15-karamel-rassvet.jpg",
    16: "/media/products/dnr-16-marmelad-abrikosovy-sad.jpg",
    17: "/media/products/dnr-17-tyoplaya-vstrecha.jpg",
    18: "/media/products/dnr-18-vafli-donbasskie.jpg",
    19: "/media/products/dnr-19-drazhe-ugolki.jpg",
    20: "/media/products/dnr-20-pryaniki-domashnie.jpg",
}


def upgrade() -> None:
    connection = op.get_bind()
    for product_id, photo in PHOTO_PATHS.items():
        connection.execute(
            sa.text("UPDATE products SET photo = :photo WHERE id = :id AND photo IS NULL"),
            {"id": product_id, "photo": photo},
        )


def downgrade() -> None:
    connection = op.get_bind()
    for product_id, photo in PHOTO_PATHS.items():
        connection.execute(
            sa.text("UPDATE products SET photo = NULL WHERE id = :id AND photo = :photo"),
            {"id": product_id, "photo": photo},
        )
