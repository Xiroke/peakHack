import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { RouterContext, type LocationState } from './router-context'
import { useRouter } from './useRouter'

function getLocationState(): LocationState {
  return { pathname: window.location.pathname, search: window.location.search }
}

export function RouterProvider({ children }: PropsWithChildren) {
  const [location, setLocation] = useState(getLocationState)

  useEffect(() => {
    const handlePopState = () => setLocation(getLocationState())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to)
    setLocation(getLocationState())
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const value = useMemo(() => ({ ...location, navigate }), [location, navigate])

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

type AppLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string
}

export function AppLink({ to, onClick, ...props }: AppLinkProps) {
  const { navigate } = useRouter()

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey ||
      props.target === '_blank'
    ) {
      return
    }

    event.preventDefault()
    navigate(to)
  }

  return <a {...props} href={to} onClick={handleClick} />
}
