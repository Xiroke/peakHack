from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models import OrderStatus, Region, WaveDirection
from app.schemas import OrderResponse, ProductResponse, WaveResponse


class AdminSessionResponse(BaseModel):
    status: Literal["ok"]


class ProductImageResponse(BaseModel):
    photo: str


class AdminProductInput(BaseModel):
    region: Region
    manufacturer: str = Field(min_length=1, max_length=160)
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(min_length=1, max_length=120)
    weight_g: int = Field(gt=0, strict=True)
    price_rub: Decimal = Field(gt=0, max_digits=10, decimal_places=2)
    temp_sensitive: bool
    shelf_life_days: int = Field(gt=0, strict=True)
    photo: str | None = Field(default=None, max_length=500)
    description: str = Field(min_length=1, max_length=4000)
    is_active: bool = True

    @field_validator("manufacturer", "name", "category", "description")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        result = value.strip()
        if not result:
            raise ValueError("Поле не может быть пустым.")
        return result


class AdminProductResponse(ProductResponse):
    is_active: bool


class AdminWaveInput(BaseModel):
    direction: WaveDirection
    dispatch_date: date
    order_deadline: date
    min_weight_kg: int = Field(default=50, gt=0, strict=True)
    max_weight_kg: int = Field(default=300, gt=0, strict=True)

    @model_validator(mode="after")
    def validate_dates_and_capacity(self) -> "AdminWaveInput":
        if self.order_deadline < date.today() or self.order_deadline >= self.dispatch_date:
            raise ValueError("Дедлайн должен быть не раньше сегодня и раньше даты отправки.")
        if self.min_weight_kg > self.max_weight_kg:
            raise ValueError("Минимальный вес не может превышать вместимость волны.")
        return self


class AdminWaveResponse(WaveResponse):
    order_count: int
    orders_total_rub: Decimal
    current_rate_rub_per_kg: Decimal


class AdminOrderResponse(OrderResponse):
    id: int
    recipient_region: Region
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    card_message: str | None


class AdminOrderStatusInput(BaseModel):
    status: OrderStatus
