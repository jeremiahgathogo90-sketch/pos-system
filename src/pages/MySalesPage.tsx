import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { useAuthContext } from '../contexts/AuthContext'
import {
  DollarSign, ShoppingCart, TrendingUp,
  Banknote, CreditCard, Building2, CheckCircle, X
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function MySalesPage() {
  const { user, profile } = useAuthContext()
  const queryClient = useQueryClient()
  const [clearingCredit, setClearingCredit] = useState<any>(null)  // store full sale object
  const [paymentAmount, setPaymentAmount] = useState('')

  const isAdminOrOwner = profile?.role === 'owner' || profile?.role === 'admin'

  const { data, isLoading } = useQuery({
    queryKey: ['my-sales', user?.id, profile?.role],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Get current shift (only for cashiers)
      let shift = null
      if (!isAdminOrOwner) {
        const { data: shiftData } = await supabase
          .from('cashier_shifts')
          .select('*')
          .eq('cashier_id', user?.id)
          .eq('shift_date', today.toISOString().split('T')[0])
          .eq('status', 'open')
          .single()
        shift = shiftData
      }

      // Build query - admins/owners see all sales today, cashiers see only their own
      let query = supabase
        .from('sales')
        .select('*, customers(name, phone), profiles(full_name)')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })

      if (!isAdminOrOwner) {
        query = query.eq('cashier_id', user?.id)
      }

      const { data: sales, error } = await query
      if (error) throw error

      const totalSales   = sales?.reduce((s, x) => s + Number(x.total       || 0), 0) || 0
      const cashTotal    = sales?.reduce((s, x) => s + Number(x.cash_amount  || 0), 0) || 0
      const cardTotal    = sales?.reduce((s, x) => s + Number(x.card_amount  || 0), 0) || 0
      const creditTotal  = sales?.reduce((s, x) => s + Number(x.credit_amount|| 0), 0) || 0
      const count        = sales?.length || 0
      const average      = count > 0 ? totalSales / count : 0

      // Only show credits that have a customer (so we can clear them)
      const creditSales = sales?.filter(sale =>
        (sale.payment_method === 'credit' || Number(sale.credit_amount) > 0)
      ) || []

      return { totalSales, cashTotal, cardTotal, creditTotal, count, average, recentSales: sales || [], creditSales, shift }
    },
    refetchInterval: 30000, // auto-refresh every 30 seconds
  })

  // ── Clear credit mutation ────────────────────────────────────────────────
  const clearCredit = useMutation({
    mutationFn: async ({
      saleId,
      customerId,
      amount,
    }: {
      saleId: string
      customerId: string
      amount: number
    }) => {
      if (!amount || amount <= 0) throw new Error('Please enter a valid amount')
      if (!customerId)            throw new Error('No customer linked to this sale')

      // 1. Record the payment
      const { error: payErr } = await supabase
        .from('customer_payments')
        .insert({
          customer_id: customerId,
          sale_id:     saleId,
          amount,
          payment_method: 'cash',
          recorded_by: user?.id,
          cleared_by:  user?.id,
        })
      if (payErr) throw payErr

      // 2. Reduce customer outstanding balance
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('outstanding_balance')
        .eq('id', customerId)
        .single()
      if (custErr) throw custErr

      const newBalance = Math.max(0, Number(customer.outstanding_balance || 0) - amount)
      const { error: updateErr } = await supabase
        .from('customers')
        .update({ outstanding_balance: newBalance })
        .eq('id', customerId)
      if (updateErr) throw updateErr
    },
    onSuccess: () => {
      toast.success('Credit cleared successfully!')
      queryClient.invalidateQueries({ queryKey: ['my-sales'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      setClearingCredit(null)
      setPaymentAmount('')
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to clear credit')
    },
  })

  const fmt = (n?: number | null) => {
    const num = Number(n ?? 0)
    return `KES ${isNaN(num) ? '0.00' : num.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">
          {isAdminOrOwner ? "Today's Sales Overview" : 'My Sales Today'}
        </h1>
        <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
          <div>
            <p className="text-blue-100">
              {isAdminOrOwner ? 'Role' : 'Cashier'}:{' '}
              <span className="font-semibold">{profile?.full_name}</span>
            </p>
            <p className="text-blue-100 text-sm capitalize">
              {profile?.role} · ID: {user?.id?.slice(0, 8)}
            </p>
          </div>
          {data?.shift && (
            <div className="bg-white bg-opacity-20 rounded-lg px-4 py-2 text-sm">
              <p>Shift Open Since</p>
              <p className="font-bold">{new Date(data.shift.opened_at).toLocaleTimeString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Sales',       value: fmt(data?.totalSales), icon: DollarSign,   color: 'green'  },
          { label: 'Transactions',      value: data?.count ?? 0,     icon: ShoppingCart,  color: 'blue'   },
          { label: 'Average Sale',      value: fmt(data?.average),   icon: TrendingUp,    color: 'purple' },
          { label: 'Credits Pending',   value: data?.creditSales?.length ?? 0, icon: CreditCard, color: 'orange' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className={`text-2xl font-bold mt-1 text-${color}-600`}>{value}</p>
              </div>
              <div className={`p-3 bg-${color}-100 rounded-full`}>
                <Icon className={`w-6 h-6 text-${color}-600`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Payment breakdown ── */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Payment Breakdown</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Cash',     value: data?.cashTotal,   icon: Banknote,   color: 'green'  },
            { label: 'Card/Bank',value: data?.cardTotal,   icon: CreditCard, color: 'blue'   },
            { label: 'Credit',   value: data?.creditTotal, icon: Building2,  color: 'orange' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className={`border-2 border-${color}-200 bg-${color}-50 rounded-xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 text-${color}-600`} />
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
              <p className={`text-2xl font-bold text-${color}-600`}>{fmt(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Credit Sales (clearable) ── */}
      {(data?.creditSales?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl shadow">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold">Credit Sales — Pending Payment</h2>
            <p className="text-sm text-gray-500 mt-1">Click "Clear Credit" when payment is received</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left font-medium text-gray-500 uppercase text-xs">Sale #</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500 uppercase text-xs">Customer</th>
                  <th className="px-5 py-3 text-right font-medium text-gray-500 uppercase text-xs">Credit Amount</th>
                  <th className="px-5 py-3 text-left font-medium text-gray-500 uppercase text-xs">Time</th>
                  <th className="px-5 py-3 text-center font-medium text-gray-500 uppercase text-xs">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.creditSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium">{sale.sale_number}</td>
                    <td className="px-5 py-3">
                      <div>{sale.customers?.name || <span className="text-gray-400 italic">Walk-in</span>}</div>
                      {sale.customers?.phone && <div className="text-xs text-gray-400">{sale.customers.phone}</div>}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-orange-600">
                      {fmt(Number(sale.credit_amount || sale.total))}
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(sale.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => {
                          setClearingCredit(sale)
                          setPaymentAmount(String(Number(sale.credit_amount || sale.total)))
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                      >
                        <CheckCircle className="w-3 h-3" />
                        Clear Credit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recent Transactions ── */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500 uppercase text-xs">Sale #</th>
                {isAdminOrOwner && (
                  <th className="px-5 py-3 text-left font-medium text-gray-500 uppercase text-xs">Cashier</th>
                )}
                <th className="px-5 py-3 text-right font-medium text-gray-500 uppercase text-xs">Amount</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500 uppercase text-xs">Payment</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500 uppercase text-xs">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data?.recentSales?.map(sale => (
                <tr key={sale.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{sale.sale_number}</td>
                  {isAdminOrOwner && (
                    <td className="px-5 py-3 text-gray-600">{sale.profiles?.full_name || '—'}</td>
                  )}
                  <td className="px-5 py-3 text-right font-semibold text-green-600">
                    {fmt(Number(sale.total))}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {Number(sale.cash_amount)   > 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Cash</span>}
                      {Number(sale.card_amount)   > 0 && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Card</span>}
                      {Number(sale.credit_amount) > 0 && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Credit</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500">
                    {new Date(sale.created_at).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
              {!data?.recentSales?.length && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No sales yet today</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Clear Credit Modal ── */}
      {clearingCredit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold">Clear Credit Payment</h3>
              <button
                onClick={() => { setClearingCredit(null); setPaymentAmount('') }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sale info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Sale #:</span>
                <span className="font-semibold">{clearingCredit.sale_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-semibold">{clearingCredit.customers?.name || 'Walk-in'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Outstanding:</span>
                <span className="font-bold text-orange-600 text-lg">
                  {fmt(Number(clearingCredit.credit_amount || clearingCredit.total))}
                </span>
              </div>
            </div>

            {/* Amount input */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Amount Being Paid
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg text-2xl font-bold text-right focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => { setClearingCredit(null); setPaymentAmount('') }}
                disabled={clearCredit.isPending}
                className="flex-1 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const amount = parseFloat(paymentAmount)
                  if (!amount || amount <= 0) {
                    toast.error('Enter a valid amount')
                    return
                  }
                  if (!clearingCredit.customer_id) {
                    toast.error('No customer linked to this sale')
                    return
                  }
                  clearCredit.mutate({
                    saleId:     clearingCredit.id,
                    customerId: clearingCredit.customer_id,
                    amount,
                  })
                }}
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || clearCredit.isPending}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition"
              >
                {clearCredit.isPending ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}