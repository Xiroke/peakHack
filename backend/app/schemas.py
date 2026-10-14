from datetime import date, datetime
from decimal import Decimal
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator, model_validator

from app.models import OrderStatus, Region, WaveDirection, WaveStatus


class HealthResponse(BaseModel):
    status: Literal["ok"]


class ApiErrorBody(BaseModel):
    code: str
    message: str
    details: list[dict[str, object]] | None = None


class ApiErrorResponse(BaseModel):
    error: ApiErrorBody


class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    region: Region
    manufacturer: str
    name: str
    category: str
    weight_g: int
    price_rub: Decimal
    temp_sensitive: bool
    shelf_life_days: int
    photo: str | None
    description: str


class ProductMetaResponse(BaseModel):
    categories: list[str]
    manufacturers: list[str]


class CartLineRequest(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=1000, strict=True)


class DeliveryEstimateRequest(BaseModel):
    wave_id: int = Field(gt=0)
    recipient_region: Region
    items: list[CartLineRequest] = Field(min_length=1, max_length=50)
    thermal_packaging_requested: bool = Field(default=False, strict=True)


class ThermalPackagingResponse(BaseModel):
    has_temp_sensitive_products: bool
    available: bool
    required: bool
    applied: bool
    cost_rub: Decimal
    notice: str | None


class WaveResponse(BaseModel):
    id: int
    direction: WaveDirection
    dispatch_date: date
    order_deadline: date
    min_weight_kg: int
    max_weight_kg: int
    status: WaveStatus
    current_weight_kg: Decimal
    current_fill_percent: Decimal
    remaining_weight_kg: Decimal


class DeliveryEstimateResponse(BaseModel):
    wave_id: int
    direction: WaveDirection
    dispatch_date: date
    order_deadline: date
    delivery_min_days: int
    delivery_max_days: int
    expected_delivery_from: date
    expected_delivery_to: date
    thermal_packaging: ThermalPackagingResponse
    order_weight_kg: Decimal
    current_weight_kg: Decimal
    projected_weight_kg: Decimal
    current_fill_percent: Decimal
    projected_fill_percent: Decimal
    remaining_weight_kg: Decimal
    base_rate_rub_per_kg: Decimal
    applied_rate_rub_per_kg: Decimal
    discount_percent: int
    shipping_cost_rub: Decimal
    products_total_rub: Decimal
    total_rub: Decimal
    explanation: str


class OrderCreateRequest(BaseModel):
    wave_id: int = Field(gt=0)
    items: list[CartLineRequest] = Field(min_length=1, max_length=50)
    recipient_region: Region
    recipient_name: str = Field(min_length=2, max_length=160)
    recipient_phone: str = Field(min_length=7, max_length=32)
    recipient_address: str = Field(min_length=5, max_length=500)
    is_gift: bool = False
    card_message: str | None = Field(default=None, max_length=500)
    thermal_packaging_requested: bool = Field(default=False, strict=True)

    @field_validator("recipient_name", "recipient_address")
    @classmethod
    def normalize_required_text(cls, value: str, info: ValidationInfo) -> str:
        normalized_value = value.strip()
        min_length = 2 if info.field_name == "recipient_name" else 5
        if len(normalized_value) < min_length:
            raise ValueError("Заполните обязательное поле.")
        return normalized_value

    @field_validator("recipient_phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        normalized_value = value.strip()
        if not re.fullmatch(r"\+?[0-9 ()-]{7,32}", normalized_value) or not 7 <= len(re.sub(r"\D", "", normalized_value)) <= 15:
            raise ValueError("Укажите номер телефона в допустимом формате.")
        return normalized_value

    @field_validator("card_message")
    @classmethod
    def normalize_card_message(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @model_validator(mode="after")
    def validate_card_message(self) -> "OrderCreateRequest":
        if not self.is_gift and self.card_message is not None:
            raise ValueError("Открытку можно добавить только к подарочному заказу.")
        return self


class OrderItemResponse(BaseModel):
    product_id: int
    name: str
    manufacturer: str
    quantity: int
    unit_price_rub: Decimal
    weight_g: int


class OrderWaveResponse(BaseModel):
    id: int
    direction: WaveDirection
    dispatch_date: date
    order_deadline: date


class OrderResponse(BaseModel):
    public_id: str
    status: OrderStatus
    is_gift: bool
    wave: OrderWaveResponse
    items: list[OrderItemResponse]
    delivery_min_days: int
    delivery_max_days: int
    expected_delivery_from: date
    expected_delivery_to: date
    thermal_packaging: ThermalPackagingResponse
    products_total_rub: Decimal
    shipping_cost_rub: Decimal
    thermal_packaging_cost_rub: Decimal
    total_rub: Decimal
    created_at: datetime


class TrackingStageResponse(BaseModel):
    status: OrderStatus
    state: Literal["completed", "current", "upcoming"]


class TrackingItemResponse(BaseModel):
    name: str
    quantity: int
    unit_price_rub: Decimal


class OrderTrackingResponse(BaseModel):
    public_id: str
    status: OrderStatus
    stages: list[TrackingStageResponse]
    is_gift: bool
    dispatch_date: date
    items: list[TrackingItemResponse]
    delivery_min_days: int
    delivery_max_days: int
    expected_delivery_from: date
    expected_delivery_to: date
    thermal_packaging: ThermalPackagingResponse
    total_rub: Decimal
