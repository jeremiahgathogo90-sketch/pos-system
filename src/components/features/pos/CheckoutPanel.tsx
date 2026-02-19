import { useState } from 'react'
import { usePOSStore } from '../../../store/usePOSStore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../libs/supabase'
import { useAuthContext } from '../../../contexts/AuthContext'
import { Calculator } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CheckoutPanel() {
  const queryClient = useQueryClient()
  const { user } = useAuthContext()
  const [taxRate] = useState(0)
  const [showCalculator, setShowCalculator] = useState(false)
  const [calculatorDisplay, setCalculatorDisplay] = useState('0')
  
  const {
    cart,
    paymentMethod,
    amountPaid,
    discount,
    selectedCustomer,
    setPaymentMethod,
    setAmountPaid,
    setDiscount,
    setSelectedCustomer,
    getSubtotal,
    getTaxAmount,
    getTotal,
    getChange,
    clearCart,
  } = usePOSStore()

  // Fetch customers for selection
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

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const completeSale = useMutation({
    mutationFn: async () => {
      const subtotal = getSubtotal()
      const tax = getTaxAmount(taxRate)
      const total = getTotal(taxRate)
      
      // Validation
      if (cart.length === 0) {
        throw new Error('Cart is empty')
      }

      if (paymentMethod === 'cash' && amountPaid < total) {
        throw new Error('Insufficient payment amount')
      }

      // Generate sale number
      const saleNumber = `SALE-${Date.now()}`

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          sale_number: saleNumber,
          cashier_id: user?.id,
          customer_id: selectedCustomer?.id || null,
          subtotal,
          tax_amount: tax,
          discount_amount: discount,
          total,
          payment_method: paymentMethod,
          amount_paid: paymentMethod === 'cash' ? amountPaid : total,
          change_amount: paymentMethod === 'cash' ? getChange(taxRate) : 0,
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

      return sale
    },
    onSuccess: () => {
      toast.success('Sale completed successfully!')
      clearCart()
      queryClient.invalidateQueries({ queryKey: ['products'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to complete sale')
    },
  })

  // Calculator functions
  const handleCalculatorClick = (value: string) => {
    if (value === 'C') {
      setCalculatorDisplay('0')
    } else if (value === '=') {
      try {
        // Safe eval alternative
        const result = Function('"use strict"; return (' + calculatorDisplay + ')')()
        setCalculatorDisplay(result.toString())
        setAmountPaid(parseFloat(result))
      } catch {
        setCalculatorDisplay('Error')
        setTimeout(() => setCalculatorDisplay('0'), 1000)
      }
    } else if (value === '←') {
      setCalculatorDisplay(calculatorDisplay.length > 1 ? calculatorDisplay.slice(0, -1) : '0')
    } else {
      if (calculatorDisplay === '0' && value !== '.') {
        setCalculatorDisplay(value)
      } else if (calculatorDisplay === 'Error') {
        setCalculatorDisplay(value)
      } else {
        setCalculatorDisplay(calculatorDisplay + value)
      }
    }
  }

  const subtotal = getSubtotal()
  const tax = getTaxAmount(taxRate)
  const total = getTotal(taxRate)
  const change = getChange(taxRate)

  return (
    <div className="space-y-4">
      {/* Customer Selection */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Customer</h3>
        <select
          value={selectedCustomer?.id || ''}
          onChange={(e) => {
            const customer = customers?.find(c => c.id === e.target.value)
            setSelectedCustomer(customer || null)
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
        >
          <option value="">Walk-in Customer</option>
          {customers?.map(customer => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        {selectedCustomer && (
          <div className="mt-2 text-xs text-gray-600">
            <p>Credit Limit: {formatCurrency(Number(selectedCustomer.credit_limit))}</p>
            <p>Outstanding: {formatCurrency(Number(selectedCustomer.outstanding_balance))}</p>
          </div>
        )}
      </div>

      {/* Checkout Section */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Checkout</h2>

        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Payment Method
          </label>
          <div className="grid grid-cols-2 gap-2">
            {['cash', 'card', 'credit', 'mobile_money'].map((method) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method as any)}
                className={`py-2 px-3 rounded-lg border-2 capitalize transition text-sm ${
                  paymentMethod === method
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {method.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Discount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Discount (KES)
          </label>
          <input
            type="number"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            min="0"
            max={subtotal}
          />
        </div>

        {/* Amount Paid (Cash only) */}
        {paymentMethod === 'cash' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Amount Paid
              </label>
              <button
                onClick={() => setShowCalculator(!showCalculator)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                title="Toggle Calculator"
              >
                <Calculator className="w-5 h-5" />
              </button>
            </div>
            <input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              min="0"
              step="0.01"
            />
            
            {/* Calculator */}
            {showCalculator && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="bg-white px-3 py-2 rounded mb-2 text-right font-mono text-lg border border-gray-300 min-h-[40px] flex items-center justify-end">
                  {calculatorDisplay}
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {['7', '8', '9', '←', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '=', 'C'].map((btn) => (
                    <button
                      key={btn}
                      onClick={() => handleCalculatorClick(btn)}
                      className={`py-2 px-1 rounded font-semibold text-sm transition ${
                        btn === '=' ? 'bg-green-500 text-white hover:bg-green-600' :
                        btn === 'C' ? 'bg-red-500 text-white hover:bg-red-600' :
                        btn === '←' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                        'bg-white border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {btn}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal:</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax ({taxRate}%):</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount:</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          
          <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t">
            <span>Total:</span>
            <span>{formatCurrency(total)}</span>
          </div>

          {paymentMethod === 'cash' && amountPaid > 0 && (
            <div className="flex justify-between text-base font-semibold text-blue-600">
              <span>Change:</span>
              <span className={change < 0 ? 'text-red-600' : 'text-blue-600'}>
                {formatCurrency(Math.abs(change))}
              </span>
            </div>
          )}
        </div>

        {/* Complete Sale Button */}
        <button
          onClick={() => completeSale.mutate()}
          disabled={cart.length === 0 || completeSale.isPending}
          className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-base hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
        >
          {completeSale.isPending ? 'Processing...' : 'Complete Sale'}
        </button>
      </div>
    </div>
  )

}
