import { type FormEvent, useEffect, useState } from 'react'

import {
  createAdminProduct,
  getAdminProducts,
  hideAdminProduct,
  updateAdminProduct,
  uploadAdminProductImage,
  productImageUrl,
  type AdminProduct,
  type AdminProductInput,
} from '../lib/api'

const emptyProduct: AdminProductInput = {
  region: 'yakutia',
  manufacturer: '',
  name: '',
  category: '',
  weight_g: 100,
  price_rub: '',
  temp_sensitive: false,
  shelf_life_days: 90,
  photo: null,
  description: '',
  is_active: true,
}

function formatPrice(value: string) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(Number(value))} ₽`
}

export function AdminProductsPage({ token, onUnauthorized }: { token: string; onUnauthorized: (error: unknown) => boolean }) {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [form, setForm] = useState<AdminProductInput | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    getAdminProducts(token)
      .then((items) => {
        if (!isCurrent) return
        setProducts(items)
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

  const changeForm = <Key extends keyof AdminProductInput>(key: Key, value: AdminProductInput[Key]) => {
    setForm((current) => current ? { ...current, [key]: value } : current)
    setFormError(null)
  }

  const openCreate = () => {
    setEditingId(null)
    setImageFile(null)
    setForm({ ...emptyProduct })
    setFormError(null)
  }

  const openEdit = (product: AdminProduct) => {
    setEditingId(product.id)
    setImageFile(null)
    setForm({
      region: product.region,
      manufacturer: product.manufacturer,
      name: product.name,
      category: product.category,
      weight_g: product.weight_g,
      price_rub: product.price_rub,
      temp_sensitive: product.temp_sensitive,
      shelf_life_days: product.shelf_life_days,
      photo: product.photo,
      description: product.description,
      is_active: product.is_active,
    })
    setFormError(null)
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form || isSaving) return
    setIsSaving(true)
    setFormError(null)
    try {
      const photo = imageFile ? (await uploadAdminProductImage(token, imageFile)).photo : form.photo
      const payload = { ...form, photo }
      const saved = editingId === null
        ? await createAdminProduct(token, payload)
        : await updateAdminProduct(token, editingId, payload)
      setProducts((current) => [saved, ...current.filter((product) => product.id !== saved.id)])
      setForm(null)
      setEditingId(null)
      setImageFile(null)
    } catch (error) {
      if (!onUnauthorized(error)) setFormError(error instanceof Error ? error.message : 'Не удалось сохранить товар.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleHide = async (product: AdminProduct) => {
    if (!window.confirm(`Скрыть «${product.name}» из каталога? Уже созданные заказы сохранятся.`)) return
    setActionError(null)
    try {
      const hidden = await hideAdminProduct(token, product.id)
      setProducts((current) => current.map((item) => item.id === hidden.id ? hidden : item))
    } catch (error) {
      if (!onUnauthorized(error)) setActionError(error instanceof Error ? error.message : 'Не удалось скрыть товар.')
    }
  }

  return (
    <section className="admin-section" aria-labelledby="admin-products-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="admin-products-title">Товары</h2>
          <p>Скрытые товары остаются в истории заказов, но исчезают из публичного каталога.</p>
        </div>
        <button className="primary-button" onClick={openCreate} type="button">Добавить товар</button>
      </div>

      {form && (
        <form className="admin-form" onSubmit={handleSave} aria-labelledby="admin-product-form-title">
          <h3 id="admin-product-form-title">{editingId === null ? 'Новый товар' : 'Изменить товар'}</h3>
          <div className="admin-form-grid">
            <label className="checkout-field" htmlFor="admin-product-region">
              <span>Регион</span>
              <select id="admin-product-region" value={form.region} onChange={(event) => changeForm('region', event.target.value as AdminProductInput['region'])}>
                <option value="yakutia">Якутия</option>
                <option value="dnr">Донбасс</option>
              </select>
            </label>
            <label className="checkout-field" htmlFor="admin-product-manufacturer">
              <span>Производитель</span>
              <input id="admin-product-manufacturer" maxLength={160} required value={form.manufacturer} onChange={(event) => changeForm('manufacturer', event.target.value)} />
            </label>
            <label className="checkout-field" htmlFor="admin-product-name">
              <span>Название</span>
              <input id="admin-product-name" maxLength={200} required value={form.name} onChange={(event) => changeForm('name', event.target.value)} />
            </label>
            <label className="checkout-field" htmlFor="admin-product-category">
              <span>Категория</span>
              <input id="admin-product-category" maxLength={120} required value={form.category} onChange={(event) => changeForm('category', event.target.value)} />
            </label>
            <label className="checkout-field" htmlFor="admin-product-weight">
              <span>Вес, г</span>
              <input id="admin-product-weight" min={1} required step={1} type="number" value={form.weight_g} onChange={(event) => changeForm('weight_g', Number(event.target.value))} />
            </label>
            <label className="checkout-field" htmlFor="admin-product-price">
              <span>Цена, ₽</span>
              <input id="admin-product-price" min="0.01" required step="0.01" type="number" value={form.price_rub} onChange={(event) => changeForm('price_rub', event.target.value)} />
            </label>
            <label className="checkout-field" htmlFor="admin-product-shelf-life">
              <span>Срок годности, дней</span>
              <input id="admin-product-shelf-life" min={1} required step={1} type="number" value={form.shelf_life_days} onChange={(event) => changeForm('shelf_life_days', Number(event.target.value))} />
            </label>
            <label className="checkout-field" htmlFor="admin-product-photo">
              <span>Фото товара <em>необязательно, JPEG / PNG / WebP до 5 МБ</em></span>
              <input
                accept="image/jpeg,image/png,image/webp"
                id="admin-product-photo"
                onChange={(event) => { setImageFile(event.target.files?.[0] ?? null); setFormError(null) }}
                type="file"
              />
            </label>
            {form.photo && (
              <div className="admin-image-preview">
                <img src={productImageUrl(form.photo)} alt="Текущее фото товара" />
                <span>Текущее фото</span>
              </div>
            )}
            {imageFile && <p className="admin-selected-image">Выбран файл: {imageFile.name}</p>}
            <label className="checkout-field admin-form-wide" htmlFor="admin-product-description">
              <span>Описание</span>
              <textarea id="admin-product-description" maxLength={4000} required rows={3} value={form.description} onChange={(event) => changeForm('description', event.target.value)} />
            </label>
          </div>
          <label className="checkout-checkbox" htmlFor="admin-product-sensitive">
            <input checked={form.temp_sensitive} id="admin-product-sensitive" onChange={(event) => changeForm('temp_sensitive', event.target.checked)} type="checkbox" />
            <span>Чувствителен к температуре</span>
          </label>
          <label className="checkout-checkbox" htmlFor="admin-product-active">
            <input checked={form.is_active} id="admin-product-active" onChange={(event) => changeForm('is_active', event.target.checked)} type="checkbox" />
            <span>Показывать в каталоге</span>
          </label>
          {formError && <p className="checkout-validation" role="alert">{formError}</p>}
          <div className="admin-actions">
            <button className="primary-button" disabled={isSaving} type="submit">{isSaving ? 'Сохраняем…' : 'Сохранить товар'}</button>
            <button className="admin-text-button" onClick={() => { setForm(null); setImageFile(null) }} type="button">Отмена</button>
          </div>
        </form>
      )}

      {isLoading && <p className="admin-message" aria-live="polite">Загружаем товары…</p>}
      {loadError && (
        <div className="admin-message" role="alert"><p>{loadError}</p><button className="admin-text-button" onClick={() => { setIsLoading(true); setRetry((value) => value + 1) }} type="button">Повторить</button></div>
      )}
      {actionError && <p className="checkout-validation" role="alert">{actionError}</p>}
      {!isLoading && !loadError && products.length === 0 && <p className="admin-message">Товаров пока нет. Добавьте первый товар.</p>}
      {!isLoading && !loadError && products.length > 0 && (
        <div className="admin-table-wrap" role="region" aria-label="Список товаров" tabIndex={0}>
          <table className="admin-table">
            <thead><tr><th scope="col">Название</th><th scope="col">Регион</th><th scope="col">Цена</th><th scope="col">Показ</th><th scope="col">Действия</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td data-label="Название"><strong>{product.name}</strong><small>{product.manufacturer} · {product.weight_g} г</small></td>
                  <td data-label="Регион">{product.region === 'yakutia' ? 'Якутия' : 'Донбасс'}</td>
                  <td data-label="Цена">{formatPrice(product.price_rub)}</td>
                  <td data-label="Показ">{product.is_active ? 'В каталоге' : 'Скрыт'}</td>
                  <td data-label="Действия">
                    <div className="admin-row-actions">
                      <button className="admin-text-button" onClick={() => openEdit(product)} type="button">Изменить</button>
                      {product.is_active && <button className="admin-text-button" onClick={() => handleHide(product)} type="button">Скрыть</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
