import { AppLink } from '../lib/router'
import { useCart } from '../lib/useCart'
import { useRouter } from '../lib/useRouter'

export function Header() {
  const { pathname } = useRouter()
  const { itemCount } = useCart()
  const navigation = [
    { to: '/catalog', label: 'Каталог' },
    { to: '/cart', label: itemCount > 0 ? `Корзина · ${itemCount}` : 'Корзина' },
    { to: '/tracking', label: 'Отследить заказ' },
  ]

  return (
    <header className="site-header">
      <div className="page-container site-header__content">
        <AppLink className="brand" to="/" aria-label="Сладкий мост — главная">
          <span className="brand__mark" aria-hidden="true">СМ</span>
          <span>Сладкий мост</span>
        </AppLink>

        <nav className="main-navigation" aria-label="Основная навигация">
          {navigation.map(({ to, label }) => (
            <AppLink
              aria-current={pathname === to ? 'page' : undefined}
              className={`main-navigation__link${pathname === to ? ' is-active' : ''}`}
              key={to}
              to={to}
            >
              {label}
            </AppLink>
          ))}
        </nav>

        <AppLink
          aria-current={pathname === '/admin' || pathname.startsWith('/admin/') ? 'page' : undefined}
          className="admin-link"
          to="/admin"
        >
          Для продавцов
        </AppLink>
      </div>
    </header>
  )
}
