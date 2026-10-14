import { useEffect, useMemo, useState } from 'react'

import './CartPage.css'
import { PageContainer } from '../components/PageContainer'
import {
  getDeliveryEstimate,
  getWaves,
  type DeliveryEstimate,
  type Region,
  type Wave,
  type WaveDirection,
} from '../lib/api'
import { AppLink } from '../lib/router'
import { useCart } from '../lib/useCart'

type WavesState = {
  requestKey: string
  waves: Wave[]
  error: string | null
}

type EstimateState = {
  requestKey: string
  estimate: DeliveryEstimate | null
  error: string | null
}

function formatPrice(value: number | string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))} ₽`
}

function formatWeight(value: number | string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(Number(value))} кг`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function directionFor(region: Region): WaveDirection {
  return region === 'yakutia' ? 'yakutia_to_dnr' : 'dnr_to_yakutia'
}

function recipientFor(region: Region): Region {
  return region === 'yakutia' ? 'dnr' : 'yakutia'
}

function routeLabel(direction: WaveDirection) {
  return direction === 'yakutia_to_dnr' ? 'Якутия → Донбасс' : 'Донбасс → Якутия'
}

export function CartPage() {
  const { items, removeProduct, updateQuantity, clearCart, isHydrated, hydrationError, retryHydration } = useCart()
  const originRegion = items[0]?.product.region
  const direction = originRegion ? directionFor(originRegion) : null
  const recipientRegion = originRegion ? recipientFor(originRegion) : null
  const cartKey = items.map((item) => `${item.product.id}:${item.quantity}`).join('|')
  const [wavesRetryVersion, setWavesRetryVersion] = useState(0)
  const wavesRequestKey = direction ? `${direction}|${wavesRetryVersion}` : ''
  const [wavesState, setWavesState] = useState<WavesState>({ requestKey: '', waves: [], error: null })
  const [selectedWaveId, setSelectedWaveId] = useState<number | null>(null)
  const [thermalPackagingRequested, setThermalPackagingRequested] = useState(false)
  const [estimateState, setEstimateState] = useState<EstimateState>({ requestKey: '', estimate: null, error: null })
  const [estimateRetryVersion, setEstimateRetryVersion] = useState(0)
  const isWavesLoading = Boolean(direction && wavesState.requestKey !== wavesRequestKey)
  const waves = isWavesLoading ? [] : wavesState.waves
  const wavesError = isWavesLoading ? null : wavesState.error
  const selectedWave = waves.find((wave) => wave.id === selectedWaveId) ?? null
  const estimateRequestKey = selectedWave
    ? `${selectedWave.id}|${recipientRegion}|${cartKey}|${thermalPackagingRequested}|${estimateRetryVersion}`
    : ''
  const isEstimateLoading = Boolean(estimateRequestKey && estimateState.requestKey !== estimateRequestKey)
  const estimate = isEstimateLoading || !estimateRequestKey ? null : estimateState.estimate
  const estimateError = isEstimateLoading || !estimateRequestKey ? null : estimateState.error

  const productsTotal = useMemo(
    () => items.reduce((total, item) => total + Number(item.product.price_rub) * item.quantity, 0),
    [items],
  )
  const totalWeightG = useMemo(
    () => items.reduce((total, item) => total + item.product.weight_g * item.quantity, 0),
    [items],
  )

  useEffect(() => {
    if (!direction) return undefined

    let isCurrent = true
    getWaves(direction)
      .then((nextWaves) => {
        if (isCurrent) setWavesState({ requestKey: wavesRequestKey, waves: nextWaves, error: null })
      })
      .catch((requestError: Error) => {
        if (isCurrent) setWavesState({ requestKey: wavesRequestKey, waves: [], error: requestError.message })
      })

    return () => {
      isCurrent = false
    }
  }, [direction, wavesRequestKey, wavesRetryVersion])

  useEffect(() => {
    if (!selectedWave || !recipientRegion) return undefined

    let isCurrent = true
    getDeliveryEstimate({
      wave_id: selectedWave.id,
      recipient_region: recipientRegion,
      items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      thermal_packaging_requested: thermalPackagingRequested,
    })
      .then((nextEstimate) => {
        if (isCurrent) setEstimateState({ requestKey: estimateRequestKey, estimate: nextEstimate, error: null })
      })
      .catch((requestError: Error) => {
        if (isCurrent) setEstimateState({ requestKey: estimateRequestKey, estimate: null, error: requestError.message })
      })

    return () => {
      isCurrent = false
    }
  }, [estimateRequestKey, items, recipientRegion, selectedWave, thermalPackagingRequested])

  const changeQuantity = (productId: number, quantity: number) => {
    setSelectedWaveId(null)
    updateQuantity(productId, quantity)
  }

  const removeItem = (productId: number) => {
    setSelectedWaveId(null)
    removeProduct(productId)
  }

  const emptyCart = () => {
    if (window.confirm('Удалить все товары из корзины?')) {
      setSelectedWaveId(null)
      clearCart()
    }
  }

  if (!isHydrated) {
    return (
      <PageContainer>
        <section className="cart-empty" aria-live="polite">
          {hydrationError ? (
            <div role="alert">
              <p>{hydrationError}</p>
              <button className="primary-button" onClick={retryHydration} type="button">Повторить</button>
            </div>
          ) : <p>Восстанавливаем корзину…</p>}
        </section>
      </PageContainer>
    )
  }

  if (items.length === 0) {
    return (
      <PageContainer>
        <section className="cart-empty" aria-labelledby="empty-cart-title">
          <p className="eyebrow">Ваш заказ</p>
          <h1 id="empty-cart-title">В корзине пока нет товаров</h1>
          <p>Выберите сладости из одной региональной витрины, чтобы присоединиться к ближайшей отправке.</p>
          <AppLink className="text-link" to="/catalog?region=yakutia">
            Открыть каталог
          </AppLink>
        </section>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <section className="cart-heading" aria-labelledby="cart-title">
        <p className="eyebrow">Предварительный расчёт</p>
        <h1 id="cart-title">Корзина и волна доставки</h1>
        <p>
          Товары отправятся по направлению <strong>{direction && routeLabel(direction)}</strong>. Получатель находится в{' '}
          <strong>{recipientRegion === 'yakutia' ? 'Якутии' : 'Донбассе'}</strong>.
        </p>
      </section>

      <div className="cart-layout">
        <section className="cart-items" aria-labelledby="cart-items-title">
          <div className="cart-section-heading">
            <h2 id="cart-items-title">Состав заказа</h2>
            <span>{formatWeight(totalWeightG / 1000)}</span>
          </div>
          <button className="clear-cart" onClick={emptyCart} type="button">Очистить корзину</button>
          <ul>
            {items.map((item) => (
              <li className="cart-item" key={item.product.id}>
                <div>
                  <p>{item.product.manufacturer}</p>
                  <h3>{item.product.name}</h3>
                  <span>
                    {item.product.weight_g} г · {formatPrice(item.product.price_rub)}
                  </span>
                </div>
                <div className="quantity-control" aria-label={`Количество: ${item.product.name}`}>
                  <button
                    aria-label={`Уменьшить количество товара «${item.product.name}»`}
                    onClick={() => changeQuantity(item.product.id, item.quantity - 1)}
                    type="button"
                  >
                    −
                  </button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button
                    aria-label={`Увеличить количество товара «${item.product.name}»`}
                    disabled={item.quantity >= 1000}
                    onClick={() => changeQuantity(item.product.id, item.quantity + 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <button
                  className="remove-item"
                  onClick={() => removeItem(item.product.id)}
                  type="button"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
          <div className="cart-total">
            <span>Товары</span>
            <strong>{formatPrice(estimate?.products_total_rub ?? productsTotal)}</strong>
          </div>
        </section>

        <section className="wave-selection" aria-labelledby="wave-title">
          <div className="cart-section-heading">
            <h2 id="wave-title">Выберите волну</h2>
            <span>{direction && routeLabel(direction)}</span>
          </div>
          <p className="wave-selection__intro">
            Стоимость доставки зависит от веса заказа и заполненности выбранной отправки.
          </p>

          {isWavesLoading && <p className="loading-copy" aria-live="polite">Ищем доступные волны…</p>}
          {wavesError && (
            <div className="wave-error" role="alert">
              <p>{wavesError}</p>
              <button onClick={() => setWavesRetryVersion((current) => current + 1)} type="button">
                Повторить попытку
              </button>
            </div>
          )}
          {!isWavesLoading && !wavesError && waves.length === 0 && (
            <p className="empty-copy">Сейчас нет доступных волн в этом направлении.</p>
          )}

          <div className="wave-list" role="radiogroup" aria-label="Доступные волны">
            {waves.map((wave) => {
              const fillPercent = Math.min(100, Number(wave.current_fill_percent))
              return (
                <label className={`wave-option${selectedWaveId === wave.id ? ' is-selected' : ''}`} key={wave.id}>
                  <input
                    checked={selectedWaveId === wave.id}
                    name="wave"
                    onChange={() => setSelectedWaveId(wave.id)}
                    type="radio"
                    value={wave.id}
                  />
                  <span className="wave-option__content">
                    <span className="wave-option__date">Отправка {formatDate(wave.dispatch_date)}</span>
                    <span className="wave-option__deadline">Заказы до {formatDate(wave.order_deadline)}</span>
                    <span className="wave-fill-label">
                      Заполнение: {formatWeight(wave.current_weight_kg)} из {wave.max_weight_kg} кг ({fillPercent} %)
                    </span>
                    <span
                      aria-label={`Заполнение волны: ${fillPercent} %`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={fillPercent}
                      className="wave-fill-meter"
                      role="progressbar"
                    >
                      <span style={{ width: `${fillPercent}%` }} />
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          {selectedWave && isEstimateLoading && <p className="loading-copy" aria-live="polite">Рассчитываем доставку…</p>}
          {estimateError && (
            <div className="wave-error" role="alert">
              <p>{estimateError}</p>
              <button onClick={() => setEstimateRetryVersion((current) => current + 1)} type="button">
                Повторить расчёт
              </button>
            </div>
          )}

          {estimate && (
            <section className="delivery-summary" aria-labelledby="delivery-summary-title">
              <p className="eyebrow">Предварительная стоимость</p>
              <h2 id="delivery-summary-title">{formatPrice(estimate.total_rub)}</h2>
              {estimate.thermal_packaging.notice && (
                <p className="delivery-summary__notice">{estimate.thermal_packaging.notice}</p>
              )}
              {estimate.thermal_packaging.required && (
                <p className="delivery-summary__note">Термоупаковка обязательна и уже включена в стоимость.</p>
              )}
              {estimate.thermal_packaging.available && !estimate.thermal_packaging.required && (
                <label className="checkout-checkbox" htmlFor="cart-thermal-packaging">
                  <input
                    checked={thermalPackagingRequested}
                    id="cart-thermal-packaging"
                    onChange={(event) => setThermalPackagingRequested(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Добавить термоупаковку · +150 ₽ за заказ</span>
                </label>
              )}
              <dl>
                <div>
                  <dt>Вес корзины</dt>
                  <dd>{formatWeight(estimate.order_weight_kg)}</dd>
                </div>
                <div>
                  <dt>Тариф доставки</dt>
                  <dd>{formatPrice(estimate.applied_rate_rub_per_kg)} / кг</dd>
                </div>
                <div>
                  <dt>Товары</dt>
                  <dd>{formatPrice(estimate.products_total_rub)}</dd>
                </div>
                <div>
                  <dt>Доставка</dt>
                  <dd>{formatPrice(estimate.shipping_cost_rub)}</dd>
                </div>
                <div>
                  <dt>Термоупаковка</dt>
                  <dd>{formatPrice(estimate.thermal_packaging.cost_rub)}</dd>
                </div>
                <div className="delivery-summary__total">
                  <dt>Итого</dt>
                  <dd>{formatPrice(estimate.total_rub)}</dd>
                </div>
              </dl>
              <p className="delivery-summary__note">{estimate.explanation}</p>
              <p className="delivery-summary__date">
                Отправка {formatDate(estimate.dispatch_date)}. Ожидаемая доставка: {formatDate(estimate.expected_delivery_from)} — {formatDate(estimate.expected_delivery_to)}
                {' '}({estimate.delivery_min_days}–{estimate.delivery_max_days} дней после отправки).
              </p>
            </section>
          )}

          <div className="checkout-placeholder">
            {estimate ? (
              <AppLink className="primary-button checkout-link" to={`/checkout?wave=${estimate.wave_id}&thermal=${Number(thermalPackagingRequested)}`}>
                Перейти к оформлению
              </AppLink>
            ) : (
              <p>Выберите волну и дождитесь расчёта, чтобы оформить заказ.</p>
            )}
          </div>
        </section>
      </div>
    </PageContainer>
  )
}
