import { useEffect, useState } from 'react'

import { PageContainer } from '../components/PageContainer'
import { getProduct, productImageUrl, type Product } from '../lib/api'
import { AppLink } from '../lib/router'
import { useCart } from '../lib/useCart'

type ProductPageProps = {
  productId: string
}

type ProductState =
  | { status: 'loading' }
  | { status: 'ready'; product: Product }
  | { status: 'error'; message: string }

function formatPrice(value: string) {
  return `${new Intl.NumberFormat('ru-RU').format(Number(value))} ₽`
}

export function ProductPage({ productId }: ProductPageProps) {
  const [productState, setProductState] = useState<ProductState>({ status: 'loading' })
  const [cartNotice, setCartNotice] = useState<string | null>(null)
  const { addProduct, isHydrated } = useCart()

  useEffect(() => {
    let isCurrent = true

    getProduct(productId)
      .then((product) => {
        if (isCurrent) setProductState({ status: 'ready', product })
      })
      .catch((requestError: Error) => {
        if (isCurrent) setProductState({ status: 'error', message: requestError.message })
      })

    return () => {
      isCurrent = false
    }
  }, [productId])

  if (productState.status === 'loading') {
    return (
      <PageContainer>
        <section className="product-state" aria-live="polite">
          <p>Загружаем карточку товара…</p>
        </section>
      </PageContainer>
    )
  }

  if (productState.status === 'error') {
    return (
      <PageContainer>
        <section className="product-state" aria-labelledby="product-error-title">
          <p className="eyebrow">Ошибка 404</p>
          <h1 id="product-error-title">Товар не найден</h1>
          <p>{productState.message}</p>
          <AppLink className="text-link" to="/catalog">
            Перейти в каталог
          </AppLink>
        </section>
      </PageContainer>
    )
  }

  const { product } = productState
  const regionTitle = product.region === 'yakutia' ? 'Якутии' : 'Донбасса'

  const handleAddToCart = () => {
    const result = addProduct(product)
    const notices = {
      added: 'Товар добавлен в корзину. Выберите волну доставки на следующем шаге.',
      'region-conflict': 'В одной корзине можно объединять товары только из одного региона.',
      'not-ready': 'Корзина ещё восстанавливается. Попробуйте через мгновение.',
    }
    setCartNotice(notices[result])
  }

  return (
    <PageContainer>
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <AppLink to={`/catalog?region=${product.region}`}>Сладости {regionTitle}</AppLink>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <article className="product-page">
        {product.photo ? (
          <img className="product-page__image" src={productImageUrl(product.photo)} alt={product.name} />
        ) : (
          <div className="product-page__placeholder" aria-hidden="true">
            {product.category}
          </div>
        )}
        <div className="product-page__content">
          <p className="eyebrow">{product.manufacturer}</p>
          <h1>{product.name}</h1>
          <p className="product-page__origin">Производитель из {regionTitle}</p>
          <div className="product-page__price-row">
            <strong>{formatPrice(product.price_rub)}</strong>
            <span>{product.weight_g} г</span>
          </div>

          {product.temp_sensitive && (
            <p className="temperature-warning">
              Товар чувствителен к температуре. Перед отправкой будут учтены условия перевозки.
            </p>
          )}

          <dl className="product-page__facts">
            <div>
              <dt>Категория</dt>
              <dd>{product.category}</dd>
            </div>
            <div>
              <dt>Срок годности</dt>
              <dd>{product.shelf_life_days} дней</dd>
            </div>
          </dl>

          <section className="product-page__description" aria-labelledby="description-title">
            <h2 id="description-title">О товаре</h2>
            <p>{product.description}</p>
          </section>

          <button className="primary-button" disabled={!isHydrated} onClick={handleAddToCart} type="button">
            {isHydrated ? 'Добавить в корзину' : 'Готовим корзину…'}
          </button>
          {cartNotice && (
            <p className="cart-notice" role="status">
              {cartNotice}
            </p>
          )}
        </div>
      </article>
    </PageContainer>
  )
}
