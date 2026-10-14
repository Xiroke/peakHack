import { useState } from 'react'

import type { ProductFilters, ProductMeta, Region } from '../lib/api'

type CatalogFiltersProps = {
  filters: ProductFilters
  meta: ProductMeta | null
  region: Region
  onChange: (nextFilters: ProductFilters) => void
  onReset: () => void
}

export function CatalogFilters({ filters, meta, region, onChange, onReset }: CatalogFiltersProps) {
  const [isOpen, setIsOpen] = useState(false)
  const hasFilters = Boolean(
    filters.search ||
      filters.category ||
      filters.manufacturer ||
      filters.temp_sensitive ||
      filters.min_price ||
      filters.max_price,
  )

  const update = (values: Partial<ProductFilters>) => onChange({ ...filters, ...values, region })

  return (
    <section className="catalog-filters" aria-labelledby="filters-title">
      <div className="catalog-filters__mobile-head">
        <h2 id="filters-title">Фильтры</h2>
        <button
          aria-controls="catalog-filter-fields"
          aria-expanded={isOpen}
          className="filter-toggle"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {isOpen ? 'Скрыть' : 'Фильтры'}
        </button>
      </div>
      <div className={`catalog-filters__fields${isOpen ? ' is-open' : ''}`} id="catalog-filter-fields">
        <label className="filter-field filter-field--full" htmlFor="catalog-search">
          <span>Поиск</span>
          <input
            id="catalog-search"
            onChange={(event) => update({ search: event.target.value || undefined })}
            placeholder="Название или производитель"
            type="search"
            value={filters.search ?? ''}
          />
        </label>

        <label className="filter-field" htmlFor="catalog-category">
          <span>Категория</span>
          <select
            id="catalog-category"
            onChange={(event) => update({ category: event.target.value || undefined })}
            value={filters.category ?? ''}
          >
            <option value="">Все категории</option>
            {meta?.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field" htmlFor="catalog-manufacturer">
          <span>Производитель</span>
          <select
            id="catalog-manufacturer"
            onChange={(event) => update({ manufacturer: event.target.value || undefined })}
            value={filters.manufacturer ?? ''}
          >
            <option value="">Все производители</option>
            {meta?.manufacturers.map((manufacturer) => (
              <option key={manufacturer} value={manufacturer}>
                {manufacturer}
              </option>
            ))}
          </select>
        </label>

        <div className="price-range" role="group" aria-label="Диапазон цены">
          <label className="filter-field" htmlFor="catalog-min-price">
            <span>Цена от</span>
            <input
              id="catalog-min-price"
              inputMode="numeric"
              min="0"
              onChange={(event) => update({ min_price: event.target.value || undefined })}
              placeholder="0"
              type="number"
              value={filters.min_price ?? ''}
            />
          </label>
          <label className="filter-field" htmlFor="catalog-max-price">
            <span>Цена до</span>
            <input
              id="catalog-max-price"
              inputMode="numeric"
              min="0"
              onChange={(event) => update({ max_price: event.target.value || undefined })}
              placeholder="1 000"
              type="number"
              value={filters.max_price ?? ''}
            />
          </label>
        </div>

        <label className="temperature-filter" htmlFor="catalog-temperature">
          <input
            checked={filters.temp_sensitive === true}
            id="catalog-temperature"
            onChange={(event) => update({ temp_sensitive: event.target.checked || undefined })}
            type="checkbox"
          />
          <span>Требует бережной перевозки</span>
        </label>

        {hasFilters && (
          <button className="reset-filters" onClick={onReset} type="button">
            Сбросить фильтры
          </button>
        )}
      </div>
    </section>
  )
}
