import { type FormEvent, useEffect, useState } from 'react'

import './CheckoutPage.css'
import './AdminPage.css'
import { PageContainer } from '../components/PageContainer'
import { ApiRequestError, verifyAdminToken } from '../lib/api'
import { AppLink } from '../lib/router'
import { AdminOrdersPage } from './AdminOrdersPage'
import { AdminProductsPage } from './AdminProductsPage'
import { AdminWavesPage } from './AdminWavesPage'

const storageKey = 'sweet-bridge-admin-token'

type AdminSection = 'products' | 'waves' | 'orders'

export function AdminPage({ section }: { section: AdminSection }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(storageKey) ?? '')
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null)
  const [enteredToken, setEnteredToken] = useState('')
  const [isChecking, setIsChecking] = useState(Boolean(token))
  const [authError, setAuthError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  const logout = () => {
    sessionStorage.removeItem(storageKey)
    setToken('')
    setVerifiedToken(null)
    setEnteredToken('')
    setIsChecking(false)
  }

  useEffect(() => {
    if (!token || verifiedToken === token) return undefined
    let isCurrent = true
    verifyAdminToken(token)
      .then(() => {
        if (!isCurrent) return
        setVerifiedToken(token)
        setAuthError(null)
        setIsChecking(false)
      })
      .catch((error: Error) => {
        if (!isCurrent) return
        if (error instanceof ApiRequestError && error.status === 401) {
          sessionStorage.removeItem(storageKey)
          setToken('')
          setVerifiedToken(null)
          setAuthError('Токен больше не подходит. Введите его снова.')
        } else {
          setAuthError(error.message)
        }
        setIsChecking(false)
      })
    return () => {
      isCurrent = false
    }
  }, [token, verifiedToken, retry])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = enteredToken.trim()
    if (!value) {
      setAuthError('Введите административный токен.')
      return
    }
    setIsChecking(true)
    setAuthError(null)
    try {
      await verifyAdminToken(value)
      sessionStorage.setItem(storageKey, value)
      setVerifiedToken(value)
      setToken(value)
      setEnteredToken('')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Не удалось проверить токен.')
    } finally {
      setIsChecking(false)
    }
  }

  const handleUnauthorized = (error: unknown) => {
    if (error instanceof ApiRequestError && error.status === 401) {
      logout()
      setAuthError('Доступ закрыт. Введите действующий токен.')
      return true
    }
    return false
  }

  if (isChecking && !verifiedToken) {
    return <PageContainer><section className="admin-state" aria-live="polite"><p>Проверяем доступ…</p></section></PageContainer>
  }

  if (token && !verifiedToken) {
    return (
      <PageContainer>
        <section className="admin-state" aria-labelledby="admin-access-title">
          <p className="eyebrow">Для продавцов</p>
          <h1 id="admin-access-title">Не удалось проверить доступ</h1>
          {authError && <p role="alert">{authError}</p>}
          <div className="admin-actions">
            <button className="primary-button" onClick={() => { setIsChecking(true); setRetry((value) => value + 1) }} type="button">Повторить проверку</button>
            <button className="admin-text-button" onClick={logout} type="button">Ввести другой токен</button>
          </div>
        </section>
      </PageContainer>
    )
  }

  if (!verifiedToken) {
    return (
      <PageContainer>
        <section className="admin-login" aria-labelledby="admin-login-title">
          <p className="eyebrow">Для продавцов</p>
          <h1 id="admin-login-title">Вход в кабинет</h1>
          <p>Для демо используйте токен <strong>admin</strong>.</p>
          <form onSubmit={handleLogin}>
            <label className="checkout-field" htmlFor="admin-token">
              <span>Административный токен</span>
              <input
                autoComplete="off"
                id="admin-token"
                onChange={(event) => { setEnteredToken(event.target.value); setAuthError(null) }}
                type="password"
                value={enteredToken}
              />
            </label>
            {authError && <p className="checkout-validation" role="alert">{authError}</p>}
            <button className="primary-button" disabled={isChecking} type="submit">{isChecking ? 'Проверяем…' : 'Войти'}</button>
          </form>
        </section>
      </PageContainer>
    )
  }

  const navigation: { to: string; label: string; section: AdminSection }[] = [
    { to: '/admin/products', label: 'Товары', section: 'products' },
    { to: '/admin/waves', label: 'Волны', section: 'waves' },
    { to: '/admin/orders', label: 'Заказы', section: 'orders' },
  ]

  return (
    <PageContainer>
      <section className="admin-page" aria-labelledby="admin-title">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">Для продавцов</p>
            <h1 id="admin-title">Кабинет администратора</h1>
          </div>
          <button className="admin-text-button" onClick={logout} type="button">Выйти</button>
        </div>
        <nav className="admin-navigation" aria-label="Разделы кабинета">
          {navigation.map((item) => (
            <AppLink aria-current={section === item.section ? 'page' : undefined} key={item.to} to={item.to}>
              {item.label}
            </AppLink>
          ))}
        </nav>
        {section === 'products' && <AdminProductsPage token={verifiedToken} onUnauthorized={handleUnauthorized} />}
        {section === 'waves' && <AdminWavesPage token={verifiedToken} onUnauthorized={handleUnauthorized} />}
        {section === 'orders' && <AdminOrdersPage token={verifiedToken} onUnauthorized={handleUnauthorized} />}
      </section>
    </PageContainer>
  )
}
