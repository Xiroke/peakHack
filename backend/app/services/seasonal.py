from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

BASE_DELIVERY_MIN_DAYS = 10
BASE_DELIVERY_MAX_DAYS = 14
THERMAL_PACKAGING_COST_RUB = Decimal("150.00")


@dataclass(frozen=True)
class SeasonalShippingPolicy:
    has_temp_sensitive_products: bool
    thermal_packaging_available: bool
    thermal_packaging_required: bool
    thermal_packaging_applied: bool
    thermal_packaging_cost_rub: Decimal
    notice: str | None
    delivery_min_days: int
    delivery_max_days: int
    expected_delivery_from: date
    expected_delivery_to: date


def seasonal_shipping_policy(
    *,
    dispatch_date: date,
    has_temp_sensitive_products: bool,
    thermal_packaging_requested: bool,
) -> SeasonalShippingPolicy:
    month = dispatch_date.month
    thermal_packaging_required = has_temp_sensitive_products and month in {12, 1, 2, 6, 7, 8}
    thermal_packaging_available = has_temp_sensitive_products
    thermal_packaging_applied = thermal_packaging_required or (
        thermal_packaging_available and thermal_packaging_requested
    )
    delivery_delay_days = 7 if month in {5, 11} else 0
    delivery_min_days = BASE_DELIVERY_MIN_DAYS + delivery_delay_days
    delivery_max_days = BASE_DELIVERY_MAX_DAYS + delivery_delay_days

    notices: list[str] = []
    if thermal_packaging_required:
        reason = "защиты от мороза" if month in {12, 1, 2} else "защиты от перегрева"
        notices.append(f"В заказе есть товары, чувствительные к температуре. Термоупаковка включена для {reason}: +150 ₽ за заказ.")
    elif has_temp_sensitive_products:
        if thermal_packaging_applied:
            notices.append("Для товаров, чувствительных к температуре, добавлена термоупаковка: +150 ₽ за заказ.")
        else:
            notices.append("В заказе есть товары, чувствительные к температуре. При необходимости добавьте термоупаковку: +150 ₽ за заказ.")
    if delivery_delay_days:
        notices.append("В мае и ноябре доставка занимает на 7 дней больше обычного.")

    return SeasonalShippingPolicy(
        has_temp_sensitive_products=has_temp_sensitive_products,
        thermal_packaging_available=thermal_packaging_available,
        thermal_packaging_required=thermal_packaging_required,
        thermal_packaging_applied=thermal_packaging_applied,
        thermal_packaging_cost_rub=THERMAL_PACKAGING_COST_RUB if thermal_packaging_applied else Decimal("0.00"),
        notice=" ".join(notices) if notices else None,
        delivery_min_days=delivery_min_days,
        delivery_max_days=delivery_max_days,
        expected_delivery_from=dispatch_date + timedelta(days=delivery_min_days),
        expected_delivery_to=dispatch_date + timedelta(days=delivery_max_days),
    )
