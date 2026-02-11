export interface CartItem {
  product_id: string
  product_name: string
  sku: string
  price: number
  quantity: number
  subtotal: number
  stock_available: number
}

export interface SuspendedOrder {
  id: string
  items: CartItem[]
  subtotal: number
  customer_id?: string
  notes?: string
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  credit_limit: number
  outstanding_balance: number
}