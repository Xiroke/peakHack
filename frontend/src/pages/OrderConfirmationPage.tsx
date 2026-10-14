import { useEffect, useState } from 'react'

import './CheckoutPage.css'
import { PageContainer } from '../components/PageContainer'
import { getOrder, type Order } from '../lib/api'
import { orderStatusLabels } from '../lib/orderStatus'
import { AppLink } from '../lib/router'

type OrderConfirmationPageProps = {
  publicOrderId: string
}

type OrderState =
  | { status: 'loading' }
  | { status: 'ready'; order: Order }
  | { status: 'error'; message: string }

function formatPrice(value: string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))} ₽`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

export function OrderConfirmationPage({ publicOrderId }: OrderConfirmationPageProps) {
  const [orderState, setOrderState] = useState<OrderState>({ status: 'loading' })

  useEffect(() => {
    let isCurrent = true
    getOrder(publicOrderId)
      .then((order) => {
        if (isCurrent) setOrderState({ status: 'ready', order })
      })
      .catch((requestError: Error) => {
        if (isCurrent) setOrderState({ status: 'error', message: requestError.message })
      })

    return () => {
      isCurrent = false
    }
  }, [publicOrderId])

  if (orderState.status === 'loading') {
    return (
      <PageContainer>
        <section className="checkout-state" aria-live="polite">
          <p>Загружаем подтверждение заказа…</p>
        </section>
      </PageContainer>
    )
  }

  if (orderState.status === 'error') {
    return (
      <PageContainer>
        <section className="checkout-state" aria-labelledby="order-error-title">
          <p className="eyebrow">Заказ не найден</p>
          <h1 id="order-error-title">Не удалось открыть подтверждение</h1>
          <p>{orderState.message}</p>
          <AppLink className="text-link" to="/catalog?region=yakutia">
            Вернуться в каталог
          </AppLink>
        </section>
      </PageContainer>
    )
  }

  const { order } = orderState
  return (
    <PageContainer>
      <section className="order-confirmation" aria-labelledby="confirmation-title">
        <p className="eyebrow">Заказ принят</p>
        <h1 id="confirmation-title">Спасибо, всё готово</h1>
        <p>
          Заказ <strong>№ {order.public_id}</strong> добавлен в волну с отправкой {formatDate(order.wave.dispatch_date)}
        </p>
        <dl>
          <div>
            <dt>Статус</dt>
            <dd>{orderStatusLabels[order.status]}</dd>
          </div>
          <div>
            <dt>Ожидаемая доставка</dt>
            <dd>{formatDate(order.expected_delivery_from)} — {formatDate(order.expected_delivery_to)}</dd>
          </div>
          <div>
            <dt>Товары</dt>
            <dd>{formatPrice(order.products_total_rub)}</dd>
          </div>
          <div>
            <dt>Доставка</dt>
            <dd>{formatPrice(order.shipping_cost_rub)}</dd>
          </div>
          <div>
            <dt>Термоупаковка</dt>
            <dd>{order.thermal_packaging.applied ? formatPrice(order.thermal_packaging_cost_rub) : 'Не добавлена'}</dd>
          </div>
          <div>
            <dt>Сумма заказа</dt>
            <dd>{formatPrice(order.total_rub)}</dd>
          </div>
          <div>
            <dt>Подарочный сценарий</dt>
            <dd>{order.is_gift ? 'Да' : 'Нет'}</dd>
          </div>
        </dl>
        {order.thermal_packaging.notice && <p className="checkout-section-note">{order.thermal_packaging.notice}</p>}
        <p className="checkout-section-note">Сохраните номер заказа, чтобы проверить его статус позже.</p>
        <ul className="checkout-items">
          {order.items.map((item) => (
            <li key={item.product_id}>
              <span>{item.name} × {item.quantity}</span>
              <strong>{formatPrice(String(Number(item.unit_price_rub) * item.quantity))}</strong>
            </li>
          ))}
        </ul>
        <div className="confirmation-links">
          <AppLink className="text-link" to={`/tracking/${order.public_id}`}>
            К отслеживанию заказа
          </AppLink>
          <AppLink className="text-link" to="/catalog?region=yakutia">
            Продолжить покупки
          </AppLink>
        </div>
      </section>
    </PageContainer>
  )
}
