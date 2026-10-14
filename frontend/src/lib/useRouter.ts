import { useContext } from 'react'

import { RouterContext } from './router-context'

export function useRouter() {
  const context = useContext(RouterContext)
  if (!context) {
    throw new Error('Компонент маршрутизации должен использоваться внутри RouterProvider.')
  }
  return context
}
