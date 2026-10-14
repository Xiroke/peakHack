from decimal import Decimal
from secrets import compare_digest

from fastapi import APIRouter, Depends, File, Header, HTTPException, Query, UploadFile
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload, selectinload

from app.admin_schemas import (
    AdminOrderResponse,
    AdminOrderStatusInput,
    AdminProductInput,
    AdminProductResponse,
    AdminSessionResponse,
    ProductImageResponse,
    AdminWaveInput,
    AdminWaveResponse,
)
from app.api.orders import serialize_order
from app.api.waves import wave_response
from app.config import settings
from app.database import get_db
from app.models import Order, OrderItem, OrderStatus, Product, Region, Wave, WaveDirection
from app.product_media import MAX_PRODUCT_IMAGE_BYTES, PRODUCT_IMAGES_DIRECTORY, create_image_url, detect_image_extension
from app.services.delivery import calculate_rate
from app.services.orders import order_with_details


def require_admin(authorization: str | None = Header(default=None)) -> None:
    if not settings.admin_token:
        raise HTTPException(status_code=503, detail="Административный доступ не настроен.")
    scheme, separator, credential = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not separator or not compare_digest(
        credential.encode("utf-8"), settings.admin_token.encode("utf-8")
    ):
        raise HTTPException(
            status_code=401,
            detail="Неверный административный токен.",
            headers={"WWW-Authenticate": "Bearer"},
        )


router = APIRouter(prefix="/admin", tags=["Администрирование"], dependencies=[Depends(require_admin)])


@router.get("/session", response_model=AdminSessionResponse, summary="Проверить административный доступ")
def admin_session() -> AdminSessionResponse:
    return AdminSessionResponse(status="ok")


@router.post("/product-images", response_model=ProductImageResponse, status_code=201, summary="Загрузить фото товара")
async def upload_product_image(file: UploadFile = File(...)) -> ProductImageResponse:
    content = await file.read(MAX_PRODUCT_IMAGE_BYTES + 1)
    if len(content) > MAX_PRODUCT_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="Размер изображения не должен превышать 5 МБ.")
    extension = detect_image_extension(content)
    if extension is None:
        raise HTTPException(status_code=422, detail="Поддерживаются только изображения JPEG, PNG и WebP.")
    PRODUCT_IMAGES_DIRECTORY.mkdir(parents=True, exist_ok=True)
    path, photo = create_image_url(extension)
    path.write_bytes(content)
    return ProductImageResponse(photo=photo)


@router.get("/products", response_model=list[AdminProductResponse], summary="Все товары")
def list_admin_products(
    region: Region | None = None,
    is_active: bool | None = None,
    database: Session = Depends(get_db),
) -> list[Product]:
    statement = select(Product)
    if region is not None:
        statement = statement.where(Product.region == region)
    if is_active is not None:
        statement = statement.where(Product.is_active.is_(is_active))
    return list(database.scalars(statement.order_by(Product.id.desc())))


@router.post("/products", response_model=AdminProductResponse, status_code=201, summary="Создать товар")
def create_admin_product(payload: AdminProductInput, database: Session = Depends(get_db)) -> Product:
    product = Product(**payload.model_dump())
    database.add(product)
    database.commit()
    database.refresh(product)
    return product


@router.get("/products/{product_id}", response_model=AdminProductResponse, summary="Карточка товара")
def get_admin_product(product_id: int, database: Session = Depends(get_db)) -> Product:
    product = database.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Товар не найден.")
    return product


@router.put("/products/{product_id}", response_model=AdminProductResponse, summary="Изменить товар")
def update_admin_product(product_id: int, payload: AdminProductInput, database: Session = Depends(get_db)) -> Product:
    product = get_admin_product(product_id, database)
    for field, value in payload.model_dump().items():
        setattr(product, field, value)
    database.commit()
    database.refresh(product)
    return product


@router.delete("/products/{product_id}", response_model=AdminProductResponse, summary="Скрыть товар")
def delete_admin_product(product_id: int, database: Session = Depends(get_db)) -> Product:
    product = get_admin_product(product_id, database)
    product.is_active = False
    database.commit()
    database.refresh(product)
    return product


def admin_wave_response(database: Session, wave: Wave) -> AdminWaveResponse:
    details = wave_response(database, wave)
    order_count, orders_total = database.execute(
        select(func.count(Order.id), func.coalesce(func.sum(Order.total_rub), 0)).where(Order.wave_id == wave.id)
    ).one()
    current_fill = details.current_weight_kg * Decimal("100") / wave.max_weight_kg
    current_rate, _ = calculate_rate(current_fill)
    return AdminWaveResponse(
        **details.model_dump(),
        order_count=order_count,
        orders_total_rub=orders_total,
        current_rate_rub_per_kg=current_rate,
    )


@router.get("/waves", response_model=list[AdminWaveResponse], summary="Все волны")
def list_admin_waves(
    direction: WaveDirection | None = None,
    database: Session = Depends(get_db),
) -> list[AdminWaveResponse]:
    statement = select(Wave)
    if direction is not None:
        statement = statement.where(Wave.direction == direction)
    waves = database.scalars(statement.order_by(Wave.dispatch_date.desc(), Wave.id.desc()))
    return [admin_wave_response(database, wave) for wave in waves]


@router.post("/waves", response_model=AdminWaveResponse, status_code=201, summary="Создать волну")
def create_admin_wave(payload: AdminWaveInput, database: Session = Depends(get_db)) -> AdminWaveResponse:
    wave = Wave(**payload.model_dump())
    database.add(wave)
    database.commit()
    database.refresh(wave)
    return admin_wave_response(database, wave)


@router.get("/waves/{wave_id}", response_model=AdminWaveResponse, summary="Детали волны")
def get_admin_wave(wave_id: int, database: Session = Depends(get_db)) -> AdminWaveResponse:
    wave = database.get(Wave, wave_id)
    if wave is None:
        raise HTTPException(status_code=404, detail="Волна не найдена.")
    return admin_wave_response(database, wave)


def serialize_admin_order(order: Order) -> AdminOrderResponse:
    return AdminOrderResponse(
        **serialize_order(order).model_dump(),
        id=order.id,
        recipient_region=order.recipient_region,
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        recipient_address=order.recipient_address,
        card_message=order.card_message,
    )


@router.get("/orders", response_model=list[AdminOrderResponse], summary="Список заказов")
def list_admin_orders(
    status: OrderStatus | None = None,
    direction: WaveDirection | None = None,
    wave_id: int | None = Query(default=None, gt=0),
    database: Session = Depends(get_db),
) -> list[AdminOrderResponse]:
    statement = (
        select(Order)
        .join(Wave, Order.wave_id == Wave.id)
        .options(joinedload(Order.wave), selectinload(Order.items).joinedload(OrderItem.product))
    )
    if status is not None:
        statement = statement.where(Order.status == status)
    if direction is not None:
        statement = statement.where(Wave.direction == direction)
    if wave_id is not None:
        statement = statement.where(Order.wave_id == wave_id)
    orders = database.scalars(statement.order_by(Order.created_at.desc(), Order.id.desc()))
    return [serialize_admin_order(order) for order in orders]


@router.get("/orders/{order_id}", response_model=AdminOrderResponse, summary="Детали заказа")
def get_admin_order(order_id: int, database: Session = Depends(get_db)) -> AdminOrderResponse:
    order = order_with_details(database, order_id=order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Заказ не найден.")
    return serialize_admin_order(order)


@router.patch("/orders/{order_id}/status", response_model=AdminOrderResponse, summary="Изменить статус заказа")
def update_admin_order_status(
    order_id: int,
    payload: AdminOrderStatusInput,
    database: Session = Depends(get_db),
) -> AdminOrderResponse:
    try:
        database.execute(text("BEGIN IMMEDIATE"))
        order = order_with_details(database, order_id=order_id)
        if order is None:
            raise HTTPException(status_code=404, detail="Заказ не найден.")
        statuses = list(OrderStatus)
        current_index = statuses.index(order.status)
        if current_index + 1 >= len(statuses) or payload.status != statuses[current_index + 1]:
            raise HTTPException(status_code=409, detail="Статус можно перевести только на следующий этап.")
        order.status = payload.status
        database.commit()
    except Exception:
        database.rollback()
        raise
    return get_admin_order(order_id, database)
