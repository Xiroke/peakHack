import { type FormEvent, useEffect, useState } from 'react'

import './CheckoutPage.css'
import './TrackingPage.css'
import { PageContainer } from '../components/PageContainer'
import { ApiRequestError, getOrderTracking, type TrackingOrder } from '../lib/api'
import { orderStatusLabels } from '../lib/orderStatus'
import { AppLink } from '../lib/router'
import { useRouter } from '../lib/useRouter'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const stageStateLabels = {
  completed: 'Завершён',
  current: 'Текущий этап',
  upcoming: 'Ожидается',
}

type TrackingState =
  | { status: 'loading' }
  | { status: 'ready'; order: TrackingOrder }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function formatPrice(value: string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))} ₽`
}

export function TrackingSearchPage() {
  const { navigate } = useRouter()
  const [publicId, setPublicId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedId = publicId.trim()
    if (!normalizedId) {
      setError('Введите номер заказа.')
    } else if (!uuidPattern.test(normalizedId)) {
      setError('Номер заказа должен быть в формате UUID, например 12345678-1234-1234-1234-123456789abc.')
    } else {
      setError(null)
      navigate(`/tracking/${normalizedId.toLowerCase()}`)
    }
  }

  return (
    <PageContainer>
      <section className="tracking-search" aria-labelledby="tracking-search-title">
        <p className="eyebrow">Статус доставки</p>
        <h1 id="tracking-search-title">Отследить заказ</h1>
        <p>Введите номер из подтверждения заказа, чтобы узнать текущий этап отправки.</p>
        <form noValidate onSubmit={handleSubmit}>
          <label className="checkout-field" htmlFor="tracking-public-id">
            <span>Публичный номер заказа</span>
            <input
              aria-describedby={error ? 'tracking-public-id-hint tracking-public-id-error' : 'tracking-public-id-hint'}
              aria-invalid={Boolean(error)}
              autoComplete="off"
              id="tracking-public-id"
              onChange={(event) => {
                setPublicId(event.target.value)
                setError(null)
              }}
              placeholder="12345678-1234-1234-1234-123456789abc"
              type="text"
              value={publicId}
            />
            <small id="tracking-public-id-hint">Номер содержит пять групп букв и цифр через дефис.</small>
            {error && <small id="tracking-public-id-error" role="alert">{error}</small>}
          </label>
          <button className="primary-button" type="submit">Проверить статус</button>
        </form>
      </section>
    </PageContainer>
  )
}

export function TrackingResultPage({ publicOrderId }: { publicOrderId: string }) {
  const [trackingState, setTrackingState] = useState<TrackingState>({ status: 'loading' })
  const [retry, setRetry] = useState(0)
  const isValidId = uuidPattern.test(publicOrderId)

  useEffect(() => {
    if (!isValidId) return undefined

    let isCurrent = true
    getOrderTracking(publicOrderId)
      .then((order) => {
        if (isCurrent) setTrackingState({ status: 'ready', order })
      })
      .catch((requestError: Error) => {
        if (!isCurrent) return
        if (requestError instanceof ApiRequestError && requestError.status === 404) {
          setTrackingState({ status: 'not-found' })
        } else {
          setTrackingState({ status: 'error', message: requestError.message })
        }
      })

    return () => {
      isCurrent = false
    }
  }, [isValidId, publicOrderId, retry])

  if (!isValidId || trackingState.status === 'not-found' || trackingState.status === 'error') {
    const title = !isValidId ? 'Неверный номер заказа' : trackingState.status === 'not-found' ? 'Заказ не найден' : 'Не удалось загрузить статус'
    const message = !isValidId
      ? 'Проверьте формат номера заказа и попробуйте ещё раз.'
      : trackingState.status === 'not-found'
        ? 'Проверьте номер из подтверждения заказа и попробуйте ещё раз.'
        : trackingState.status === 'error' ? trackingState.message : ''
    return (
      <PageContainer>
        <section className="tracking-state" aria-labelledby="tracking-state-title">
          <p className="eyebrow">Статус доставки</p>
          <h1 id="tracking-state-title">{title}</h1>
          <p role="alert">{message}</p>
          {isValidId && trackingState.status === 'error' && (
            <button
              className="primary-button"
              onClick={() => {
                setTrackingState({ status: 'loading' })
                setRetry((value) => value + 1)
              }}
              type="button"
            >
              Повторить попытку
            </button>
          )}
          <AppLink className="text-link" to="/tracking">Вернуться к поиску</AppLink>
        </section>
      </PageContainer>
    )
  }

  if (trackingState.status === 'loading') {
    return (
      <PageContainer>
        <section className="tracking-state" aria-live="polite">
          <p>Загружаем статус заказа…</p>
        </section>
      </PageContainer>
    )
  }

  const { order } = trackingState
  return (
    <PageContainer>
      <section className="tracking-result" aria-labelledby="tracking-result-title">
        <p className="eyebrow">Заказ № {order.public_id}</p>
        <h1 id="tracking-result-title">Статус: {orderStatusLabels[order.status]}</h1>
        <p>Отправка {formatDate(order.dispatch_date)} · Ожидаемая доставка с {formatDate(order.expected_delivery_from)} по {formatDate(order.expected_delivery_to)}</p>

        <section className="tracking-section" aria-labelledby="tracking-stages-title">
          <h2 id="tracking-stages-title">Этапы доставки</h2>
          <ol className="tracking-stages">
            {order.stages.map((stage) => (
              <li aria-current={stage.state === 'current' ? 'step' : undefined} key={stage.status}>
                <strong>{orderStatusLabels[stage.status]}</strong>
                <span>{stageStateLabels[stage.state]}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="tracking-section" aria-labelledby="tracking-details-title">
          <h2 id="tracking-details-title">Детали заказа</h2>
          <dl className="tracking-details">
            <div>
              <dt>Дата отправки</dt>
              <dd>{formatDate(order.dispatch_date)}</dd>
            </div>
            <div>
              <dt>Ожидаемая доставка</dt>
              <dd>{formatDate(order.expected_delivery_from)} — {formatDate(order.expected_delivery_to)}</dd>
            </div>
            <div>
              <dt>Подарок</dt>
              <dd>{order.is_gift ? 'Да' : 'Нет'}</dd>
            </div>
            <div>
              <dt>Термоупаковка</dt>
              <dd>{order.thermal_packaging.applied ? `Включена · ${formatPrice(order.thermal_packaging.cost_rub)}` : 'Не добавлена'}</dd>
            </div>
            <div>
              <dt>Сумма заказа</dt>
              <dd>{formatPrice(order.total_rub)}</dd>
            </div>
          </dl>
          {order.thermal_packaging.notice && <p className="tracking-notice">{order.thermal_packaging.notice}</p>}
          <h3>Состав заказа</h3>
          <ul className="checkout-items">
            {order.items.map((item, index) => (
              <li key={index}>
                <span>{item.name} × {item.quantity}</span>
                <strong>{formatPrice(String(Number(item.unit_price_rub) * item.quantity))}</strong>
              </li>
            ))}
          </ul>
        </section>
        <AppLink className="text-link" to="/tracking">Проверить другой заказ</AppLink>
      </section>
    </PageContainer>
  )
}
