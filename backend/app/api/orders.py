from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Order, OrderStatus
from app.schemas import (
    OrderCreateRequest,
    OrderItemResponse,
    OrderResponse,
    OrderTrackingResponse,
    OrderWaveResponse,
    ThermalPackagingResponse,
    TrackingItemResponse,
    TrackingStageResponse,
)
from app.services.delivery import CartLine, DeliveryValidationError
from app.services.orders import IdempotencyConflictError, create_order, order_with_details, seasonal_policy_for_order
from app.services.seasonal import SeasonalShippingPolicy

router = APIRouter(prefix="/orders", tags=["Заказы"])


def serialize_thermal_packaging(policy: SeasonalShippingPolicy) -> ThermalPackagingResponse:
    return ThermalPackagingResponse(
        has_temp_sensitive_products=policy.has_temp_sensitive_products,
        available=policy.thermal_packaging_available,
        required=policy.thermal_packaging_required,
        applied=policy.thermal_packaging_applied,
        cost_rub=policy.thermal_packaging_cost_rub,
        notice=policy.notice,
    )


def serialize_order(order: Order) -> OrderResponse:
    policy = seasonal_policy_for_order(order)
    return OrderResponse(
        public_id=order.public_id,
        status=order.status,
        is_gift=order.is_gift,
        wave=OrderWaveResponse(
            id=order.wave.id,
            direction=order.wave.direction,
            dispatch_date=order.wave.dispatch_date,
            order_deadline=order.wave.order_deadline,
        ),
        items=[
            OrderItemResponse(
                product_id=item.product_id,
                name=item.product.name,
                manufacturer=item.product.manufacturer,
                quantity=item.quantity,
                unit_price_rub=item.unit_price_rub,
                weight_g=item.weight_g,
            )
            for item in order.items
        ],
        delivery_min_days=policy.delivery_min_days,
        delivery_max_days=policy.delivery_max_days,
        expected_delivery_from=policy.expected_delivery_from,
        expected_delivery_to=policy.expected_delivery_to,
        thermal_packaging=serialize_thermal_packaging(policy),
        products_total_rub=order.products_total_rub,
        shipping_cost_rub=order.shipping_cost_rub,
        thermal_packaging_cost_rub=order.thermal_packaging_cost_rub,
        total_rub=order.total_rub,
        created_at=order.created_at,
    )


@router.post("", response_model=OrderResponse, summary="Создать заказ")
def create_new_order(
    payload: OrderCreateRequest,
    idempotency_key: UUID = Header(alias="Idempotency-Key"),
    database: Session = Depends(get_db),
) -> OrderResponse:
    try:
        order = create_order(
            database,
            idempotency_key=str(idempotency_key),
            wave_id=payload.wave_id,
            recipient_region=payload.recipient_region,
            recipient_name=payload.recipient_name,
            recipient_phone=payload.recipient_phone,
            recipient_address=payload.recipient_address,
            is_gift=payload.is_gift,
            card_message=payload.card_message,
            thermal_packaging_requested=payload.thermal_packaging_requested,
            lines=[CartLine(product_id=item.product_id, quantity=item.quantity) for item in payload.items],
        )
    except IdempotencyConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except DeliveryValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return serialize_order(order)


@router.get("/{public_order_id}", response_model=OrderResponse, summary="Подтверждение заказа")
def get_order(public_order_id: UUID, database: Session = Depends(get_db)) -> OrderResponse:
    order = order_with_details(database, public_id=str(public_order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Заказ не найден.")
    return serialize_order(order)


@router.get("/{public_order_id}/tracking", response_model=OrderTrackingResponse, summary="Отследить заказ")
def get_order_tracking(public_order_id: UUID, database: Session = Depends(get_db)) -> OrderTrackingResponse:
    order = order_with_details(database, public_id=str(public_order_id))
    if order is None:
        raise HTTPException(status_code=404, detail="Заказ не найден.")

    details = serialize_order(order)
    statuses = list(OrderStatus)
    current_index = statuses.index(order.status)
    return OrderTrackingResponse(
        public_id=details.public_id,
        status=details.status,
        stages=[
            TrackingStageResponse(
                status=status,
                state="completed" if index < current_index else "current" if index == current_index else "upcoming",
            )
            for index, status in enumerate(statuses)
        ],
        is_gift=details.is_gift,
        dispatch_date=details.wave.dispatch_date,
        items=[
            TrackingItemResponse(name=item.name, quantity=item.quantity, unit_price_rub=item.unit_price_rub)
            for item in details.items
        ],
        delivery_min_days=details.delivery_min_days,
        delivery_max_days=details.delivery_max_days,
        expected_delivery_from=details.expected_delivery_from,
        expected_delivery_to=details.expected_delivery_to,
        thermal_packaging=details.thermal_packaging,
        total_rub=details.total_rub,
    )
