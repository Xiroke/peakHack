import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import './index.css'
import { CartProvider } from './lib/cart'
import { RouterProvider } from './lib/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <RouterProvider>
        <App />
      </RouterProvider>
    </CartProvider>
  </StrictMode>,
)
