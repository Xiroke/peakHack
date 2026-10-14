import { createContext } from 'react'

import type { Product } from './api'

export type CartItem = {
  product: Product
  quantity: number
}

export type AddToCartResult = 'added' | 'region-conflict' | 'not-ready'

export type CartContextValue = {
  items: CartItem[]
  itemCount: number
  isHydrated: boolean
  hydrationError: string | null
  retryHydration: () => void
  addProduct: (product: Product) => AddToCartResult
  updateQuantity: (productId: number, quantity: number) => void
  removeProduct: (productId: number) => void
  clearCart: () => void
}

export const CartContext = createContext<CartContextValue | null>(null)
