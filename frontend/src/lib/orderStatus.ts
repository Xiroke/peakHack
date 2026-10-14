import type { OrderStatus } from './api'

export const orderStatusLabels: Record<OrderStatus, string> = {
  accepted: 'Принят',
  assembling: 'В сборке',
  in_transit: 'В пути',
  pickup_point: 'На пункте выдачи',
  received: 'Получен',
}

export const orderStatusSequence: OrderStatus[] = [
  'accepted', 'assembling', 'in_transit', 'pickup_point', 'received',
]
