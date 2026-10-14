import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react'

import { ApiRequestError, getProduct, type Product } from './api'
import { CartContext, type AddToCartResult, type CartItem } from './cart-context'

const STORAGE_KEY = 'sweet-bridge-cart'

type StoredCartItem = {
  productId: number
  quantity: number
}

function readStoredCart(): StoredCartItem[] {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) return []
    const parsedValue: unknown = JSON.parse(rawValue)
    if (!Array.isArray(parsedValue)) return []
    const quantities = new Map<number, number>()
    for (const item of parsedValue) {
      if (
        typeof item !== 'object' || item === null ||
        !Number.isSafeInteger(item.productId) || item.productId <= 0 ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0
      ) continue
      quantities.set(item.productId, Math.min((quantities.get(item.productId) ?? 0) + item.quantity, 1000))
    }
    return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity })).slice(0, 50)
  } catch {
    return []
  }
}

function persistCart(items: CartItem[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(
      items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
    ))
  } catch {
    // Storage can be disabled by the browser; the in-memory cart remains usable.
  }
}

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)
  const [hydrationError, setHydrationError] = useState<string | null>(null)
  const [hydrationVersion, setHydrationVersion] = useState(0)

  useEffect(() => {
    let isCurrent = true
    const storedItems = readStoredCart()
    Promise.all(storedItems.map(async (storedItem) => {
      try {
        const product = await getProduct(String(storedItem.productId))
        return { product, quantity: storedItem.quantity }
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) return null
        throw error
      }
    })).then((restoredItems) => {
      if (!isCurrent) return
      const availableItems = restoredItems.filter((item): item is CartItem => item !== null)
      const originRegion = availableItems[0]?.product.region
      setItems(availableItems.filter((item) => item.product.region === originRegion))
      setHydrationError(null)
      setIsHydrated(true)
    }).catch(() => {
      if (isCurrent) setHydrationError('Не удалось восстановить корзину. Сохранённые позиции не удалены.')
    })
    return () => { isCurrent = false }
  }, [hydrationVersion])

  useEffect(() => {
    if (isHydrated) persistCart(items)
  }, [isHydrated, items])

  const retryHydration = useCallback(() => {
    setHydrationError(null)
    setHydrationVersion((current) => current + 1)
  }, [])

  const addProduct = useCallback((product: Product): AddToCartResult => {
    if (!isHydrated) return 'not-ready'
    if (items.some((item) => item.product.region !== product.region)) return 'region-conflict'
    setItems((currentItems) => {
      if (currentItems.some((item) => item.product.region !== product.region)) return currentItems
      const existingItem = currentItems.find((item) => item.product.id === product.id)
      if (existingItem) return currentItems.map((item) => item.product.id === product.id
        ? { ...item, quantity: Math.min(item.quantity + 1, 1000) } : item)
      return [...currentItems, { product, quantity: 1 }]
    })
    return 'added'
  }, [isHydrated, items])

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (!Number.isSafeInteger(quantity)) return
    setItems((currentItems) => currentItems.flatMap((item) => {
      if (item.product.id !== productId) return [item]
      if (quantity <= 0) return []
      return [{ ...item, quantity: Math.min(quantity, 1000) }]
    }))
  }, [])

  const removeProduct = useCallback((productId: number) => {
    setItems((currentItems) => currentItems.filter((item) => item.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    persistCart([])
    setItems([])
  }, [])
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const value = useMemo(() => ({
    items, itemCount, isHydrated, hydrationError, retryHydration,
    addProduct, updateQuantity, removeProduct, clearCart,
  }), [addProduct, clearCart, hydrationError, isHydrated, itemCount, items, removeProduct, retryHydration, updateQuantity])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
