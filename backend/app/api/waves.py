from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Wave, WaveDirection, WaveStatus
from app.schemas import DeliveryEstimateRequest, DeliveryEstimateResponse, ThermalPackagingResponse, WaveResponse
from app.services.delivery import (
    CartLine,
    DeliveryValidationError,
    as_kg,
    calculate_fill_percent,
    estimate_delivery,
    get_wave_weight_g,
)

router = APIRouter(tags=["Волны доставки"])


def wave_response(database: Session, wave: Wave) -> WaveResponse:
    current_weight_g = get_wave_weight_g(database, wave.id)
    max_weight_g = wave.max_weight_kg * 1000
    return WaveResponse(
        id=wave.id,
        direction=wave.direction,
        dispatch_date=wave.dispatch_date,
        order_deadline=wave.order_deadline,
        min_weight_kg=wave.min_weight_kg,
        max_weight_kg=wave.max_weight_kg,
        status=wave.status,
        current_weight_kg=as_kg(current_weight_g),
        current_fill_percent=calculate_fill_percent(current_weight_g, wave.max_weight_kg),
        remaining_weight_kg=as_kg(max(0, max_weight_g - current_weight_g)),
    )


@router.get("/waves", response_model=list[WaveResponse], summary="Доступные волны доставки")
def list_waves(
    direction: WaveDirection | None = None,
    status: WaveStatus | None = None,
    database: Session = Depends(get_db),
) -> list[WaveResponse]:
    statement = select(Wave)
    if direction is not None:
        statement = statement.where(Wave.direction == direction)

    if status is None:
        today = date.today()
        statement = statement.where(
            Wave.status == WaveStatus.OPEN,
            Wave.order_deadline >= today,
            Wave.dispatch_date > today,
        )
    else:
        statement = statement.where(Wave.status == status)

    waves = list(database.scalars(statement.order_by(Wave.dispatch_date.asc(), Wave.id.asc())))
    return [wave_response(database, wave) for wave in waves]


@router.get("/waves/{wave_id}", response_model=WaveResponse, summary="Детали волны доставки")
def get_wave(wave_id: int, database: Session = Depends(get_db)) -> WaveResponse:
    wave = database.get(Wave, wave_id)
    if wave is None:
        raise HTTPException(status_code=404, detail="Волна не найдена.")
    return wave_response(database, wave)


@router.post("/delivery-estimate", response_model=DeliveryEstimateResponse, summary="Предварительный расчёт доставки")
def create_delivery_estimate(
    payload: DeliveryEstimateRequest,
    database: Session = Depends(get_db),
) -> DeliveryEstimateResponse:
    try:
        estimate = estimate_delivery(
            database,
            wave_id=payload.wave_id,
            recipient_region=payload.recipient_region,
            lines=[CartLine(product_id=item.product_id, quantity=item.quantity) for item in payload.items],
            thermal_packaging_requested=payload.thermal_packaging_requested,
        )
    except DeliveryValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    return DeliveryEstimateResponse(
        wave_id=estimate.wave.id,
        direction=estimate.direction,
        dispatch_date=estimate.wave.dispatch_date,
        order_deadline=estimate.wave.order_deadline,
        delivery_min_days=estimate.seasonal_policy.delivery_min_days,
        delivery_max_days=estimate.seasonal_policy.delivery_max_days,
        expected_delivery_from=estimate.seasonal_policy.expected_delivery_from,
        expected_delivery_to=estimate.seasonal_policy.expected_delivery_to,
        thermal_packaging=ThermalPackagingResponse(
            has_temp_sensitive_products=estimate.seasonal_policy.has_temp_sensitive_products,
            available=estimate.seasonal_policy.thermal_packaging_available,
            required=estimate.seasonal_policy.thermal_packaging_required,
            applied=estimate.seasonal_policy.thermal_packaging_applied,
            cost_rub=estimate.seasonal_policy.thermal_packaging_cost_rub,
            notice=estimate.seasonal_policy.notice,
        ),
        order_weight_kg=as_kg(estimate.order_weight_g),
        current_weight_kg=as_kg(estimate.current_weight_g),
        projected_weight_kg=as_kg(estimate.projected_weight_g),
        current_fill_percent=estimate.current_fill_percent,
        projected_fill_percent=estimate.projected_fill_percent,
        remaining_weight_kg=as_kg(estimate.remaining_weight_g),
        base_rate_rub_per_kg=estimate.base_rate_rub_per_kg,
        applied_rate_rub_per_kg=estimate.applied_rate_rub_per_kg,
        discount_percent=estimate.discount_percent,
        shipping_cost_rub=estimate.shipping_cost_rub,
        products_total_rub=estimate.products_total_rub,
        total_rub=estimate.total_rub,
        explanation=estimate.explanation,
    )
