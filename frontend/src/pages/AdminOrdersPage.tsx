import { useEffect, useState } from 'react'

import {
  getAdminOrder,
  getAdminOrders,
  getAdminWaves,
  updateAdminOrderStatus,
  type AdminOrder,
  type AdminWave,
  type OrderStatus,
  type WaveDirection,
} from '../lib/api'
import { orderStatusLabels, orderStatusSequence } from '../lib/orderStatus'
import { AppLink } from '../lib/router'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00`),
  )
}

function formatPrice(value: string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))} ₽`
}

export function AdminOrdersPage({ token, onUnauthorized }: { token: string; onUnauthorized: (error: unknown) => boolean }) {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [waves, setWaves] = useState<AdminWave[]>([])
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('')
  const [directionFilter, setDirectionFilter] = useState<WaveDirection | ''>('')
  const [waveFilter, setWaveFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [detailRetry, setDetailRetry] = useState(0)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    let isCurrent = true
    getAdminWaves(token)
      .then((items) => { if (isCurrent) setWaves(items) })
      .catch((error: Error) => { if (isCurrent && !onUnauthorized(error)) setLoadError(error.message) })
    return () => { isCurrent = false }
  }, [token, onUnauthorized])

  useEffect(() => {
    let isCurrent = true
    getAdminOrders(token, {
      status: statusFilter || undefined,
      direction: directionFilter || undefined,
      wave_id: waveFilter ? Number(waveFilter) : undefined,
    })
      .then((items) => {
        if (!isCurrent) return
        setOrders(items)
        setIsLoading(false)
        setLoadError(null)
      })
      .catch((error: Error) => {
        if (!isCurrent || onUnauthorized(error)) return
        setLoadError(error.message)
        setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [token, statusFilter, directionFilter, waveFilter, retry, onUnauthorized])

  useEffect(() => {
    if (selectedId === null) return undefined
    let isCurrent = true
    getAdminOrder(token, selectedId)
      .then((order) => {
        if (!isCurrent) return
        setSelectedOrder(order)
        setIsDetailLoading(false)
        setDetailError(null)
      })
      .catch((error: Error) => {
        if (!isCurrent || onUnauthorized(error)) return
        setDetailError(error.message)
        setIsDetailLoading(false)
      })
    return () => { isCurrent = false }
  }, [token, selectedId, detailRetry, onUnauthorized])

  const selectOrder = (id: number) => {
    setSelectedId(id)
    setDetailRetry((value) => value + 1)
    setSelectedOrder(null)
    setDetailError(null)
    setIsDetailLoading(true)
  }

  const clearSelection = () => {
    setSelectedId(null)
    setSelectedOrder(null)
    setDetailError(null)
  }

  const handleStatusChange = async (order: AdminOrder, nextStatus: OrderStatus) => {
    const warning = `Перевести заказ № ${order.public_id} в статус «${orderStatusLabels[nextStatus]}»? Вернуть предыдущий статус будет нельзя.`
    if (!window.confirm(warning)) return
    setIsUpdating(true)
    setDetailError(null)
    try {
      const updated = await updateAdminOrderStatus(token, order.id, nextStatus)
      setSelectedOrder(updated)
      setOrders((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (error) {
      if (!onUnauthorized(error)) setDetailError(error instanceof Error ? error.message : 'Не удалось изменить статус.')
    } finally {
      setIsUpdating(false)
    }
  }

  const nextStatus = selectedOrder
    ? orderStatusSequence[orderStatusSequence.indexOf(selectedOrder.status) + 1]
    : undefined
  const visibleOrders = statusFilter ? orders.filter((order) => order.status === statusFilter) : orders

  return (
    <section className="admin-section" aria-labelledby="admin-orders-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-orders-title">Заказы</h2>
          <p>Карточки содержат данные получателей только в этом защищённом разделе.</p>
        </div>
      </div>
      <div className="admin-filters" role="group" aria-label="Фильтры заказов">
        <label className="checkout-field" htmlFor="admin-orders-status">
          <span>Статус</span>
          <select id="admin-orders-status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as OrderStatus | ''); setIsLoading(true); clearSelection() }}>
            <option value="">Все статусы</option>
            {orderStatusSequence.map((status) => <option key={status} value={status}>{orderStatusLabels[status]}</option>)}
          </select>
        </label>
        <label className="checkout-field" htmlFor="admin-orders-direction">
          <span>Направление</span>
          <select id="admin-orders-direction" value={directionFilter} onChange={(event) => { setDirectionFilter(event.target.value as WaveDirection | ''); setIsLoading(true); clearSelection() }}>
            <option value="">Оба направления</option>
            <option value="yakutia_to_dnr">Якутия → Донбасс</option>
            <option value="dnr_to_yakutia">Донбасс → Якутия</option>
          </select>
        </label>
        <label className="checkout-field" htmlFor="admin-orders-wave">
          <span>Волна</span>
          <select id="admin-orders-wave" value={waveFilter} onChange={(event) => { setWaveFilter(event.target.value); setIsLoading(true); clearSelection() }}>
            <option value="">Все волны</option>
            {waves.map((wave) => <option key={wave.id} value={wave.id}>№ {wave.id} · {formatDate(wave.dispatch_date)} · {wave.direction === 'yakutia_to_dnr' ? 'Якутия → Донбасс' : 'Донбасс → Якутия'}</option>)}
          </select>
        </label>
      </div>

      {isLoading && <p className="admin-message" aria-live="polite">Загружаем заказы…</p>}
      {loadError && (
        <div className="admin-message" role="alert"><p>{loadError}</p><button className="admin-text-button" onClick={() => { setIsLoading(true); setRetry((value) => value + 1) }} type="button">Повторить</button></div>
      )}
      {!isLoading && !loadError && visibleOrders.length === 0 && <p className="admin-message">По выбранным фильтрам заказов нет.</p>}
      {!isLoading && !loadError && visibleOrders.length > 0 && (
        <div className="admin-table-wrap" role="region" aria-label="Список заказов" tabIndex={0}>
          <table className="admin-table">
            <thead><tr><th scope="col">Номер</th><th scope="col">Получатель</th><th scope="col">Волна</th><th scope="col">Статус</th><th scope="col">Сумма</th><th scope="col">Действие</th></tr></thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Номер"><strong>№ {order.id}</strong><small>{formatDate(order.created_at)}</small></td>
                  <td data-label="Получатель">{order.recipient_name}</td>
                  <td data-label="Волна">{formatDate(order.wave.dispatch_date)}</td>
                  <td data-label="Статус">{orderStatusLabels[order.status]}</td>
                  <td data-label="Сумма">{formatPrice(order.total_rub)}</td>
                  <td data-label="Действие"><button aria-label={`Открыть заказ № ${order.id}`} className="admin-text-button" onClick={() => selectOrder(order.id)} type="button">Подробнее</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId !== null && (
        <section className="admin-order-detail" aria-labelledby="admin-order-detail-title">
          <div className="admin-section-heading">
            <h3 id="admin-order-detail-title">Заказ № {selectedId}</h3>
            <button className="admin-text-button" onClick={clearSelection} type="button">Закрыть</button>
          </div>
          {isDetailLoading && <p className="admin-message" aria-live="polite">Загружаем подробности…</p>}
          {detailError && <p className="checkout-validation" role="alert">{detailError}</p>}
          {selectedOrder && (
            <>
              <dl className="admin-details">
                <div><dt>Статус</dt><dd>{orderStatusLabels[selectedOrder.status]}</dd></div>
                <div><dt>Направление</dt><dd>{selectedOrder.wave.direction === 'yakutia_to_dnr' ? 'Якутия → Донбасс' : 'Донбасс → Якутия'}</dd></div>
                <div><dt>Дата отправки</dt><dd>{formatDate(selectedOrder.wave.dispatch_date)}</dd></div>
                <div><dt>Получатель</dt><dd>{selectedOrder.recipient_name}</dd></div>
                <div><dt>Телефон</dt><dd>{selectedOrder.recipient_phone}</dd></div>
                <div><dt>Адрес</dt><dd>{selectedOrder.recipient_address}</dd></div>
                <div><dt>Подарок</dt><dd>{selectedOrder.is_gift ? 'Да' : 'Нет'}</dd></div>
                {selectedOrder.card_message && <div><dt>Текст открытки</dt><dd>{selectedOrder.card_message}</dd></div>}
                <div><dt>Термоупаковка</dt><dd>{selectedOrder.thermal_packaging.applied ? formatPrice(selectedOrder.thermal_packaging_cost_rub) : 'Нет'}</dd></div>
                <div><dt>Итого</dt><dd>{formatPrice(selectedOrder.total_rub)}</dd></div>
              </dl>
              <ul className="checkout-items">
                {selectedOrder.items.map((item) => <li key={item.product_id}><span>{item.name} × {item.quantity}</span><strong>{formatPrice(String(Number(item.unit_price_rub) * item.quantity))}</strong></li>)}
              </ul>
              <div className="admin-actions">
                {nextStatus ? (
                  <button className="primary-button" disabled={isUpdating} onClick={() => handleStatusChange(selectedOrder, nextStatus)} type="button">
                    {isUpdating ? 'Обновляем…' : `Перевести в статус «${orderStatusLabels[nextStatus]}»`}
                  </button>
                ) : <p>Доставка завершена. Статус больше нельзя изменить.</p>}
                <AppLink className="text-link" to={`/tracking/${selectedOrder.public_id}`}>Посмотреть отслеживание</AppLink>
              </div>
            </>
          )}
        </section>
      )}
    </section>
  )
}
