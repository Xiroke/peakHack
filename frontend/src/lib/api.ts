const apiUrl = import.meta.env.VITE_API_URL ?? window.location.origin

export function productImageUrl(path: string) {
  return path.startsWith('http') ? path : `${apiUrl}${path}`
}

export type Region = 'yakutia' | 'dnr'
export type WaveDirection = 'yakutia_to_dnr' | 'dnr_to_yakutia'
export type WaveStatus = 'open' | 'closed' | 'dispatched' | 'completed'
export type OrderStatus = 'accepted' | 'assembling' | 'in_transit' | 'pickup_point' | 'received'

export type Product = {
  id: number
  region: Region
  manufacturer: string
  name: string
  category: string
  weight_g: number
  price_rub: string
  temp_sensitive: boolean
  shelf_life_days: number
  photo: string | null
  description: string
}

export type ProductMeta = {
  categories: string[]
  manufacturers: string[]
}

export type ProductFilters = {
  region?: Region
  category?: string
  manufacturer?: string
  search?: string
  temp_sensitive?: boolean
  min_price?: string
  max_price?: string
}

export type Wave = {
  id: number
  direction: WaveDirection
  dispatch_date: string
  order_deadline: string
  min_weight_kg: number
  max_weight_kg: number
  status: WaveStatus
  current_weight_kg: string
  current_fill_percent: string
  remaining_weight_kg: string
}

export type DeliveryLine = {
  product_id: number
  quantity: number
}

export type ThermalPackaging = {
  has_temp_sensitive_products: boolean
  available: boolean
  required: boolean
  applied: boolean
  cost_rub: string
  notice: string | null
}

export type DeliveryEstimate = {
  wave_id: number
  direction: WaveDirection
  dispatch_date: string
  order_deadline: string
  delivery_min_days: number
  delivery_max_days: number
  expected_delivery_from: string
  expected_delivery_to: string
  thermal_packaging: ThermalPackaging
  order_weight_kg: string
  current_weight_kg: string
  projected_weight_kg: string
  current_fill_percent: string
  projected_fill_percent: string
  remaining_weight_kg: string
  base_rate_rub_per_kg: string
  applied_rate_rub_per_kg: string
  discount_percent: number
  shipping_cost_rub: string
  products_total_rub: string
  total_rub: string
  explanation: string
}

export type OrderItem = {
  product_id: number
  name: string
  manufacturer: string
  quantity: number
  unit_price_rub: string
  weight_g: number
}

export type Order = {
  public_id: string
  status: OrderStatus
  is_gift: boolean
  wave: {
    id: number
    direction: WaveDirection
    dispatch_date: string
    order_deadline: string
  }
  items: OrderItem[]
  delivery_min_days: number
  delivery_max_days: number
  expected_delivery_from: string
  expected_delivery_to: string
  thermal_packaging: ThermalPackaging
  products_total_rub: string
  shipping_cost_rub: string
  thermal_packaging_cost_rub: string
  total_rub: string
  created_at: string
}

export type CreateOrderPayload = {
  wave_id: number
  items: DeliveryLine[]
  recipient_region: Region
  recipient_name: string
  recipient_phone: string
  recipient_address: string
  is_gift: boolean
  card_message?: string
  thermal_packaging_requested: boolean
}

export type TrackingOrder = {
  public_id: string
  status: OrderStatus
  stages: { status: OrderStatus; state: 'completed' | 'current' | 'upcoming' }[]
  is_gift: boolean
  dispatch_date: string
  items: { name: string; quantity: number; unit_price_rub: string }[]
  delivery_min_days: number
  delivery_max_days: number
  expected_delivery_from: string
  expected_delivery_to: string
  thermal_packaging: ThermalPackaging
  total_rub: string
}

export type AdminProduct = Product & { is_active: boolean }
export type AdminProductInput = Omit<AdminProduct, 'id'>

export type AdminWave = Wave & {
  order_count: number
  orders_total_rub: string
  current_rate_rub_per_kg: string
}
export type AdminWaveInput = Pick<Wave, 'direction' | 'dispatch_date' | 'order_deadline' | 'min_weight_kg' | 'max_weight_kg'>

export type AdminOrder = Order & {
  id: number
  recipient_region: Region
  recipient_name: string
  recipient_phone: string
  recipient_address: string
  card_message: string | null
}

export type AdminOrderFilters = {
  status?: OrderStatus
  direction?: WaveDirection
  wave_id?: number
}

export class ApiRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, options)
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null
    throw new ApiRequestError(payload?.error?.message ?? 'Сервис временно недоступен.', response.status)
  }

  return response.json() as Promise<T>
}

function toSearchParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  return params
}

export function getProducts(filters: ProductFilters): Promise<Product[]> {
  const query = toSearchParams(filters).toString()
  return request<Product[]>(`/api/products${query ? `?${query}` : ''}`)
}

export function getProduct(productId: string): Promise<Product> {
  return request<Product>(`/api/products/${encodeURIComponent(productId)}`)
}

export function getProductMeta(region: Region): Promise<ProductMeta> {
  return request<ProductMeta>(`/api/products/meta?region=${region}`)
}

export function getWaves(direction: WaveDirection): Promise<Wave[]> {
  return request<Wave[]>(`/api/waves?direction=${direction}`)
}

export function getDeliveryEstimate(payload: {
  wave_id: number
  recipient_region: Region
  items: DeliveryLine[]
  thermal_packaging_requested: boolean
}): Promise<DeliveryEstimate> {
  return request<DeliveryEstimate>('/api/delivery-estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function createOrder(payload: CreateOrderPayload, idempotencyKey: string): Promise<Order> {
  return request<Order>('/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(payload),
  })
}

export function getOrder(publicOrderId: string): Promise<Order> {
  return request<Order>(`/api/orders/${encodeURIComponent(publicOrderId)}`)
}

export function getOrderTracking(publicOrderId: string): Promise<TrackingOrder> {
  return request<TrackingOrder>(`/api/orders/${encodeURIComponent(publicOrderId)}/tracking`)
}

function adminRequest<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return request<T>(`/api/admin${path}`, { ...options, headers })
}

function adminWrite<T>(token: string, path: string, method: string, payload: object): Promise<T> {
  return adminRequest<T>(token, path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function verifyAdminToken(token: string): Promise<{ status: 'ok' }> {
  return adminRequest(token, '/session')
}

export function getAdminProducts(token: string): Promise<AdminProduct[]> {
  return adminRequest(token, '/products')
}

export function uploadAdminProductImage(token: string, file: File): Promise<{ photo: string }> {
  const data = new FormData()
  data.set('file', file)
  return adminRequest(token, '/product-images', { method: 'POST', body: data })
}

export function createAdminProduct(token: string, payload: AdminProductInput): Promise<AdminProduct> {
  return adminWrite(token, '/products', 'POST', payload)
}

export function updateAdminProduct(token: string, productId: number, payload: AdminProductInput): Promise<AdminProduct> {
  return adminWrite(token, `/products/${productId}`, 'PUT', payload)
}

export function hideAdminProduct(token: string, productId: number): Promise<AdminProduct> {
  return adminRequest(token, `/products/${productId}`, { method: 'DELETE' })
}

export function getAdminWaves(token: string): Promise<AdminWave[]> {
  return adminRequest(token, '/waves')
}

export function createAdminWave(token: string, payload: AdminWaveInput): Promise<AdminWave> {
  return adminWrite(token, '/waves', 'POST', payload)
}

export function getAdminOrders(token: string, filters: AdminOrderFilters = {}): Promise<AdminOrder[]> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const query = params.toString()
  return adminRequest(token, `/orders${query ? `?${query}` : ''}`)
}

export function getAdminOrder(token: string, orderId: number): Promise<AdminOrder> {
  return adminRequest(token, `/orders/${orderId}`)
}

export function updateAdminOrderStatus(token: string, orderId: number, status: OrderStatus): Promise<AdminOrder> {
  return adminWrite(token, `/orders/${orderId}/status`, 'PATCH', { status })
}
