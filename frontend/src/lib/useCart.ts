import { useContext } from 'react'

import { CartContext } from './cart-context'

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('Корзина должна использоваться внутри CartProvider.')
  }
  return context
}
