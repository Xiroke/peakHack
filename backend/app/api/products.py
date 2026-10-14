from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, Region
from app.schemas import ProductMetaResponse, ProductResponse

router = APIRouter(prefix="/products", tags=["Каталог"])


def active_products_query():
    return select(Product).where(Product.is_active.is_(True))


@router.get("/meta", response_model=ProductMetaResponse, summary="Значения фильтров каталога")
def get_product_meta(
    region: Region | None = None,
    database: Session = Depends(get_db),
) -> ProductMetaResponse:
    conditions = [Product.is_active.is_(True)]
    if region is not None:
        conditions.append(Product.region == region)

    categories = database.scalars(
        select(Product.category).where(*conditions).distinct().order_by(Product.category.asc())
    ).all()
    manufacturers = database.scalars(
        select(Product.manufacturer).where(*conditions).distinct().order_by(Product.manufacturer.asc())
    ).all()

    return ProductMetaResponse(categories=categories, manufacturers=manufacturers)


@router.get("", response_model=list[ProductResponse], summary="Список товаров")
def list_products(
    region: Region | None = None,
    category: str | None = Query(default=None, min_length=1, max_length=120),
    manufacturer: str | None = Query(default=None, min_length=1, max_length=160),
    search: str | None = Query(default=None, min_length=1, max_length=100),
    temp_sensitive: bool | None = None,
    min_price: Decimal | None = Query(default=None, ge=0),
    max_price: Decimal | None = Query(default=None, ge=0),
    database: Session = Depends(get_db),
) -> list[Product]:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=422, detail="Минимальная цена не может быть больше максимальной.")

    statement = active_products_query()
    if region is not None:
        statement = statement.where(Product.region == region)
    if category is not None:
        statement = statement.where(Product.category == category)
    if manufacturer is not None:
        statement = statement.where(Product.manufacturer == manufacturer)
    if temp_sensitive is not None:
        statement = statement.where(Product.temp_sensitive.is_(temp_sensitive))
    if min_price is not None:
        statement = statement.where(Product.price_rub >= min_price)
    if max_price is not None:
        statement = statement.where(Product.price_rub <= max_price)

    products = list(database.scalars(statement.order_by(Product.name.asc(), Product.id.asc())))
    normalized_search = search.strip().casefold() if search is not None else ""
    if normalized_search:
        products = [
            product
            for product in products
            if normalized_search in product.name.casefold() or normalized_search in product.manufacturer.casefold()
        ]

    return products


@router.get("/{product_id}", response_model=ProductResponse, summary="Карточка товара")
def get_product(product_id: int, database: Session = Depends(get_db)) -> Product:
    product = database.scalar(active_products_query().where(Product.id == product_id))
    if product is None:
        raise HTTPException(status_code=404, detail="Товар не найден.")
    return product
