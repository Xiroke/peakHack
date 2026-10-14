from pathlib import Path
from uuid import uuid4

PRODUCT_IMAGES_DIRECTORY = Path(__file__).resolve().parents[1] / "data" / "products"
PRODUCT_IMAGES_URL_PREFIX = "/media/products"
MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024

DEFAULT_PRODUCT_PHOTOS = {
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


def detect_image_extension(content: bytes) -> str | None:
    if content.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "webp"
    return None


def create_image_url(extension: str) -> tuple[Path, str]:
    filename = f"{uuid4()}.{extension}"
    return PRODUCT_IMAGES_DIRECTORY / filename, f"{PRODUCT_IMAGES_URL_PREFIX}/{filename}"
