import { AppShell } from './components/AppShell'
import { useRouter } from './lib/useRouter'
import { AdminPage } from './pages/AdminPage'
import { CartPage } from './pages/CartPage'
import { CatalogPage } from './pages/CatalogPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OrderConfirmationPage } from './pages/OrderConfirmationPage'
import { ProductPage } from './pages/ProductPage'
import { TrackingResultPage, TrackingSearchPage } from './pages/TrackingPage'
import './App.css'

function App() {
  const { pathname } = useRouter()

  let page = <NotFoundPage />
  if (pathname === '/') page = <HomePage />
  if (pathname === '/catalog') page = <CatalogPage />
  if (pathname.startsWith('/products/')) {
    page = <ProductPage key={pathname} productId={pathname.slice('/products/'.length)} />
  }
  if (pathname === '/cart') page = <CartPage />
  if (pathname === '/checkout') page = <CheckoutPage />
  if (pathname.startsWith('/orders/')) {
    page = <OrderConfirmationPage key={pathname} publicOrderId={pathname.slice('/orders/'.length)} />
  }
  if (pathname === '/tracking') page = <TrackingSearchPage />
  if (pathname.startsWith('/tracking/')) {
    page = <TrackingResultPage key={pathname} publicOrderId={pathname.slice('/tracking/'.length)} />
  }
  if (pathname === '/admin' || pathname === '/admin/products') page = <AdminPage section="products" />
  if (pathname === '/admin/waves') page = <AdminPage section="waves" />
  if (pathname === '/admin/orders') page = <AdminPage section="orders" />

  return <AppShell>{page}</AppShell>
}

export default App
