import { type FormEvent, useEffect, useRef, useState } from 'react'

import './CheckoutPage.css'
import { PageContainer } from '../components/PageContainer'
import { createOrder, getDeliveryEstimate, type CreateOrderPayload, type DeliveryEstimate, type Region } from '../lib/api'
import { AppLink } from '../lib/router'
import { useCart } from '../lib/useCart'
import { useRouter } from '../lib/useRouter'

type EstimateState = {
  requestKey: string
  estimate: DeliveryEstimate | null
  error: string | null
}

type CheckoutForm = {
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  isGift: boolean
  cardMessage: string
  confirmed: boolean
}

function formatPrice(value: string | number) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))} ₽`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function recipientFor(region: Region): Region {
  return region === 'yakutia' ? 'dnr' : 'yakutia'
}

function formErrorsFor(form: CheckoutForm) {
  const errors: Partial<Record<keyof CheckoutForm, string>> = {}
  if (form.recipientName.trim().length < 2) errors.recipientName = 'Укажите имя получателя.'
  const phoneDigits = form.recipientPhone.replace(/\D/g, '').length
  if (!/^\+?[0-9 ()-]{7,32}$/.test(form.recipientPhone.trim()) || phoneDigits < 7 || phoneDigits > 15) {
    errors.recipientPhone = 'Укажите номер телефона в допустимом формате.'
  }
  if (form.recipientAddress.trim().length < 5) errors.recipientAddress = 'Укажите адрес или пункт выдачи.'
  if (form.isGift && form.cardMessage.length > 500) errors.cardMessage = 'Текст открытки не должен превышать 500 символов.'
  if (!form.confirmed) errors.confirmed = 'Подтвердите данные заказа перед имитацией оплаты.'
  return errors
}

export function CheckoutPage() {
  const { items, isHydrated, clearCart, hydrationError, retryHydration } = useCart()
  const { navigate, search } = useRouter()
  const waveId = Number(new URLSearchParams(search).get('wave'))
  const originRegion = items[0]?.product.region
  const recipientRegion = originRegion ? recipientFor(originRegion) : null
  const cartKey = items.map((item) => `${item.product.id}:${item.quantity}`).join('|')
  const [thermalPackagingRequested, setThermalPackagingRequested] = useState(
    () => new URLSearchParams(search).get('thermal') === '1',
  )
  const [estimateRetry, setEstimateRetry] = useState(0)
  const validWaveId = Number.isSafeInteger(waveId) && waveId > 0
  const estimateKey = validWaveId && recipientRegion && cartKey
    ? `${waveId}|${recipientRegion}|${cartKey}|${thermalPackagingRequested}|${estimateRetry}`
    : ''
  const [estimateState, setEstimateState] = useState<EstimateState>({ requestKey: '', estimate: null, error: null })
  const [form, setForm] = useState<CheckoutForm>({
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    isGift: false,
    cardMessage: '',
    confirmed: false,
  })
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CheckoutForm, string>>>({})
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitting = useRef(false)
  const lastSubmission = useRef<{ payload: string; key: string } | null>(null)
  const isEstimateLoading = Boolean(estimateKey && estimateState.requestKey !== estimateKey)
  const estimate = isEstimateLoading || !estimateKey ? null : estimateState.estimate
  const estimateError = isEstimateLoading || !estimateKey ? null : estimateState.error

  useEffect(() => {
    if (!estimateKey || !recipientRegion) return undefined

    let isCurrent = true
    getDeliveryEstimate({
      wave_id: waveId,
      recipient_region: recipientRegion,
      items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      thermal_packaging_requested: thermalPackagingRequested,
    })
      .then((nextEstimate) => {
        if (isCurrent) setEstimateState({ requestKey: estimateKey, estimate: nextEstimate, error: null })
      })
      .catch((requestError: Error) => {
        if (isCurrent) setEstimateState({ requestKey: estimateKey, estimate: null, error: requestError.message })
      })

    return () => {
      isCurrent = false
    }
  }, [estimateKey, items, recipientRegion, waveId, thermalPackagingRequested])

  const updateForm = <Key extends keyof CheckoutForm>(key: Key, value: CheckoutForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFormErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!estimate || !recipientRegion || submitting.current) return

    const nextErrors = formErrorsFor(form)
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    const payload: CreateOrderPayload = {
      wave_id: estimate.wave_id,
      recipient_region: recipientRegion,
      recipient_name: form.recipientName.trim(),
      recipient_phone: form.recipientPhone.trim(),
      recipient_address: form.recipientAddress.trim(),
      is_gift: form.isGift,
      card_message: form.isGift && form.cardMessage.trim() ? form.cardMessage.trim() : undefined,
      thermal_packaging_requested: estimate.thermal_packaging.applied,
      items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
    }
    const serialized = JSON.stringify(payload)
    if (lastSubmission.current?.payload !== serialized) {
      lastSubmission.current = { payload: serialized, key: crypto.randomUUID() }
    }
    submitting.current = true
    setIsSubmitting(true)
    setSubmissionError(null)
    try {
      const order = await createOrder(payload, lastSubmission.current.key)
      clearCart()
      navigate(`/orders/${order.public_id}`)
    } catch (requestError) {
      setSubmissionError(requestError instanceof Error ? requestError.message : 'Не удалось создать заказ.')
      submitting.current = false
      setIsSubmitting(false)
    }
  }

  if (!isHydrated) {
    return (
      <PageContainer>
        <section className="checkout-state" aria-live="polite">
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

  if (!originRegion || !validWaveId || !recipientRegion) {
    return (
      <PageContainer>
        <section className="checkout-state" aria-labelledby="checkout-state-title">
          <p className="eyebrow">Оформление заказа</p>
          <h1 id="checkout-state-title">Сначала выберите волну доставки</h1>
          <p>Оформление доступно только для непустой корзины с актуальным предварительным расчётом.</p>
          <AppLink className="text-link" to="/cart">
            Вернуться в корзину
          </AppLink>
        </section>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <section className="checkout-heading" aria-labelledby="checkout-title">
        <p className="eyebrow">Имитация оплаты</p>
        <h1 id="checkout-title">Подтвердите заказ</h1>
        <p>После подтверждения заказ будет принят в выбранную волну. Реальная оплата на этом этапе не выполняется.</p>
      </section>

      <form className="checkout-layout" onSubmit={handleSubmit} noValidate>
        <fieldset className="checkout-form" disabled={isSubmitting}>
          <section aria-labelledby="recipient-title">
            <h2 id="recipient-title">Получатель</h2>
            <p className="checkout-section-note">
              Доставка будет оформлена в {recipientRegion === 'yakutia' ? 'Якутии' : 'Донбассе'} — это направление определяется товарами в корзине.
            </p>
            <label className="checkout-field" htmlFor="recipient-name">
              <span>ФИО получателя</span>
              <input
                aria-invalid={Boolean(formErrors.recipientName)}
                aria-describedby={formErrors.recipientName ? 'recipient-name-error' : undefined}
                autoComplete="name"
                maxLength={160}
                id="recipient-name"
                onChange={(event) => updateForm('recipientName', event.target.value)}
                value={form.recipientName}
              />
              {formErrors.recipientName && <small id="recipient-name-error">{formErrors.recipientName}</small>}
            </label>
            <label className="checkout-field" htmlFor="recipient-phone">
              <span>Телефон</span>
              <input
                aria-invalid={Boolean(formErrors.recipientPhone)}
                aria-describedby={formErrors.recipientPhone ? 'recipient-phone-error' : undefined}
                autoComplete="tel"
                id="recipient-phone"
                inputMode="tel"
                maxLength={32}
                type="tel"
                onChange={(event) => updateForm('recipientPhone', event.target.value)}
                placeholder="+7 999 000-00-00"
                value={form.recipientPhone}
              />
              {formErrors.recipientPhone && <small id="recipient-phone-error">{formErrors.recipientPhone}</small>}
            </label>
            <label className="checkout-field" htmlFor="recipient-address">
              <span>Адрес или пункт выдачи</span>
              <textarea
                aria-invalid={Boolean(formErrors.recipientAddress)}
                aria-describedby={formErrors.recipientAddress ? 'recipient-address-error' : undefined}
                id="recipient-address"
                maxLength={500}
                autoComplete="street-address"
                onChange={(event) => updateForm('recipientAddress', event.target.value)}
                rows={3}
                value={form.recipientAddress}
              />
              {formErrors.recipientAddress && <small id="recipient-address-error">{formErrors.recipientAddress}</small>}
            </label>
          </section>

          <section className="gift-section" aria-labelledby="gift-title">
            <h2 id="gift-title">Подарок</h2>
            <label className="checkout-checkbox" htmlFor="is-gift">
              <input
                checked={form.isGift}
                id="is-gift"
                onChange={(event) => updateForm('isGift', event.target.checked)}
                type="checkbox"
              />
              <span>Оформить заказ как подарок</span>
            </label>
            {form.isGift && (
              <label className="checkout-field" htmlFor="card-message">
                <span>Текст открытки <em>необязательно</em></span>
                <textarea
                  aria-invalid={Boolean(formErrors.cardMessage)}
                  id="card-message"
                  maxLength={500}
                  onChange={(event) => updateForm('cardMessage', event.target.value)}
                  placeholder="Напишите тёплое пожелание"
                  rows={3}
                  value={form.cardMessage}
                />
                <small>{form.cardMessage.length}/500</small>
                {formErrors.cardMessage && <small>{formErrors.cardMessage}</small>}
              </label>
            )}
          </section>

        </fieldset>

        <aside className="checkout-summary" aria-labelledby="summary-title">
          <p className="eyebrow">Проверка заказа</p>
          <h2 id="summary-title">Ваша отправка</h2>
          {isEstimateLoading && <p className="checkout-section-note">Обновляем расчёт…</p>}
          {estimateError && (
            <div role="alert">
              <p className="checkout-validation">{estimateError}</p>
              <button className="primary-button" onClick={() => setEstimateRetry((value) => value + 1)} type="button">
                Повторить расчёт
              </button>
            </div>
          )}
          {estimate && (
            <>
              <p className="checkout-wave-date">Отправка {formatDate(estimate.dispatch_date)}</p>
              <p className="checkout-section-note">Заказы принимаются до {formatDate(estimate.order_deadline)}</p>
              <p className="checkout-section-note">
                Ожидаемая доставка: {formatDate(estimate.expected_delivery_from)} — {formatDate(estimate.expected_delivery_to)}
              </p>
              {estimate.thermal_packaging.notice && (
                <p className="checkout-seasonal-notice">{estimate.thermal_packaging.notice}</p>
              )}
              {estimate.thermal_packaging.required && (
                <p className="checkout-section-note">Термоупаковка обязательна и уже включена в заказ.</p>
              )}
              {estimate.thermal_packaging.available && !estimate.thermal_packaging.required && (
                <label className="checkout-checkbox" htmlFor="checkout-thermal-packaging">
                  <input
                    checked={thermalPackagingRequested}
                    disabled={isSubmitting}
                    id="checkout-thermal-packaging"
                    onChange={(event) => setThermalPackagingRequested(event.target.checked)}
                    type="checkbox"
                  />
                  <span>Добавить термоупаковку · +150 ₽ за заказ</span>
                </label>
              )}
              <ul className="checkout-items">
                {items.map((item) => (
                  <li key={item.product.id}>
                    <span>{item.product.name} × {item.quantity}</span>
                  </li>
                ))}
              </ul>
              <dl>
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
                <div className="checkout-summary__total">
                  <dt>Итого</dt>
                  <dd>{formatPrice(estimate.total_rub)}</dd>
                </div>
              </dl>
            </>
          )}
        </aside>
        <section className="confirmation-section" aria-labelledby="confirmation-title">
          <h2 id="confirmation-title">Подтверждение</h2>
          <label className="checkout-checkbox" htmlFor="confirm-order">
            <input
              checked={form.confirmed}
              disabled={isSubmitting}
              id="confirm-order"
              onChange={(event) => updateForm('confirmed', event.target.checked)}
              type="checkbox"
            />
            <span>Состав и данные получателя проверены</span>
          </label>
          {formErrors.confirmed && <p className="checkout-validation" role="alert">{formErrors.confirmed}</p>}
          {submissionError && <p className="checkout-validation" role="alert">{submissionError}</p>}
          <button className="primary-button" disabled={!estimate || isSubmitting} type="submit">
            {isSubmitting ? 'Подтверждаем заказ…' : 'Подтвердить и оплатить'}
          </button>
        </section>
      </form>
    </PageContainer>
  )
}
