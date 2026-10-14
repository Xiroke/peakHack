from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Order, OrderItem, Product, Region, Wave, WaveDirection, WaveStatus
from app.services.seasonal import (
    BASE_DELIVERY_MAX_DAYS,
    BASE_DELIVERY_MIN_DAYS,
    SeasonalShippingPolicy,
    seasonal_shipping_policy,
)

BASE_RATE_RUB_PER_KG = Decimal("500")
HALF_LOADED_PERCENT = Decimal("50")
HIGHLY_LOADED_PERCENT = Decimal("80")


class DeliveryValidationError(ValueError):
    pass


@dataclass(frozen=True)
class CartLine:
    product_id: int
    quantity: int


@dataclass(frozen=True)
class DeliveryEstimate:
    wave: Wave
    direction: WaveDirection
    order_weight_g: int
    current_weight_g: int
    projected_weight_g: int
    current_fill_percent: Decimal
    projected_fill_percent: Decimal
    remaining_weight_g: int
    base_rate_rub_per_kg: Decimal
    applied_rate_rub_per_kg: Decimal
    discount_percent: int
    shipping_cost_rub: Decimal
    products_total_rub: Decimal
    total_rub: Decimal
    explanation: str
    seasonal_policy: SeasonalShippingPolicy
    products: dict[int, Product]
    quantities: dict[int, int]


def direction_for(origin_region: Region) -> WaveDirection:
    if origin_region == Region.YAKUTIA:
        return WaveDirection.YAKUTIA_TO_DNR
    return WaveDirection.DNR_TO_YAKUTIA


def recipient_region_for(origin_region: Region) -> Region:
    if origin_region == Region.YAKUTIA:
        return Region.DNR
    return Region.YAKUTIA


def get_wave_weight_g(database: Session, wave_id: int) -> int:
    total_weight = database.scalar(
        select(func.coalesce(func.sum(OrderItem.weight_g * OrderItem.quantity), 0))
        .select_from(OrderItem)
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.wave_id == wave_id)
    )
    return int(total_weight or 0)


def calculate_fill_percent(weight_g: int, max_weight_kg: int) -> Decimal:
    return (Decimal(weight_g) * Decimal("100") / (Decimal(max_weight_kg) * Decimal("1000"))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )


def calculate_rate(projected_fill_percent: Decimal) -> tuple[Decimal, int]:
    if projected_fill_percent > HIGHLY_LOADED_PERCENT:
        return Decimal("325"), 35
    if projected_fill_percent > HALF_LOADED_PERCENT:
        return Decimal("400"), 20
    return BASE_RATE_RUB_PER_KG, 0


def as_kg(weight_g: int) -> Decimal:
    return (Decimal(weight_g) / Decimal("1000")).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)


def get_active_wave_or_raise(database: Session, wave_id: int) -> Wave:
    wave = database.get(Wave, wave_id)
    if wave is None:
        raise DeliveryValidationError("Волна не найдена.")
    if wave.status != WaveStatus.OPEN:
        raise DeliveryValidationError("Для расчёта можно выбрать только открытую волну.")

    today = date.today()
    if wave.order_deadline < today or wave.dispatch_date <= today:
        raise DeliveryValidationError("Приём заказов в эту волну завершён.")
    return wave


def estimate_delivery(
    database: Session,
    *,
    wave_id: int,
    recipient_region: Region,
    lines: Iterable[CartLine],
    thermal_packaging_requested: bool = False,
) -> DeliveryEstimate:
    aggregated_quantities: dict[int, int] = {}
    for line in lines:
        aggregated_quantities[line.product_id] = aggregated_quantities.get(line.product_id, 0) + line.quantity

    if not aggregated_quantities:
        raise DeliveryValidationError("Добавьте хотя бы один товар для расчёта доставки.")

    products = {
        product.id: product
        for product in database.scalars(select(Product).where(Product.id.in_(aggregated_quantities)))
    }
    missing_product_ids = sorted(set(aggregated_quantities) - set(products))
    if missing_product_ids:
        raise DeliveryValidationError("Один или несколько товаров не найдены.")

    inactive_product_ids = sorted(product.id for product in products.values() if not product.is_active)
    if inactive_product_ids:
        raise DeliveryValidationError("Один или несколько товаров больше недоступны.")

    origin_regions = {product.region for product in products.values()}
    if len(origin_regions) != 1:
        raise DeliveryValidationError("В одной корзине нельзя объединять товары из разных регионов.")

    origin_region = origin_regions.pop()
    expected_recipient_region = recipient_region_for(origin_region)
    if recipient_region != expected_recipient_region:
        raise DeliveryValidationError("Регион получателя не соответствует направлению выбранных товаров.")

    wave = get_active_wave_or_raise(database, wave_id)
    expected_direction = direction_for(origin_region)
    if wave.direction != expected_direction:
        raise DeliveryValidationError("Выбранная волна не соответствует направлению корзины.")

    order_weight_g = sum(products[product_id].weight_g * quantity for product_id, quantity in aggregated_quantities.items())
    current_weight_g = get_wave_weight_g(database, wave.id)
    projected_weight_g = current_weight_g + order_weight_g
    max_weight_g = wave.max_weight_kg * 1000
    if projected_weight_g > max_weight_g:
        raise DeliveryValidationError("Эта корзина превышает оставшуюся грузоподъёмность выбранной волны.")

    current_fill_percent = calculate_fill_percent(current_weight_g, wave.max_weight_kg)
    projected_fill_percent = calculate_fill_percent(projected_weight_g, wave.max_weight_kg)
    raw_fill_percent = Decimal(projected_weight_g) * 100 / max_weight_g
    applied_rate_rub_per_kg, discount_percent = calculate_rate(raw_fill_percent)
    shipping_cost_rub = (as_kg(order_weight_g) * applied_rate_rub_per_kg).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    remaining_weight_g = max_weight_g - projected_weight_g
    products_total_rub = sum(
        (products[product_id].price_rub * quantity for product_id, quantity in aggregated_quantities.items()),
        Decimal("0.00"),
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    seasonal_policy = seasonal_shipping_policy(
        dispatch_date=wave.dispatch_date,
        has_temp_sensitive_products=any(product.temp_sensitive for product in products.values()),
        thermal_packaging_requested=thermal_packaging_requested,
    )
    total_rub = products_total_rub + shipping_cost_rub + seasonal_policy.thermal_packaging_cost_rub

    if discount_percent == 0:
        explanation = "Прогнозируемая загрузка не превышает 50 %, поэтому действует базовый тариф 500 ₽/кг."
    else:
        explanation = (
            f"Прогнозируемая загрузка составит {projected_fill_percent} %, "
            f"поэтому тариф снижен на {discount_percent} % до {applied_rate_rub_per_kg} ₽/кг."
        )

    return DeliveryEstimate(
        wave=wave,
        direction=expected_direction,
        order_weight_g=order_weight_g,
        current_weight_g=current_weight_g,
        projected_weight_g=projected_weight_g,
        current_fill_percent=current_fill_percent,
        projected_fill_percent=projected_fill_percent,
        remaining_weight_g=remaining_weight_g,
        base_rate_rub_per_kg=BASE_RATE_RUB_PER_KG,
        applied_rate_rub_per_kg=applied_rate_rub_per_kg,
        discount_percent=discount_percent,
        shipping_cost_rub=shipping_cost_rub,
        products_total_rub=products_total_rub,
        total_rub=total_rub,
        explanation=explanation,
        seasonal_policy=seasonal_policy,
        products=products,
        quantities=aggregated_quantities,
    )
