import { createContext } from 'react'

export type LocationState = {
  pathname: string
  search: string
}

export type RouterContextValue = LocationState & {
  navigate: (to: string) => void
}

export const RouterContext = createContext<RouterContextValue | null>(null)
