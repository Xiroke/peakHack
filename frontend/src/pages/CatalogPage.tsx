import { useEffect, useMemo, useState } from 'react'

import { CatalogFilters } from '../components/CatalogFilters'
import { PageContainer } from '../components/PageContainer'
import { ProductCard } from '../components/ProductCard'
import { getProductMeta, getProducts, type Product, type ProductFilters, type ProductMeta, type Region } from '../lib/api'
import { useRouter } from '../lib/useRouter'

const regions: Array<{ value: Region; title: string; description: string }> = [
  {
    value: 'yakutia',
    title: 'Сладости Якутии',
    description: 'Фирменные изделия северных производителей: ягоды, шоколад и подарочные наборы.',
  },
  {
    value: 'dnr',
    title: 'Сладости Донбасса',
    description: 'Кондитерские изделия производителей региона для дома, подарка и тёплой встречи.',
  },
]

type CatalogState = {
  requestKey: string
  products: Product[]
  meta: ProductMeta | null
  error: string | null
}

function isRegion(value: string | null): value is Region {
  return value === 'yakutia' || value === 'dnr'
}

function readFilters(search: string): ProductFilters {
  const params = new URLSearchParams(search)
  const region = params.get('region')

  return {
    region: isRegion(region) ? region : 'yakutia',
    category: params.get('category') || undefined,
    manufacturer: params.get('manufacturer') || undefined,
    search: params.get('search') || undefined,
    temp_sensitive: params.get('temp_sensitive') === 'true' ? true : undefined,
    min_price: params.get('min_price') || undefined,
    max_price: params.get('max_price') || undefined,
  }
}

function buildCatalogPath(filters: ProductFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return `/catalog?${params}`
}

export function CatalogPage() {
  const { navigate, search } = useRouter()
  const filters = useMemo(() => readFilters(search), [search])
  const region = filters.region ?? 'yakutia'
  const regionInfo = regions.find((item) => item.value === region) ?? regions[0]
  const [retryVersion, setRetryVersion] = useState(0)
  const requestKey = `${search}|${region}|${retryVersion}`
  const [catalogState, setCatalogState] = useState<CatalogState>({
    requestKey: '',
    products: [],
    meta: null,
    error: null,
  })
  const isLoading = catalogState.requestKey !== requestKey
  const products = isLoading ? [] : catalogState.products
  const meta = isLoading ? null : catalogState.meta
  const error = isLoading ? null : catalogState.error

  useEffect(() => {
    if (!new URLSearchParams(search).has('region')) {
      navigate('/catalog?region=yakutia')
    }
  }, [navigate, search])

  useEffect(() => {
    let isCurrent = true

    Promise.all([getProducts(filters), getProductMeta(region)])
      .then(([nextProducts, nextMeta]) => {
        if (!isCurrent) return
        setCatalogState({ requestKey, products: nextProducts, meta: nextMeta, error: null })
      })
      .catch((requestError: Error) => {
        if (!isCurrent) return
        setCatalogState({ requestKey, products: [], meta: null, error: requestError.message })
      })

    return () => {
      isCurrent = false
    }
  }, [filters, region, requestKey, retryVersion])

  const changeFilters = (nextFilters: ProductFilters) => navigate(buildCatalogPath(nextFilters))
  const resetFilters = () => changeFilters({ region })

  return (
    <PageContainer>
      <section className="catalog-intro" aria-labelledby="catalog-title">
        <p className="eyebrow">Региональная витрина</p>
        <div className="catalog-intro__header">
          <div>
            <h1 id="catalog-title">{regionInfo.title}</h1>
            <p>{regionInfo.description}</p>
          </div>
          <div className="region-switch" aria-label="Выберите витрину">
            {regions.map((item) => (
              <button
                aria-pressed={item.value === region}
                className={item.value === region ? 'is-active' : ''}
                key={item.value}
                onClick={() => changeFilters({ region: item.value })}
                type="button"
              >
                {item.value === 'yakutia' ? 'Якутия' : 'Донбасс'}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="catalog-layout" aria-label="Ассортимент">
        <CatalogFilters filters={filters} meta={meta} onChange={changeFilters} onReset={resetFilters} region={region} />

        <div className="catalog-results">
          <div className="catalog-results__header" aria-live="polite">
            {isLoading ? <p>Подбираем товары…</p> : <p>Найдено: {products.length}</p>}
          </div>

          {error && (
            <div className="catalog-message catalog-message--error" role="alert">
              <h2>Не удалось загрузить каталог</h2>
              <p>{error}</p>
              <button onClick={() => setRetryVersion((current) => current + 1)} type="button">
                Повторить попытку
              </button>
            </div>
          )}

          {!error && !isLoading && products.length === 0 && (
            <div className="catalog-message">
              <h2>По этим условиям ничего не найдено</h2>
              <p>Попробуйте изменить поиск или снять часть фильтров.</p>
              <button onClick={resetFilters} type="button">
                Сбросить фильтры
              </button>
            </div>
          )}

          {!error && products.length > 0 && (
            <div className={`product-grid${isLoading ? ' is-loading' : ''}`} aria-busy={isLoading}>
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </PageContainer>
  )
}
