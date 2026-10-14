from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from uuid import uuid4

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.database import Base


class Region(StrEnum):
    YAKUTIA = "yakutia"
    DNR = "dnr"


class WaveDirection(StrEnum):
    YAKUTIA_TO_DNR = "yakutia_to_dnr"
    DNR_TO_YAKUTIA = "dnr_to_yakutia"


class OrderStatus(StrEnum):
    ACCEPTED = "accepted"
    ASSEMBLING = "assembling"
    IN_TRANSIT = "in_transit"
    PICKUP_POINT = "pickup_point"
    RECEIVED = "received"


class WaveStatus(StrEnum):
    OPEN = "open"
    CLOSED = "closed"
    DISPATCHED = "dispatched"
    COMPLETED = "completed"


class EnumValue(TypeDecorator):
    impl = String(32)
    cache_ok = True

    class Comparator(TypeDecorator.Comparator):
        def __eq__(self, other):
            if isinstance(other, StrEnum):
                return func.lower(self.expr) == other.value
            return super().__eq__(other)

    comparator_factory = Comparator

    def __init__(self, enum_type: type[StrEnum]):
        self.enum_type = enum_type
        super().__init__()

    def process_bind_param(self, value: StrEnum | str | None, dialect):
        if value is None:
            return None
        if isinstance(value, self.enum_type):
            return value.value
        return self.enum_type(str(value).lower()).value

    def process_result_value(self, value: str | None, dialect):
        if value is None:
            return None
        return self.enum_type(value.lower())


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    region: Mapped[Region] = mapped_column(EnumValue(Region), index=True)
    manufacturer: Mapped[str] = mapped_column(String(160), index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    category: Mapped[str] = mapped_column(String(120), index=True)
    weight_g: Mapped[int] = mapped_column(Integer)
    price_rub: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    temp_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    shelf_life_days: Mapped[int] = mapped_column(Integer)
    photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    order_items: Mapped[list[OrderItem]] = relationship(back_populates="product")


class Wave(Base):
    __tablename__ = "waves"

    id: Mapped[int] = mapped_column(primary_key=True)
    direction: Mapped[WaveDirection] = mapped_column(EnumValue(WaveDirection), index=True)
    dispatch_date: Mapped[date] = mapped_column(Date, index=True)
    order_deadline: Mapped[date] = mapped_column(Date, index=True)
    min_weight_kg: Mapped[int] = mapped_column(Integer, default=50)
    max_weight_kg: Mapped[int] = mapped_column(Integer, default=300)
    status: Mapped[WaveStatus] = mapped_column(EnumValue(WaveStatus), default=WaveStatus.OPEN)

    orders: Mapped[list[Order]] = relationship(back_populates="wave")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    public_id: Mapped[str] = mapped_column(String(36), default=lambda: str(uuid4()), unique=True, index=True)
    idempotency_key: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    wave_id: Mapped[int] = mapped_column(ForeignKey("waves.id"), index=True)
    recipient_region: Mapped[Region] = mapped_column(EnumValue(Region))
    recipient_name: Mapped[str] = mapped_column(String(160))
    recipient_phone: Mapped[str] = mapped_column(String(32))
    recipient_address: Mapped[str] = mapped_column(String(500))
    card_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_gift: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[OrderStatus] = mapped_column(EnumValue(OrderStatus), default=OrderStatus.ACCEPTED)
    products_total_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    shipping_cost_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    has_temp_sensitive_products: Mapped[bool] = mapped_column(Boolean, default=False)
    thermal_packaging_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    thermal_packaging_cost_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    total_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    wave: Mapped[Wave] = relationship(back_populates="orders")
    items: Mapped[list[OrderItem]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price_rub: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    weight_g: Mapped[int] = mapped_column(Integer)

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(back_populates="order_items")
