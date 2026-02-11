import { useState } from 'react'
import { Banknote, CreditCard, Building2, X, Plus, Trash2 } from 'lucide-react'

interface PaymentMethod {
  type: 'cash' | 'card' | 'credit'
  amount: number
}

interface SplitPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  totalAmount: number
  hasCustomer: boolean   // credit only allowed for registered customers
  onConfirm: (payments: PaymentMethod[]) => void
  isPending?: boolean
}

export default function SplitPaymentModal({ 
  isOpen, 
  onClose, 
  totalAmount,
  hasCustomer,
  onConfirm,
  isPending = false 
}: SplitPaymentModalProps) {
  const [payments, setPayments] = useState<PaymentMethod[]>([
    { type: 'cash', amount: 0 }
  ])

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const addPaymentMethod = () => {
    setPayments([...payments, { type: 'cash', amount: 0 }])
  }

  const removePaymentMethod = (index: number) => {
    if (payments.length > 1) {
      setPayments(payments.filter((_, i) => i !== index))
    }
  }

  const updatePayment = (index: number, field: 'type' | 'amount', value: any) => {
    const updated = [...payments]
    if (field === 'type') {
      updated[index].type = value
    } else {
      updated[index].amount = parseFloat(value) || 0
    }
    setPayments(updated)
  }

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = totalAmount - totalPaid
  const change = totalPaid > totalAmount ? totalPaid - totalAmount : 0

  const handleConfirm = () => {
    if (totalPaid < totalAmount) {
      alert('Total payment is less than the required amount!')
      return
    }
    const hasCreditPayment = payments.some(p => p.type === 'credit' && p.amount > 0)
    if (hasCreditPayment && !hasCustomer) {
      alert('Credit payment requires a registered customer. Please select a customer first.')
      return
    }
    onConfirm(payments)
  }

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'cash': return <Banknote className="w-5 h-5" />
      case 'card': return <CreditCard className="w-5 h-5" />
      case 'credit': return <Building2 className="w-5 h-5" />
      default: return null
    }
  }

  const getPaymentColor = (type: string) => {
    switch (type) {
      case 'cash': return 'border-green-300 bg-green-50'
      case 'card': return 'border-blue-300 bg-blue-50'
      case 'credit': return 'border-orange-300 bg-orange-50'
      default: return 'border-gray-300 bg-gray-50'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold text-gray-900">Split Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Total Amount */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Total Amount Due</p>
            <p className="text-4xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
          </div>

          {/* Credit warning */}
          {!hasCustomer && (
            <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-300 rounded-lg p-3 text-sm">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-amber-800">No customer selected</p>
                <p className="text-amber-700 text-xs mt-0.5">Credit payment is only available for registered customers. Select a customer from the dropdown to enable credit.</p>
              </div>
            </div>
          )}

          {/* Payment Methods */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
              <button
                onClick={addPaymentMethod}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Payment
              </button>
            </div>

            {payments.map((payment, index) => (
              <div 
                key={index} 
                className={`border-2 rounded-lg p-4 ${getPaymentColor(payment.type)}`}
              >
                <div className="flex items-center gap-3">
                  {/* Payment Type Selector */}
                  <div className="flex-shrink-0">
                    <select
                      value={payment.type}
                      onChange={(e) => {
                        if (e.target.value === 'credit' && !hasCustomer) {
                          return // blocked — handled below
                        }
                        updatePayment(index, 'type', e.target.value)
                      }}
                      className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="cash">💵 Cash</option>
                      <option value="card">💳 Card/Bank</option>
                      <option value="credit" disabled={!hasCustomer}>
                        🏢 Credit {!hasCustomer ? '(select customer first)' : ''}
                      </option>
                    </select>
                  </div>

                  {/* Amount Input */}
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      value={payment.amount || ''}
                      onChange={(e) => updatePayment(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-xl font-semibold text-right focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Quick Fill Button */}
                  {index === 0 && payments.length === 1 && (
                    <button
                      onClick={() => updatePayment(0, 'amount', totalAmount.toString())}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm whitespace-nowrap"
                    >
                      Full Amount
                    </button>
                  )}

                  {index > 0 && (
                    <button
                      onClick={() => updatePayment(index, 'amount', remaining.toString())}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap"
                    >
                      Remaining
                    </button>
                  )}

                  {/* Remove Button */}
                  {payments.length > 1 && (
                    <button
                      onClick={() => removePaymentMethod(index)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="border-t-2 border-gray-200 pt-4 space-y-3">
            <div className="flex justify-between text-lg">
              <span className="text-gray-600">Total Paid:</span>
              <span className={`font-bold ${totalPaid >= totalAmount ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totalPaid)}
              </span>
            </div>

            {remaining > 0 && (
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">Remaining:</span>
                <span className="font-bold text-red-600">{formatCurrency(remaining)}</span>
              </div>
            )}

            {change > 0 && (
              <div className="flex justify-between text-lg bg-green-50 border-2 border-green-200 rounded-lg p-3">
                <span className="text-gray-700 font-semibold">Change to Give:</span>
                <span className="font-bold text-green-600 text-2xl">{formatCurrency(change)}</span>
              </div>
            )}

            {/* Payment Breakdown Preview */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700 mb-2">Payment Breakdown:</p>
              {payments.map((payment, index) => (
                payment.amount > 0 && (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="capitalize text-gray-600 flex items-center gap-2">
                      {getPaymentIcon(payment.type)}
                      {payment.type}:
                    </span>
                    <span className="font-semibold">{formatCurrency(payment.amount)}</span>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={isPending}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={totalPaid < totalAmount || isPending}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            >
              {isPending ? 'Processing...' : 'Complete Payment'}
            </button>
          </div>

          {totalPaid < totalAmount && (
            <p className="text-center text-sm text-red-600">
              ⚠️ Payment total must equal or exceed {formatCurrency(totalAmount)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}