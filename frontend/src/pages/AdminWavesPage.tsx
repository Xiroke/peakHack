import { type FormEvent, useEffect, useState } from 'react'

import { createAdminWave, getAdminWaves, type AdminWave, type AdminWaveInput, type WaveStatus } from '../lib/api'

const waveStatusLabels: Record<WaveStatus, string> = {
  open: 'Открыта',
  closed: 'Закрыта',
  dispatched: 'Отправлена',
  completed: 'Завершена',
}

const emptyWave: AdminWaveInput = {
  direction: 'yakutia_to_dnr',
  dispatch_date: '',
  order_deadline: '',
  min_weight_kg: 50,
  max_weight_kg: 300,
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function formatPrice(value: string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))} ₽`
}

export function AdminWavesPage({ token, onUnauthorized }: { token: string; onUnauthorized: (error: unknown) => boolean }) {
  const [waves, setWaves] = useState<AdminWave[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [form, setForm] = useState<AdminWaveInput | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isCurrent = true
    getAdminWaves(token)
      .then((items) => {
        if (!isCurrent) return
        setWaves(items)
        setIsLoading(false)
        setLoadError(null)
      })
      .catch((error: Error) => {
        if (!isCurrent || onUnauthorized(error)) return
        setLoadError(error.message)
        setIsLoading(false)
      })
    return () => { isCurrent = false }
  }, [token, retry, onUnauthorized])

  const changeForm = <Key extends keyof AdminWaveInput>(key: Key, value: AdminWaveInput[Key]) => {
    setForm((current) => current ? { ...current, [key]: value } : current)
    setFormError(null)
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form || isSaving) return
    setIsSaving(true)
    setFormError(null)
    try {
      const created = await createAdminWave(token, form)
      setWaves((current) => [created, ...current])
      setForm(null)
    } catch (error) {
      if (!onUnauthorized(error)) setFormError(error instanceof Error ? error.message : 'Не удалось создать волну.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="admin-section" aria-labelledby="admin-waves-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-waves-title">Волны доставки</h2>
          <p>Загрузка и текущий тариф рассчитаны по уже оформленным заказам.</p>
        </div>
        <button className="primary-button" onClick={() => { setForm({ ...emptyWave }); setFormError(null) }} type="button">Создать волну</button>
      </div>

      {form && (
        <form className="admin-form" onSubmit={handleSave} aria-labelledby="admin-wave-form-title">
          <h3 id="admin-wave-form-title">Новая волна</h3>
          <div className="admin-form-grid">
            <label className="checkout-field" htmlFor="admin-wave-direction">
              <span>Направление</span>
              <select id="admin-wave-direction" value={form.direction} onChange={(event) => changeForm('direction', event.target.value as AdminWaveInput['direction'])}>
                <option value="yakutia_to_dnr">Якутия → Донбасс</option>
                <option value="dnr_to_yakutia">Донбасс → Якутия</option>
              </select>
            </label>
            <label className="checkout-field" htmlFor="admin-wave-dispatch">
              <span>Дата отправки</span>
              <input id="admin-wave-dispatch" required type="date" value={form.dispatch_date} onChange={(event) => changeForm('dispatch_date', event.target.value)} />
            </label>
            <label className="checkout-field" htmlFor="admin-wave-deadline">
              <span>Дедлайн заказов</span>
              <input id="admin-wave-deadline" required type="date" value={form.order_deadline} onChange={(event) => changeForm('order_deadline', event.target.value)} />
            </label>
            <label className="checkout-field" htmlFor="admin-wave-min-weight">
              <span>Минимальный вес, кг</span>
              <input id="admin-wave-min-weight" min={1} required step={1} type="number" value={form.min_weight_kg} onChange={(event) => changeForm('min_weight_kg', Number(event.target.value))} />
            </label>
            <label className="checkout-field" htmlFor="admin-wave-max-weight">
              <span>Вместимость, кг</span>
              <input id="admin-wave-max-weight" min={1} required step={1} type="number" value={form.max_weight_kg} onChange={(event) => changeForm('max_weight_kg', Number(event.target.value))} />
            </label>
          </div>
          {formError && <p className="checkout-validation" role="alert">{formError}</p>}
          <div className="admin-actions">
            <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'Создаём…' : 'Создать волну'}</button>
            <button className="admin-text-button" onClick={() => setForm(null)} type="button">Отмена</button>
          </div>
        </form>
      )}

      {isLoading && <p className="admin-message" aria-live="polite">Загружаем волны…</p>}
      {loadError && (
        <div className="admin-message" role="alert"><p>{loadError}</p><button className="admin-text-button" onClick={() => { setIsLoading(true); setRetry((value) => value + 1) }} type="button">Повторить</button></div>
      )}
      {!isLoading && !loadError && waves.length === 0 && <p className="admin-message">Волн пока нет. Создайте первую отправку.</p>}
      {!isLoading && !loadError && waves.length > 0 && (
        <div className="admin-table-wrap" role="region" aria-label="Список волн" tabIndex={0}>
          <table className="admin-table admin-wave-table">
            <thead><tr><th scope="col">Волна</th><th scope="col">Приём до</th><th scope="col">Загрузка</th><th scope="col">Заказы</th><th scope="col">Сумма и тариф</th></tr></thead>
            <tbody>
              {waves.map((wave) => {
                const percent = Number(wave.current_fill_percent)
                return (
                  <tr key={wave.id}>
                    <td data-label="Волна">
                      <strong>{wave.direction === 'yakutia_to_dnr' ? 'Якутия → Донбасс' : 'Донбасс → Якутия'}</strong>
                      <small>Отправка {formatDate(wave.dispatch_date)} · {waveStatusLabels[wave.status]}</small>
                    </td>
                    <td data-label="Приём до">{formatDate(wave.order_deadline)}</td>
                    <td data-label="Загрузка">
                      <span>{wave.current_weight_kg} из {wave.max_weight_kg} кг · {wave.current_fill_percent} %</span>
                      <span
                        aria-label={`Загрузка волны: ${wave.current_fill_percent} %`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={Math.min(100, Math.max(0, percent))}
                        className="admin-wave-meter"
                        role="progressbar"
                      >
                        <span style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
                      </span>
                    </td>
                    <td data-label="Заказы">{wave.order_count}</td>
                    <td data-label="Сумма и тариф"><strong>{formatPrice(wave.orders_total_rub)}</strong><small>Тариф {formatPrice(wave.current_rate_rub_per_kg)}/кг</small></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
