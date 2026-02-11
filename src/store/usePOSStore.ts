import { create } from 'zustand'
import type { CartItem } from '../types/pos.types'
import type { Customer } from '../types/database.types'

interface POSStore {
  cart: CartItem[]
  selectedCustomer: Customer | null
  paymentMethod: 'cash' | 'card' | 'credit' | 'mobile_money'
  amountPaid: number
  discount: number
  notes: string
  
  addToCart: (item: CartItem) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updatePrice: (productId: string, price: number) => void
  clearCart: () => void
  setSelectedCustomer: (customer: Customer | null) => void
  setPaymentMethod: (method: 'cash' | 'card' | 'credit' | 'mobile_money') => void
  setAmountPaid: (amount: number) => void
  setDiscount: (amount: number) => void
  setNotes: (notes: string) => void
  
  getSubtotal: () => number
  getTaxAmount: (taxRate: number) => number
  getTotal: (taxRate: number) => number
  getChange: (taxRate: number) => number
  currentShiftId: string | null
  setCurrentShiftId: (id: string | null) => void
}

export const usePOSStore = create<POSStore>((set, get) => ({
  cart: [],
  selectedCustomer: null,
  paymentMethod: 'cash',
  amountPaid: 0,
  discount: 0,
  notes: '',

  addToCart: (item) => {
    set((state) => {
      const existingItem = state.cart.find((i) => i.product_id === item.product_id)
      
      if (existingItem) {
        // Update quantity
        return {
          cart: state.cart.map((i) =>
            i.product_id === item.product_id
              ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
              : i
          ),
        }
      } else {
        // Add new item
        return {
          cart: [...state.cart, { ...item, quantity: 1, subtotal: item.price }],
        }
      }
    })
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter((item) => item.product_id !== productId),
    }))
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId)
      return
    }

    set((state) => ({
      cart: state.cart.map((item) =>
        item.product_id === productId
          ? { ...item, quantity, subtotal: quantity * item.price }
          : item
      ),
    }))
  },

  updatePrice: (productId, price) => {
    if (price < 0) return

    set((state) => ({
      cart: state.cart.map((item) =>
        item.product_id === productId
          ? { ...item, price, subtotal: item.quantity * price }
          : item
      ),
    }))
  },

  clearCart: () => {
    set({
      cart: [],
      selectedCustomer: null,
      paymentMethod: 'cash',
      amountPaid: 0,
      discount: 0,
      notes: '',
    })
  },

  setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
  setPaymentMethod: (method) => set({ paymentMethod: method }),
  setAmountPaid: (amount) => set({ amountPaid: amount }),
  setDiscount: (amount) => set({ discount: amount }),
  setNotes: (notes) => set({ notes }),

  getSubtotal: () => {
    return get().cart.reduce((sum, item) => sum + item.subtotal, 0)
  },

  getTaxAmount: (taxRate) => {
    const subtotal = get().getSubtotal()
    return (subtotal * taxRate) / 100
  },

  getTotal: (taxRate) => {
    const subtotal = get().getSubtotal()
    const tax = get().getTaxAmount(taxRate)
    const discount = get().discount
    return subtotal + tax - discount
  },

  getChange: (taxRate) => {
    const total = get().getTotal(taxRate)
    const paid = get().amountPaid
    return paid - total
  },
   currentShiftId: null,
  setCurrentShiftId: (id) => set({ currentShiftId: id }),
}))