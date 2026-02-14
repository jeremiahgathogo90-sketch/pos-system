import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { useAuthContext } from '../contexts/AuthContext'
import { usePOSStore } from '../store/usePOSStore'
import { 
  Search, X, UserPlus, Clock, CreditCard, Banknote, 
  Building2, Grid3x3, Package, Receipt, Eye, LogOut
} from 'lucide-react'
import ShiftModal from '../components/features/shifts/ShiftModal'
import SplitPaymentModal from '../components/features/payments/SplitPaymentModal'
import ReceiptModal from '../components/features/receipts/ReceiptModal'
import toast from 'react-hot-toast'

interface PaymentMethod {
  type: 'cash' | 'card' | 'credit'
  amount: number
}

export default function POSPage() {
  const queryClient = useQueryClient()
  const { user, profile } = useAuthContext()
  const { 
    cart, 
    clearCart, 
    selectedCustomer, 
    setSelectedCustomer, 
    updateQuantity, 
    updatePrice, 
    removeFromCart, 
    getSubtotal,
    currentShiftId,
    setCurrentShiftId
  } = usePOSStore()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showAddCustomer, setShowAddCustomer] = useState(false)
  const [showSuspendedOrders, setShowSuspendedOrders] = useState(false)
  const [showCreditSales, setShowCreditSales] = useState(false)
  const [showRecentTransactions, setShowRecentTransactions] = useState(false)
  const [showShiftModal, setShowShiftModal] = useState(false)
  const [showSplitPayment, setShowSplitPayment] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const [lastSale, setLastSale] = useState<any>(null)
  
  const [discount, setDiscount] = useState(0)
  const [receiptData, setReceiptData] = useState<any>(null)

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
  })

  const [taxRate] = useState(0) // You can make this dynamic by fetching from store settings if needed

  // Check for open shift on mount — use session directly so we don't
  // depend on React context hydration timing
  useEffect(() => {
    const checkShift = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? user?.id
      if (!uid) return

      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('cashier_shifts')
        .select('id')
        .eq('cashier_id', uid)
        .eq('shift_date', today)
        .eq('status', 'open')
        .maybeSingle()   // won't error if no row found
      
      if (data?.id) {
        setCurrentShiftId(data.id)
      } else {
        setShowShiftModal(true)
      }
    }
    
    checkShift()
  }, [user?.id])

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch customers
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch suspended orders
  const { data: suspendedOrders } = useQuery({
    queryKey: ['suspended-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suspended_orders')
        .select('*')
        .eq('cashier_id', user?.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Fetch today's credit sales
  const { data: creditSales } = useQuery({
    queryKey: ['credit-sales', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('sales')
        .select('*, customers(name)')
        .eq('cashier_id', user?.id)
        .gte('created_at', today)
        .or('payment_method.eq.credit,credit_amount.gt.0')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // Fetch recent transactions
  const { data: recentTransactions } = useQuery({
    queryKey: ['recent-transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .eq('cashier_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
  })

  // Fetch cashier profile directly from DB — always up to date
  const { data: cashierProfile } = useQuery({
    queryKey: ['cashier-profile', user?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? user?.id
      if (!uid) return null
      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, email')
        .eq('id', uid)
        .single()
      return data
    },
    enabled: !!user?.id,
  })

  // Fetch ALL cashier transactions (all time) for history view
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const { data: allTransactions } = useQuery({
    queryKey: ['all-transactions', user?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id ?? user?.id
      if (!uid) return []
      const { data } = await supabase
        .from('sales')
        .select('*, customers(name), sale_items(product_name, quantity, unit_price, subtotal)')
        .eq('cashier_id', uid)
        .order('created_at', { ascending: false })
        .limit(200)
      return data || []
    },
    enabled: showAllTransactions,
  })

  // Fetch store info
  const { data: storeInfo } = useQuery({
    queryKey: ['store-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .single()
      if (error) throw error
      return data
    },
  })

  // Add customer mutation
  const addCustomer = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: newCustomer.name,
          phone: newCustomer.phone || null,
          email: newCustomer.email || null,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success('Customer added!')
      setSelectedCustomer(data)
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setShowAddCustomer(false)
      setNewCustomer({ name: '', phone: '', email: '' })
    },
  })

  // Suspend order mutation
  const suspendOrder = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error('Cart is empty')
      const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
      const { error } = await supabase
        .from('suspended_orders')
        .insert({
          cashier_id: user?.id,
          customer_id: selectedCustomer?.id || null,
          items: cart,
          subtotal,
        })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Order suspended')
      clearCart()
      queryClient.invalidateQueries({ queryKey: ['suspended-orders'] })
    },
  })

  // Resume order mutation
  const resumeOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const order = suspendedOrders?.find((o) => o.id === orderId)
      if (!order) throw new Error('Order not found')

      const { error } = await supabase
        .from('suspended_orders')
        .delete()
        .eq('id', orderId)
      if (error) throw error
      return order
    },
    onSuccess: (order) => {
      usePOSStore.setState({ cart: order.items })
      if (order.customer_id) {
        supabase
          .from('customers')
          .select('*')
          .eq('id', order.customer_id)
          .single()
          .then(({ data }) => {
            if (data) setSelectedCustomer(data)
          })
      }
      toast.success('Order resumed')
      queryClient.invalidateQueries({ queryKey: ['suspended-orders'] })
      setShowSuspendedOrders(false)
    },
  })

  // Complete sale mutation with split payment support
  const completeSale = useMutation({
    mutationFn: async (payments: PaymentMethod[]) => {
      if (cart.length === 0) throw new Error('Cart is empty')
      if (!currentShiftId) throw new Error('No active shift. Please open a shift first.')

      // Always get fresh session — never rely on stale context user
      const { data: { session } } = await supabase.auth.getSession()
      const cashierId = session?.user?.id ?? user?.id
      if (!cashierId) throw new Error('Not logged in. Please refresh and try again.')

      // Calculate payment amounts
      const cashAmount = payments.filter(p => p.type === 'cash').reduce((sum, p) => sum + p.amount, 0)
      const cardAmount = payments.filter(p => p.type === 'card').reduce((sum, p) => sum + p.amount, 0)
      const creditAmount = payments.filter(p => p.type === 'credit').reduce((sum, p) => sum + p.amount, 0)

      const saleNumber = `SALE-${Date.now()}`
      const subtotal = getSubtotal()
      const tax = (subtotal * taxRate) / 100
      const total = subtotal + tax - discount

      // Verify payment covers total
      const totalPaid = cashAmount + cardAmount + creditAmount
      if (totalPaid < total) {
        throw new Error('Payment amount is less than total')
      }

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_number: saleNumber,
          cashier_id: cashierId,
          customer_id: selectedCustomer?.id || null,
          shift_id: currentShiftId,
          subtotal,
          tax_amount: tax,
          discount_amount: discount,
          total,
          cash_amount: cashAmount,
          card_amount: cardAmount,
          credit_amount: creditAmount,
          payment_method: payments.length === 1 ? payments[0].type : 'multiple',
          amount_paid: totalPaid,
          change_amount: cashAmount > 0 ? (totalPaid - total) : 0,
        })
        .select()
        .single()

      if (saleError) throw saleError

      // Create sale items
      const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.subtotal,
      }))

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)

      if (itemsError) throw itemsError

      // Auto-deduct stock
      for (const item of cart) {
        const { error: stockError } = await supabase.rpc('decrement_stock', {
          product_id: item.product_id,
          quantity_to_subtract: item.quantity,
        })

        // Fallback if RPC doesn't exist
        if (stockError) {
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single()

          await supabase
            .from('products')
            .update({ stock_quantity: (product?.stock_quantity || 0) - item.quantity })
            .eq('id', item.product_id)
        }
      }

      // Update customer balance if credit used
      if (creditAmount > 0 && selectedCustomer) {
        await supabase.rpc('increase_customer_balance', {
          p_customer_id: selectedCustomer.id,
          p_amount: creditAmount,
        })
      }

      return sale
    },
    onSuccess: (sale) => {
      // Capture all receipt data NOW before cart is cleared
      const saleSubtotal = getSubtotal()
      const saleTax = (saleSubtotal * taxRate) / 100
      const saleTotal = saleSubtotal + saleTax - discount

      setReceiptData({
        sale_number: sale.sale_number,
        cashier_name: profile?.full_name || 'Cashier',
        customer_name: selectedCustomer?.name || undefined,
        items: cart.map(item => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.price) || 0,
          subtotal: Number(item.subtotal) || 0,
        })),
        subtotal: Number(saleSubtotal) || 0,
        tax_amount: Number(saleTax) || 0,
        discount_amount: Number(discount) || 0,
        total: Number(saleTotal) || 0,
        cash_amount: Number(sale.cash_amount) || 0,
        card_amount: Number(sale.card_amount) || 0,
        credit_amount: Number(sale.credit_amount) || 0,
        change_amount: Number(sale.change_amount) || 0,
        created_at: sale.created_at,
      })

      toast.success('Sale completed successfully!')
      setLastSale(sale)
      setShowReceipt(true)
      setShowSplitPayment(false)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['current-shift'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to complete sale')
    },
  })

  const addToCart = (product: any) => {
    if (product.stock_quantity <= 0) {
      toast.error('Out of stock!')
      return
    }
    usePOSStore.getState().addToCart({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      price: Number(product.price),
      quantity: 1,
      subtotal: Number(product.price),
      stock_available: product.stock_quantity,
    })
    toast.success('Added to cart')
  }

  // Filter products
  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`

  const subtotal = getSubtotal()
  const tax = (subtotal * taxRate) / 100
  const total = subtotal + tax - discount

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <select className="px-3 py-1.5 border rounded-lg text-sm font-medium">
            <option>{storeInfo?.store_name || 'Store Name'}</option>
          </select>
          <div className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium">
            📅 {new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className="text-gray-600">Cashier: </span>
            <span className="font-semibold text-blue-700">{cashierProfile?.full_name || profile?.full_name || 'Loading...'}</span>
            {currentShiftId && (
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">SHIFT ACTIVE</span>
            )}
          </div>
          <button
            onClick={() => setShowShiftModal(true)}
            className="p-2 hover:bg-gray-100 rounded transition"
            title="Manage Shift"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Cart (70%) */}
        <div className="w-[70%] bg-white border-r flex flex-col">
          {/* Customer & Search */}
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center gap-2">
              <select
                value={selectedCustomer?.id || ''}
                onChange={(e) => {
                  const customer = customers?.find(c => c.id === e.target.value)
                  setSelectedCustomer(customer || null)
                }}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Walk-In Customer</option>
                {customers?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={() => setShowAddCustomer(true)}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                title="Add Customer"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter Product name / SKU / Scan bar code"
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Cart Items Table */}
          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Cart is empty</p>
                  <p className="text-sm">Add products to get started</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Product</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">Quantity</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Price inc. tax</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Subtotal</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item) => (
                    <tr key={item.product_id} className="border-b hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                        <div className="text-xs text-gray-500">{item.sku}</div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1.5 border rounded text-center focus:ring-2 focus:ring-blue-500"
                          min="1"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updatePrice(item.product_id, parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1.5 border rounded text-right focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Summary */}
          <div className="border-t bg-gray-50 p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Items: <span className="font-semibold text-gray-900">{cart.reduce((sum, item) => sum + item.quantity, 0)}</span></span>
              <span className="text-2xl font-bold text-gray-900">Total: {formatCurrency(total)}</span>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Discount (KES)</label>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Products (30%) */}
        <div className="w-[30%] flex flex-col bg-gray-50">
          {/* Category Tabs */}
          <div className="p-3 bg-white border-b space-y-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`w-full px-4 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 ${!selectedCategory ? 'bg-blue-500 text-white shadow' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              <Grid3x3 className="w-4 h-4" />
              All Categories
            </button>
            <div className="grid grid-cols-1 gap-2">
              {categories?.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${selectedCategory === cat.id ? 'bg-blue-500 text-white shadow' : 'bg-white hover:bg-gray-100 border'}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 p-3 overflow-y-auto">
            <div className="grid grid-cols-1 gap-3">
              {filteredProducts?.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="bg-white rounded-lg shadow hover:shadow-md transition p-3 text-left border hover:border-blue-300"
                >
                  <div className="flex gap-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <Package className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-0.5">{product.sku}</div>
                      <h3 className="font-medium text-sm line-clamp-2 mb-1">{product.name}</h3>
                      <div className="flex justify-between items-center">
                        <p className="text-base font-bold text-blue-600">
                          {formatCurrency(Number(product.price))}
                        </p>
                        <p className={`text-xs ${product.stock_quantity <= product.low_stock_threshold ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          {product.stock_quantity} in stock
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Payment Bar */}
      <div className="bg-white border-t px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex gap-2">
          <button
            onClick={() => suspendOrder.mutate()}
            disabled={cart.length === 0}
            className="px-4 py-2.5 border-2 border-yellow-500 text-yellow-700 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition flex items-center gap-2 disabled:opacity-50 font-medium"
          >
            <Clock className="w-4 h-4" />
            Suspend ({suspendedOrders?.length || 0})
          </button>
          
          <button
            onClick={() => setShowSuspendedOrders(true)}
            className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 transition flex items-center gap-2 font-medium"
          >
            <Eye className="w-4 h-4" />
            View Held
          </button>
          
          <button
            onClick={() => setShowCreditSales(true)}
            className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 transition flex items-center gap-2 font-medium"
          >
            <CreditCard className="w-4 h-4" />
            Credits ({creditSales?.length || 0})
          </button>
          
          <button
            onClick={() => {
              if (!currentShiftId) {
                toast.error('Please open a shift first')
                setShowShiftModal(true)
                return
              }
              setShowSplitPayment(true)
            }}
            disabled={cart.length === 0}
            className="px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition flex items-center gap-2 font-medium disabled:opacity-50"
          >
            <Banknote className="w-4 h-4" />
            Multiple Pay
          </button>
          
          <button
            onClick={() => {
              clearCart()
              setDiscount(0)
            }}
            className="px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition font-medium"
          >
            Cancel
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-sm text-gray-600">Total Payable:</div>
            <div className="text-4xl font-bold text-gray-900">{formatCurrency(total)}</div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowAllTransactions(true)}
              className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-semibold flex items-center gap-2 shadow-lg"
            >
              <Building2 className="w-5 h-5" />
              My History
            </button>
            <button
              onClick={() => setShowRecentTransactions(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg flex items-center gap-2 shadow-lg"
            >
              <Receipt className="w-5 h-5" />
              Recent
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      
      {/* Shift Modal */}
      <ShiftModal
        isOpen={showShiftModal}
        onClose={() => {
          if (!currentShiftId) {
            toast.error('You must open a shift to use POS')
          } else {
            setShowShiftModal(false)
          }
        }}
        onShiftOpened={(shiftId) => setCurrentShiftId(shiftId)}
      />

      {/* Split Payment Modal */}
      <SplitPaymentModal
        isOpen={showSplitPayment}
        onClose={() => setShowSplitPayment(false)}
        totalAmount={total}
        hasCustomer={!!selectedCustomer}
        onConfirm={(payments) => completeSale.mutate(payments)}
        isPending={completeSale.isPending}
      />

      {/* Receipt Modal */}
      {receiptData && (
        <ReceiptModal
          isOpen={showReceipt}
          onClose={() => setShowReceipt(false)}
          onNewSale={() => {
            clearCart()
            setDiscount(0)
            setSelectedCustomer(null)
            setReceiptData(null)
            setLastSale(null)
            setShowReceipt(false)
          }}
          saleData={receiptData}
          storeInfo={storeInfo}
          autoPrint={true}
        />
      )}

      {/* Suspended Orders Modal */}
      {showSuspendedOrders && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">Suspended Orders</h2>
              <button onClick={() => setShowSuspendedOrders(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {suspendedOrders?.map((order) => (
                <div key={order.id} className="border-2 rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                      <p className="text-sm font-medium text-gray-700 mt-1">
                        {order.items.length} items • {formatCurrency(order.subtotal)}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => resumeOrder.mutate(order.id)}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                    >
                      Resume
                    </button>
                  </div>
                </div>
              ))}

              {suspendedOrders?.length === 0 && (
                <p className="text-center text-gray-500 py-12">No suspended orders</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Credit Sales Modal */}
      {showCreditSales && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">Today's Credit Sales</h2>
              <button onClick={() => setShowCreditSales(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Sale #</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {creditSales?.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{sale.sale_number}</td>
                      <td className="px-4 py-3">{sale.customers?.name || 'Walk-in'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">
                        {formatCurrency(Number(sale.credit_amount || sale.total))}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(sale.created_at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {creditSales?.length === 0 && (
                <p className="text-center text-gray-500 py-12">No credit sales today</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions Modal */}
      {showRecentTransactions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">Recent Transactions (Last 10)</h2>
              <button onClick={() => setShowRecentTransactions(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">Sale #</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-left">Payment</th>
                    <th className="px-4 py-3 text-left">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentTransactions?.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{sale.sale_number}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        {formatCurrency(Number(sale.total))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {Number(sale.cash_amount) > 0 && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                              Cash
                            </span>
                          )}
                          {Number(sale.card_amount) > 0 && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                              Card
                            </span>
                          )}
                          {Number(sale.credit_amount) > 0 && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                              Credit
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(sale.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {recentTransactions?.length === 0 && (
                <p className="text-center text-gray-500 py-12">No recent transactions</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── My Transaction History Modal ── */}
      {showAllTransactions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-xl">
              <div>
                <h2 className="text-xl font-bold">My Transaction History</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  All sales by {cashierProfile?.full_name || profile?.full_name} · {allTransactions?.length || 0} total
                </p>
              </div>
              <button onClick={() => setShowAllTransactions(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Stats strip */}
            {allTransactions && allTransactions.length > 0 && (() => {
              const totalRev   = allTransactions.reduce((s, x) => s + Number(x.total || 0), 0)
              const totalCash  = allTransactions.reduce((s, x) => s + Number(x.cash_amount || 0), 0)
              const totalCard  = allTransactions.reduce((s, x) => s + Number(x.card_amount || 0), 0)
              const totalCred  = allTransactions.reduce((s, x) => s + Number(x.credit_amount || 0), 0)
              return (
                <div className="grid grid-cols-4 gap-3 p-4 bg-gray-50 border-b">
                  {[
                    { label: 'Total Revenue',  value: formatCurrency(totalRev),  color: 'blue'   },
                    { label: 'Cash Collected', value: formatCurrency(totalCash), color: 'green'  },
                    { label: 'Card / Bank',    value: formatCurrency(totalCard), color: 'blue'   },
                    { label: 'Credit Given',   value: formatCurrency(totalCred), color: 'orange' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`bg-white rounded-lg p-3 border border-${color}-100`}>
                      <p className="text-xs text-gray-500">{label}</p>
                      <p className={`text-lg font-bold text-${color}-600 mt-0.5`}>{value}</p>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Transaction table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Sale #</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Date & Time</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Items</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {!allTransactions && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
                  )}
                  {allTransactions?.map(sale => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-semibold text-blue-700 text-xs">{sale.sale_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{new Date(sale.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{new Date(sale.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        {sale.customers?.name || <span className="text-gray-400 italic text-xs">Walk-in</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                          {sale.sale_items?.length || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">
                        {formatCurrency(Number(sale.total || 0))}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {Number(sale.cash_amount)   > 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Cash</span>}
                          {Number(sale.card_amount)   > 0 && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Card</span>}
                          {Number(sale.credit_amount) > 0 && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Credit</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {allTransactions?.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No transactions found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t bg-gray-50 rounded-b-xl text-xs text-gray-400 text-center">
              Showing all transactions · Data is for your records only
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Add Customer</h3>
              <button onClick={() => setShowAddCustomer(false)}>
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addCustomer.mutate() }} className="space-y-3">
              <input
                type="text"
                placeholder="Customer Name *"
                required
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                type="email"
                placeholder="Email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Add Customer
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}