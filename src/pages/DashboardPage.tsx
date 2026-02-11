import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { useAuthContext } from '../contexts/AuthContext'
import {
  DollarSign, ShoppingCart, Package, Users,
  TrendingUp, AlertTriangle, RefreshCw, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7']

export default function DashboardPage() {
  const { profile } = useAuthContext()
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // ── Main dashboard query — auto-refreshes every 30 seconds ─────────────
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const now      = new Date()
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
      const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0)
      const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
      const yesterdayEnd   = new Date(todayStart)

      // All today's sales
      const { data: todaySales } = await supabase
        .from('sales')
        .select('total, cash_amount, card_amount, credit_amount, cashier_id, created_at')
        .gte('created_at', todayStart.toISOString())

      // Yesterday's sales (for % change)
      const { data: yesterdaySales } = await supabase
        .from('sales')
        .select('total')
        .gte('created_at', yesterdayStart.toISOString())
        .lt('created_at', yesterdayEnd.toISOString())

      // Last 7 days for chart
      const { data: weeklySales } = await supabase
        .from('sales')
        .select('total, created_at')
        .gte('created_at', weekStart.toISOString())
        .order('created_at')

      // Products low on stock
      const { data: lowStock } = await supabase
        .from('products')
        .select('id, name, stock_quantity, low_stock_threshold, sku')
        .lt('stock_quantity', supabase.rpc ? 10 : 10)
        .eq('is_active', true)
        .order('stock_quantity')
        .limit(10)

      // All products for out-of-stock count
      const { data: products } = await supabase
        .from('products')
        .select('id, stock_quantity, low_stock_threshold')
        .eq('is_active', true)

      // Customers with outstanding balance
      const { data: customers } = await supabase
        .from('customers')
        .select('id, outstanding_balance')

      // Active cashier shifts today
      const { data: activeShifts } = await supabase
        .from('cashier_shifts')
        .select('*, profiles(full_name)')
        .eq('shift_date', todayStart.toISOString().split('T')[0])
        .eq('status', 'open')

      // Month sales
      const { data: monthSales } = await supabase
        .from('sales')
        .select('total')
        .gte('created_at', monthStart.toISOString())

      // ── Calculations ────────────────────────────
      const todayTotal     = todaySales?.reduce((s, x) => s + Number(x.total || 0), 0) || 0
      const yesterdayTotal = yesterdaySales?.reduce((s, x) => s + Number(x.total || 0), 0) || 0
      const monthTotal     = monthSales?.reduce((s, x) => s + Number(x.total || 0), 0) || 0
      const todayCount     = todaySales?.length || 0
      const cashTotal      = todaySales?.reduce((s, x) => s + Number(x.cash_amount   || 0), 0) || 0
      const cardTotal      = todaySales?.reduce((s, x) => s + Number(x.card_amount   || 0), 0) || 0
      const creditTotal    = todaySales?.reduce((s, x) => s + Number(x.credit_amount || 0), 0) || 0
      const totalCredit    = customers?.reduce((s, x) => s + Number(x.outstanding_balance || 0), 0) || 0

      const pctChange = yesterdayTotal > 0
        ? ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
        : null

      const outOfStock  = products?.filter(p => p.stock_quantity <= 0).length || 0
      const lowStockCnt = products?.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 5)).length || 0

      // Build 7-day chart data
      const dayMap: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        dayMap[d.toISOString().split('T')[0]] = 0
      }
      weeklySales?.forEach(sale => {
        const day = sale.created_at?.split('T')[0]
        if (day && dayMap[day] !== undefined) {
          dayMap[day] = (dayMap[day] || 0) + Number(sale.total || 0)
        }
      })
      const weeklyChartData = Object.entries(dayMap).map(([date, total]) => ({
        date: new Date(date).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric' }),
        total: Number(total.toFixed(2)),
      }))

      // Payment method pie
      const paymentPieData = [
        { name: 'Cash',     value: Number(cashTotal.toFixed(2))   },
        { name: 'Card',     value: Number(cardTotal.toFixed(2))   },
        { name: 'Credit',   value: Number(creditTotal.toFixed(2)) },
      ].filter(x => x.value > 0)

      // Low stock products (filtered properly)
      const lowStockProducts = products
        ?.filter(p => p.stock_quantity <= (p.low_stock_threshold || 5))
        .map(p => p.id) || []

      const { data: lowStockDetails } = await supabase
        .from('products')
        .select('id, name, sku, stock_quantity, low_stock_threshold')
        .in('id', lowStockProducts.length > 0 ? lowStockProducts : ['none'])
        .order('stock_quantity')
        .limit(8)

      return {
        todayTotal, yesterdayTotal, monthTotal, todayCount,
        cashTotal, cardTotal, creditTotal, totalCredit,
        pctChange, outOfStock, lowStockCnt,
        weeklyChartData, paymentPieData,
        lowStockProducts: lowStockDetails || [],
        activeShifts: activeShifts || [],
        lastUpdated: new Date(),
      }
    },
    refetchInterval: 30000,      // auto-refresh every 30 s
    refetchIntervalInBackground: true,
    staleTime: 10000,
  })

  const fmt = (n?: number | null) => {
    const num = Number(n ?? 0)
    return `KES ${isNaN(num) ? '0.00' : num.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const handleManualRefresh = () => {
    setLastRefresh(new Date())
    refetch()
  }

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Welcome back, <span className="font-semibold text-blue-600">{profile?.full_name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400 text-right">
            <div>Auto-refresh every 30s</div>
            <div>Last updated: {data?.lastUpdated?.toLocaleTimeString() || '—'}</div>
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Revenue */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="w-6 h-6 text-green-600" /></div>
            {data?.pctChange !== null && data?.pctChange !== undefined && (
              <span className={`flex items-center gap-1 text-xs font-semibold ${data.pctChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {data.pctChange >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(data.pctChange).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">Today's Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(data?.todayTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{data?.todayCount || 0} transactions</p>
        </div>

        {/* Month Revenue */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="w-6 h-6 text-blue-600" /></div>
          </div>
          <p className="text-sm text-gray-500">Month Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(data?.monthTotal)}</p>
          <p className="text-xs text-gray-400 mt-1">{new Date().toLocaleString('default', { month: 'long' })}</p>
        </div>

        {/* Low Stock */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Package className="w-6 h-6 text-yellow-600" /></div>
            {(data?.outOfStock ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-600">
                <AlertTriangle className="w-3 h-3" />
                {data?.outOfStock} out
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">Low Stock Items</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{data?.lowStockCnt || 0}</p>
          <p className="text-xs text-gray-400 mt-1">{data?.outOfStock || 0} out of stock</p>
        </div>

        {/* Outstanding Credit */}
        <div className="bg-white rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-orange-100 rounded-lg"><Users className="w-6 h-6 text-orange-600" /></div>
          </div>
          <p className="text-sm text-gray-500">Outstanding Credit</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{fmt(data?.totalCredit)}</p>
          <p className="text-xs text-gray-400 mt-1">Across all customers</p>
        </div>
      </div>

      {/* ── Payment breakdown + chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-day Sales Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Sales — Last 7 Days</h2>
          {isLoading ? (
            <div className="h-48 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data?.weeklyChartData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => [`KES ${Number(v).toLocaleString()}`, 'Sales']} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Payment Pie */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Today's Payment Mix</h2>
          {(data?.paymentPieData?.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No sales today yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data?.paymentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {data?.paymentPieData?.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: any) => `KES ${Number(v).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Today's payment totals ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Cash Collected',   value: data?.cashTotal,   color: 'green' },
          { label: 'Card/Bank',        value: data?.cardTotal,   color: 'blue'  },
          { label: 'Credit Given',     value: data?.creditTotal, color: 'orange'},
        ].map(({ label, value, color }) => (
          <div key={label} className={`bg-${color}-50 border-2 border-${color}-200 rounded-xl p-4`}>
            <p className="text-sm text-gray-600">{label}</p>
            <p className={`text-xl font-bold text-${color}-600 mt-1`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* ── Active Shifts + Low Stock (side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Active Cashier Shifts */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Shifts Today</h2>
            <span className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full font-medium">
              {data?.activeShifts?.length || 0} open
            </span>
          </div>
          <div className="divide-y">
            {data?.activeShifts?.length === 0 && (
              <p className="p-5 text-sm text-gray-400 text-center">No active shifts</p>
            )}
            {data?.activeShifts?.map((shift: any) => (
              <div key={shift.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{shift.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">
                    Opened at {new Date(shift.opened_at).toLocaleTimeString()} ·
                    Opening: {fmt(shift.opening_balance)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-600">{fmt(shift.total_sales)}</p>
                  <p className="text-xs text-gray-400">sales</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-xl shadow">
          <div className="p-5 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">Low Stock Alert</h2>
            {(data?.outOfStock ?? 0) > 0 && (
              <span className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full font-medium">
                {data?.outOfStock} out of stock
              </span>
            )}
          </div>
          <div className="divide-y max-h-64 overflow-y-auto">
            {data?.lowStockProducts?.length === 0 && (
              <p className="p-5 text-sm text-gray-400 text-center">✅ All stock levels OK</p>
            )}
            {data?.lowStockProducts?.map((product: any) => (
              <div key={product.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                  <p className="text-xs text-gray-400">{product.sku}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  product.stock_quantity <= 0
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {product.stock_quantity <= 0 ? 'OUT OF STOCK' : `${product.stock_quantity} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}