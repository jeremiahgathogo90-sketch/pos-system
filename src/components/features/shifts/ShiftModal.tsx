import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../libs/supabase'
import { useAuthContext } from '../../../contexts/AuthContext'
import { DollarSign, X } from 'lucide-react'
import toast from 'react-hot-toast'

interface ShiftModalProps {
  isOpen: boolean
  onClose: () => void
  onShiftOpened?: (shiftId: string) => void
}

export default function ShiftModal({ isOpen, onClose, onShiftOpened }: ShiftModalProps) {
  const { user, profile } = useAuthContext()
  const queryClient = useQueryClient()
  const [openingBalance, setOpeningBalance] = useState('')
  const [closingBalance, setClosingBalance] = useState('')

  // Check if cashier has an open shift today
  const { data: currentShift, isLoading } = useQuery({
    queryKey: ['current-shift', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('cashier_shifts')
        .select('*')
        .eq('cashier_id', user?.id)
        .eq('shift_date', today)
        .eq('status', 'open')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    },
    enabled: isOpen && !!user?.id,
  })

  // Open shift mutation
  const openShift = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(openingBalance)
      if (isNaN(amount) || amount < 0) {
        throw new Error('Please enter a valid opening balance')
      }

      const { data, error } = await supabase
        .from('cashier_shifts')
        .insert({
          cashier_id: user?.id,
          opening_balance: amount,
          shift_date: new Date().toISOString().split('T')[0],
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      toast.success('Shift opened successfully!')
      queryClient.invalidateQueries({ queryKey: ['current-shift'] })
      setOpeningBalance('')
      onShiftOpened?.(data.id)
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to open shift')
    },
  })

  // Close shift mutation
  const closeShift = useMutation({
    mutationFn: async () => {
      if (!currentShift) throw new Error('No open shift found')
      
      const amount = parseFloat(closingBalance)
      if (isNaN(amount) || amount < 0) {
        throw new Error('Please enter a valid closing balance')
      }

      // Call the close_cashier_shift function
      const { data, error } = await supabase.rpc('close_cashier_shift', {
        p_shift_id: currentShift.id,
        p_closing_balance: amount,
      })

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      const variance = data[0]?.variance || 0
      if (variance > 0) {
        toast.success(`Shift closed! Over by KES ${Math.abs(variance).toFixed(2)}`)
      } else if (variance < 0) {
        toast.error(`Shift closed! Short by KES ${Math.abs(variance).toFixed(2)}`)
      } else {
        toast.success('Shift closed! Balance matches perfectly!')
      }
      queryClient.invalidateQueries({ queryKey: ['current-shift'] })
      queryClient.invalidateQueries({ queryKey: ['my-sales'] })
      setClosingBalance('')
      onClose()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to close shift')
    },
  })

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  if (!isOpen) return null
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">
            {currentShift ? 'Close Register' : 'Open Register'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {!currentShift ? (
            // OPEN SHIFT FORM
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Welcome, {profile?.full_name}!</strong>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  Enter the cash amount in your register to begin your shift.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Opening Balance (Cash in Register)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg text-2xl font-semibold text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Count all cash in your drawer and enter the total amount
                </p>
              </div>

              <button
                onClick={() => openShift.mutate()}
                disabled={openShift.isPending || !openingBalance}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {openShift.isPending ? 'Opening Shift...' : 'Open Register & Start Shift'}
              </button>
            </div>
          ) : (
            // CLOSE SHIFT FORM
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>End of Shift Summary</strong>
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Count your cash drawer and enter the closing balance.
                </p>
              </div>

              {/* Shift Summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Opening Balance:</span>
                  <span className="font-semibold">{formatCurrency(currentShift.opening_balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash Sales:</span>
                  <span className="font-semibold text-green-600">
                    +{formatCurrency(currentShift.cash_sales_total || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Card Sales:</span>
                  <span className="font-semibold text-blue-600">
                    {formatCurrency(currentShift.card_sales_total || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Credit Sales:</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(currentShift.credit_sales_total || 0)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="font-semibold text-gray-700">Total Sales:</span>
                  <span className="font-bold text-lg">{formatCurrency(currentShift.total_sales || 0)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="font-semibold text-gray-700">Expected Cash:</span>
                  <span className="font-bold text-lg text-blue-600">
                    {formatCurrency(currentShift.opening_balance + (currentShift.cash_sales_total || 0))}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Closing Balance (Actual Cash Count)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    value={closingBalance}
                    onChange={(e) => setClosingBalance(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg text-2xl font-semibold text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Count all physical cash in your drawer
                </p>
              </div>

              {/* Show variance preview */}
              {closingBalance && (
                <div className={`p-4 rounded-lg border-2 ${
                  parseFloat(closingBalance) - (currentShift.opening_balance + (currentShift.cash_sales_total || 0)) >= 0
                    ? 'bg-green-50 border-green-300'
                    : 'bg-red-50 border-red-300'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Variance:</span>
                    <span className={`text-2xl font-bold ${
                      parseFloat(closingBalance) - (currentShift.opening_balance + (currentShift.cash_sales_total || 0)) >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {formatCurrency(
                        parseFloat(closingBalance) - (currentShift.opening_balance + (currentShift.cash_sales_total || 0))
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {parseFloat(closingBalance) - (currentShift.opening_balance + (currentShift.cash_sales_total || 0)) > 0
                      ? 'Cash over (surplus)'
                      : parseFloat(closingBalance) - (currentShift.opening_balance + (currentShift.cash_sales_total || 0)) < 0
                      ? 'Cash short (shortage)'
                      : 'Perfect balance!'}
                  </p>
                </div>
              )}

              <button
                onClick={() => closeShift.mutate()}
                disabled={closeShift.isPending || !closingBalance}
                className="w-full py-3 bg-red-600 text-white rounded-lg font-bold text-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {closeShift.isPending ? 'Closing Shift...' : 'Close Register & End Shift'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}