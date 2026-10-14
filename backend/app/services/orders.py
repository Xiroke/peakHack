from dataclasses import replace
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.orm import Session, joinedload, selectinload

from app.models import Order, OrderItem, OrderStatus, Region
from app.services.delivery import CartLine, estimate_delivery
from app.services.seasonal import SeasonalShippingPolicy, seasonal_shipping_policy


class IdempotencyConflictError(ValueError):
    pass


def seasonal_policy_for_order(order: Order) -> SeasonalShippingPolicy:
    policy = seasonal_shipping_policy(
        dispatch_date=order.wave.dispatch_date,
        has_temp_sensitive_products=order.has_temp_sensitive_products,
        thermal_packaging_requested=order.thermal_packaging_applied,
    )
    notice = policy.notice
    if policy.thermal_packaging_required and not order.thermal_packaging_applied:
        notice = "Термоупаковка не была включена в ранее оформленный заказ. Для перевозки чувствительных товаров требуется защита от перепада температур."
    return replace(
        policy,
        thermal_packaging_applied=order.thermal_packaging_applied,
        thermal_packaging_cost_rub=order.thermal_packaging_cost_rub,
        notice=notice,
    )


def request_matches_order(
    order: Order,
    *,
    wave_id: int,
    recipient_region: Region,
    recipient_name: str,
    recipient_phone: str,
    recipient_address: str,
    is_gift: bool,
    card_message: str | None,
    thermal_packaging_requested: bool,
    lines: list[CartLine],
) -> bool:
    quantities: dict[int, int] = {}
    for line in lines:
        quantities[line.product_id] = quantities.get(line.product_id, 0) + line.quantity
    requested_policy = seasonal_shipping_policy(
        dispatch_date=order.wave.dispatch_date,
        has_temp_sensitive_products=order.has_temp_sensitive_products,
        thermal_packaging_requested=thermal_packaging_requested,
    )
    return (
        order.wave_id == wave_id
        and order.recipient_region == recipient_region
        and order.recipient_name == recipient_name
        and order.recipient_phone == recipient_phone
        and order.recipient_address == recipient_address
        and order.is_gift == is_gift
        and order.card_message == card_message
        and order.thermal_packaging_applied == requested_policy.thermal_packaging_applied
        and {item.product_id: item.quantity for item in order.items} == quantities
    )


def order_with_details(
    database: Session, *, public_id: str | None = None, idempotency_key: str | None = None, order_id: int | None = None
) -> Order | None:
    statement = select(Order).options(joinedload(Order.wave), selectinload(Order.items).joinedload(OrderItem.product))
    if order_id is not None:
        statement = statement.where(Order.id == order_id)
    if public_id is not None:
        statement = statement.where(Order.public_id == public_id)
    if idempotency_key is not None:
        statement = statement.where(Order.idempotency_key == idempotency_key)
    return database.scalar(statement)


def create_order(
    database: Session,
    *,
    idempotency_key: str,
    wave_id: int,
    recipient_region: Region,
    recipient_name: str,
    recipient_phone: str,
    recipient_address: str,
    is_gift: bool,
    card_message: str | None,
    thermal_packaging_requested: bool,
    lines: list[CartLine],
) -> Order:
    try:
        database.execute(text("BEGIN IMMEDIATE"))
        existing_order = order_with_details(database, idempotency_key=idempotency_key)
        if existing_order is not None:
            if not request_matches_order(
                existing_order,
                wave_id=wave_id,
                recipient_region=recipient_region,
                recipient_name=recipient_name,
                recipient_phone=recipient_phone,
                recipient_address=recipient_address,
                is_gift=is_gift,
                card_message=card_message,
                thermal_packaging_requested=thermal_packaging_requested,
                lines=lines,
            ):
                raise IdempotencyConflictError("Этот ключ уже использован для другого заказа.")
            database.rollback()
            return order_with_details(database, idempotency_key=idempotency_key) or existing_order

        estimate = estimate_delivery(
            database,
            wave_id=wave_id,
            recipient_region=recipient_region,
            lines=lines,
            thermal_packaging_requested=thermal_packaging_requested,
        )

        order = Order(
            public_id=str(uuid4()),
            idempotency_key=idempotency_key,
            wave_id=estimate.wave.id,
            recipient_region=recipient_region,
            recipient_name=recipient_name,
            recipient_phone=recipient_phone,
            recipient_address=recipient_address,
            card_message=card_message if is_gift else None,
            is_gift=is_gift,
            status=OrderStatus.ACCEPTED,
            products_total_rub=estimate.products_total_rub,
            shipping_cost_rub=estimate.shipping_cost_rub,
            has_temp_sensitive_products=estimate.seasonal_policy.has_temp_sensitive_products,
            thermal_packaging_applied=estimate.seasonal_policy.thermal_packaging_applied,
            thermal_packaging_cost_rub=estimate.seasonal_policy.thermal_packaging_cost_rub,
            total_rub=estimate.total_rub,
        )
        database.add(order)
        database.flush()
        database.add_all(
            OrderItem(
                order_id=order.id,
                product_id=product_id,
                quantity=quantity,
                unit_price_rub=estimate.products[product_id].price_rub,
                weight_g=estimate.products[product_id].weight_g,
            )
            for product_id, quantity in estimate.quantities.items()
        )
        database.commit()
    except Exception:
        database.rollback()
        raise

    return order_with_details(database, public_id=order.public_id) or order
