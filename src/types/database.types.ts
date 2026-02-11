export type UserRole = 'owner' | 'admin' | 'accountant' | 'cashier'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  sku: string
  barcode?: string
  category_id: string
  price: number
  cost: number
  stock_quantity: number
  low_stock_threshold: number
  description?: string
  image_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  description?: string
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone?: string
  email?: string
  address?: string
  credit_limit: number
  outstanding_balance: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface Sale {
  id: string
  sale_number: string
  cashier_id: string
  customer_id?: string
  subtotal: number
  tax_amount: number
  discount_amount: number
  total: number
  payment_method: 'cash' | 'card' | 'credit' | 'mobile_money'
  amount_paid: number
  change_amount: number
  notes?: string
  created_at: string
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export interface SuspendedOrder {
  id: string
  cashier_id: string
  customer_id?: string
  items: any[]
  subtotal: number
  notes?: string
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_person?: string
  phone?: string
  email?: string
  address?: string
  outstanding_debt: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface StoreSettings {
  id: string
  store_name: string
  address?: string
  phone?: string
  email?: string
  tax_rate: number
  currency: string
  low_stock_threshold: number
  receipt_footer?: string
  created_at: string
  updated_at: string
}