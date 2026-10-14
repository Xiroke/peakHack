import type { PropsWithChildren } from 'react'

import { Header } from './Header'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <Header />
      <main>{children}</main>
      <footer className="site-footer">
        <div className="page-container site-footer__content">
          <span>Сладкий мост</span>
          <span>Якутия ⇄ Донбасс</span>
        </div>
      </footer>
    </div>
  )
}
