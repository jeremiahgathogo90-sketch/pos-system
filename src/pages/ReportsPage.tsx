import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { useAuthContext } from '../contexts/AuthContext'
import {
  RefreshCw, Download, FileText, TrendingUp, TrendingDown,
  DollarSign, ShoppingCart, Package, CreditCard, Banknote,
  Building2, Search, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'
import toast from 'react-hot-toast'

type DateRange = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

export default function ReportsPage() {
  const { profile } = useAuthContext()
  const [dateRange, setDateRange]       = useState<DateRange>('today')
  const [customFrom, setCustomFrom]     = useState('')
  const [customTo, setCustomTo]         = useState('')
  const [txSearch, setTxSearch]         = useState('')
  const [txPage, setTxPage]             = useState(1)
  const [sortField, setSortField]       = useState<'created_at' | 'total'>('created_at')
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc')
  const [expandedTx, setExpandedTx]     = useState<string | null>(null)
  const TX_PER_PAGE = 20

  // ── Date helpers ─────────────────────────────────────────────────────────
  const getDateBounds = (): { from: Date; to: Date; label: string } => {
    const now = new Date()
    const startOf = (d: Date) => { d.setHours(0, 0, 0, 0); return d }
    const endOf   = (d: Date) => { d.setHours(23, 59, 59, 999); return d }

    if (dateRange === 'today') {
      return { from: startOf(new Date()), to: endOf(new Date()), label: 'Today' }
    }
    if (dateRange === 'yesterday') {
      const y = new Date(); y.setDate(y.getDate() - 1)
      return { from: startOf(new Date(y)), to: endOf(new Date(y)), label: 'Yesterday' }
    }
    if (dateRange === 'week') {
      const w = new Date(); w.setDate(w.getDate() - 6)
      return { from: startOf(w), to: endOf(new Date()), label: 'Last 7 Days' }
    }
    if (dateRange === 'month') {
      const m = new Date(); m.setDate(1)
      return { from: startOf(m), to: endOf(new Date()), label: new Date().toLocaleString('default', { month: 'long' }) }
    }
    // custom
    const from = customFrom ? new Date(customFrom) : startOf(new Date())
    const to   = customTo   ? new Date(customTo + 'T23:59:59') : endOf(new Date())
    return { from, to, label: `${customFrom} → ${customTo}` }
  }

  // ── Main data query — refetches every 30s ────────────────────────────────
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['reports', dateRange, customFrom, customTo],
    queryFn: async () => {
      const { from, to } = getDateBounds()

      // ── Sales with items & product cost ──────────────────────────────
      const { data: sales, error } = await supabase
        .from('sales')
        .select(`
          *,
          customers(name, phone),
          profiles(full_name),
          sale_items(
            id, product_name, quantity, unit_price, subtotal,
            products(cost_price, name)
          )
        `)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order(sortField, { ascending: sortDir === 'asc' })

      if (error) throw error

      // ── Aggregations ────────────────────────────────────────────────
      const totalRevenue   = sales?.reduce((s, x) => s + Number(x.total        || 0), 0) || 0
      const totalCash      = sales?.reduce((s, x) => s + Number(x.cash_amount  || 0), 0) || 0
      const totalCard      = sales?.reduce((s, x) => s + Number(x.card_amount  || 0), 0) || 0
      const totalCredit    = sales?.reduce((s, x) => s + Number(x.credit_amount|| 0), 0) || 0
      const totalDiscount  = sales?.reduce((s, x) => s + Number(x.discount_amount || 0), 0) || 0
      const totalTax       = sales?.reduce((s, x) => s + Number(x.tax_amount   || 0), 0) || 0
      const txCount        = sales?.length || 0
      const avgSale        = txCount > 0 ? totalRevenue / txCount : 0

      // ── Profit calculation ─────────────────────────────────────────
      // Revenue - cost of goods sold
      let totalCOGS = 0
      sales?.forEach(sale => {
        sale.sale_items?.forEach((item: any) => {
          const costPrice = Number(item.products?.cost_price || 0)
          totalCOGS += costPrice * item.quantity
        })
      })
      const grossProfit     = totalRevenue - totalCOGS
      const profitMargin    = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

      // ── Daily chart data ────────────────────────────────────────────
      const dayMap: Record<string, { revenue: number; profit: number; count: number }> = {}
      const { from: chartFrom } = getDateBounds()
      const days = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
      for (let i = 0; i < Math.min(days, 31); i++) {
        const d = new Date(from); d.setDate(d.getDate() + i)
        dayMap[d.toISOString().split('T')[0]] = { revenue: 0, profit: 0, count: 0 }
      }
      sales?.forEach(sale => {
        const day = sale.created_at?.split('T')[0]
        if (day && dayMap[day]) {
          dayMap[day].revenue += Number(sale.total || 0)
          dayMap[day].count   += 1
          // COGS for this sale
          let saleCOGS = 0
          sale.sale_items?.forEach((item: any) => {
            saleCOGS += Number(item.products?.cost_price || 0) * item.quantity
          })
          dayMap[day].profit += Number(sale.total || 0) - saleCOGS
        }
      })
      const chartData = Object.entries(dayMap).map(([date, vals]) => ({
        date: new Date(date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }),
        Revenue: Number(vals.revenue.toFixed(2)),
        Profit:  Number(vals.profit.toFixed(2)),
        Sales:   vals.count,
      }))

      // ── Top products ────────────────────────────────────────────────
      const productMap: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {}
      sales?.forEach(sale => {
        sale.sale_items?.forEach((item: any) => {
          const id = item.products?.name || item.product_name
          if (!productMap[id]) productMap[id] = { name: item.product_name, qty: 0, revenue: 0, profit: 0 }
          const cost = Number(item.products?.cost_price || 0)
          productMap[id].qty     += item.quantity
          productMap[id].revenue += item.subtotal
          productMap[id].profit  += (Number(item.unit_price) - cost) * item.quantity
        })
      })
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      // ── Per-cashier summary ─────────────────────────────────────────
      const cashierMap: Record<string, { name: string; count: number; revenue: number }> = {}
      sales?.forEach(sale => {
        const id   = sale.cashier_id || 'unknown'
        const name = sale.profiles?.full_name || 'Unknown'
        if (!cashierMap[id]) cashierMap[id] = { name, count: 0, revenue: 0 }
        cashierMap[id].count   += 1
        cashierMap[id].revenue += Number(sale.total || 0)
      })
      const cashierSummary = Object.values(cashierMap).sort((a, b) => b.revenue - a.revenue)

      return {
        sales: sales || [],
        totalRevenue, totalCash, totalCard, totalCredit,
        totalDiscount, totalTax, txCount, avgSale,
        totalCOGS, grossProfit, profitMargin,
        chartData, topProducts, cashierSummary,
        fetchedAt: new Date(),
      }
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
    staleTime: 10000,
  })

  const fmt = (n?: number | null) => {
    const num = Number(n ?? 0)
    return `KES ${isNaN(num) ? '0.00' : num.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  // ── CSV Export ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!data?.sales?.length) { toast.error('No data to export'); return }
    const { label } = getDateBounds()
    const rows = [
      ['Sale #', 'Date', 'Time', 'Cashier', 'Customer', 'Items', 'Subtotal', 'Tax', 'Discount', 'Total', 'Cash', 'Card', 'Credit', 'Change'],
      ...data.sales.map(s => [
        s.sale_number,
        new Date(s.created_at).toLocaleDateString(),
        new Date(s.created_at).toLocaleTimeString(),
        s.profiles?.full_name || 'N/A',
        s.customers?.name || 'Walk-in',
        s.sale_items?.length || 0,
        Number(s.subtotal       || 0).toFixed(2),
        Number(s.tax_amount     || 0).toFixed(2),
        Number(s.discount_amount|| 0).toFixed(2),
        Number(s.total          || 0).toFixed(2),
        Number(s.cash_amount    || 0).toFixed(2),
        Number(s.card_amount    || 0).toFixed(2),
        Number(s.credit_amount  || 0).toFixed(2),
        Number(s.change_amount  || 0).toFixed(2),
      ])
    ]
    // Summary rows
    rows.push([], ['SUMMARY'])
    rows.push(['Total Revenue', '', '', '', '', '', '', '', '', Number(data.totalRevenue).toFixed(2)])
    rows.push(['Total COGS',    '', '', '', '', '', '', '', '', Number(data.totalCOGS).toFixed(2)])
    rows.push(['Gross Profit',  '', '', '', '', '', '', '', '', Number(data.grossProfit).toFixed(2)])
    rows.push(['Profit Margin', '', '', '', '', '', '', '', '', `${data.profitMargin.toFixed(1)}%`])

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `sales-report-${label.replace(/\s/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported!')
  }

  // ── PDF Export (browser print) ───────────────────────────────────────────
  const exportPDF = () => {
    if (!data?.sales?.length) { toast.error('No data to export'); return }
    const { label } = getDateBounds()
    const w = window.open('', '_blank')
    if (!w) { toast.error('Allow popups to export PDF'); return }
    w.document.write(`
      <html><head>
        <title>Sales Report - ${label}</title>
        <style>
          @media print { @page { size: A4; margin: 15mm; } }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          h2 { font-size: 14px; margin: 16px 0 8px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; color: #3b82f6; }
          .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 16px; }
          .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
          .kpi .label { font-size: 10px; color: #64748b; margin-bottom: 4px; }
          .kpi .value { font-size: 16px; font-weight: 700; }
          .profit { color: #16a34a; } .loss { color: #dc2626; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
          th { background: #3b82f6; color: #fff; padding: 6px 8px; text-align: left; }
          td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
          tr:nth-child(even) td { background: #f9fafb; }
          .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #9ca3af; font-size: 10px; text-align: center; }
        </style>
      </head><body>
        <h1>Sales Report</h1>
        <div class="meta">Period: <b>${label}</b> &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; By: ${profile?.full_name}</div>

        <h2>Key Metrics</h2>
        <div class="kpi-grid">
          <div class="kpi"><div class="label">Total Revenue</div><div class="value">${fmt(data?.totalRevenue)}</div></div>
          <div class="kpi"><div class="label">Gross Profit</div><div class="value ${(data?.grossProfit ?? 0) >= 0 ? 'profit' : 'loss'}">${fmt(data?.grossProfit)}</div></div>
          <div class="kpi"><div class="label">Profit Margin</div><div class="value ${(data?.profitMargin ?? 0) >= 0 ? 'profit' : 'loss'}">${data?.profitMargin?.toFixed(1)}%</div></div>
          <div class="kpi"><div class="label">Transactions</div><div class="value">${data?.txCount}</div></div>
          <div class="kpi"><div class="label">Cash</div><div class="value">${fmt(data?.totalCash)}</div></div>
          <div class="kpi"><div class="label">Card/Bank</div><div class="value">${fmt(data?.totalCard)}</div></div>
          <div class="kpi"><div class="label">Credit</div><div class="value">${fmt(data?.totalCredit)}</div></div>
          <div class="kpi"><div class="label">Total COGS</div><div class="value">${fmt(data?.totalCOGS)}</div></div>
        </div>

        <h2>Transaction List (${data?.sales?.length})</h2>
        <table>
          <thead><tr><th>Sale #</th><th>Date / Time</th><th>Cashier</th><th>Customer</th><th>Items</th><th>Total</th><th>Cash</th><th>Card</th><th>Credit</th></tr></thead>
          <tbody>
            ${data?.sales?.map(s => `
              <tr>
                <td>${s.sale_number}</td>
                <td>${new Date(s.created_at).toLocaleString()}</td>
                <td>${s.profiles?.full_name || 'N/A'}</td>
                <td>${s.customers?.name || 'Walk-in'}</td>
                <td>${s.sale_items?.length || 0}</td>
                <td><b>${fmt(Number(s.total))}</b></td>
                <td>${Number(s.cash_amount || 0) > 0 ? fmt(Number(s.cash_amount)) : '—'}</td>
                <td>${Number(s.card_amount || 0) > 0 ? fmt(Number(s.card_amount)) : '—'}</td>
                <td>${Number(s.credit_amount || 0) > 0 ? fmt(Number(s.credit_amount)) : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <h2>Top Products</h2>
        <table>
          <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Profit</th></tr></thead>
          <tbody>
            ${data?.topProducts?.map(p => `
              <tr>
                <td>${p.name}</td>
                <td>${p.qty}</td>
                <td>${fmt(p.revenue)}</td>
                <td class="${p.profit >= 0 ? 'profit' : 'loss'}">${fmt(p.profit)}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div class="footer">Generated by POS System &nbsp;|&nbsp; ${profile?.full_name} &nbsp;|&nbsp; ${new Date().toLocaleString()}</div>
        <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script>
      </body></html>
    `)
    w.document.close()
    toast.success('PDF generated!')
  }

  // ── Filtered & sorted transactions ───────────────────────────────────────
  const filteredSales = data?.sales?.filter(s => {
    if (!txSearch) return true
    const q = txSearch.toLowerCase()
    return (
      s.sale_number?.toLowerCase().includes(q) ||
      s.customers?.name?.toLowerCase().includes(q) ||
      s.profiles?.full_name?.toLowerCase().includes(q)
    )
  }) || []

  const pagedSales = filteredSales.slice((txPage - 1) * TX_PER_PAGE, txPage * TX_PER_PAGE)
  const totalPages = Math.ceil(filteredSales.length / TX_PER_PAGE)

  const toggleSort = (field: 'created_at' | 'total') => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }: { field: string }) =>
    sortField === field
      ? (sortDir === 'desc' ? <ChevronDown className="w-3 h-3 inline" /> : <ChevronUp className="w-3 h-3 inline" />)
      : null

  return (
    <div className="p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isFetching ? (
              <span className="flex items-center gap-1 text-blue-500">
                <RefreshCw className="w-3 h-3 animate-spin" /> Updating...
              </span>
            ) : (
              `Last updated: ${data?.fetchedAt?.toLocaleTimeString() || '—'}`
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <FileText className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* ── Date Range Selector ── */}
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap items-center gap-3">
        {(['today', 'yesterday', 'week', 'month', 'custom'] as DateRange[]).map(r => (
          <button
            key={r}
            onClick={() => { setDateRange(r); setTxPage(1) }}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition capitalize ${
              dateRange === r ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {r === 'week' ? 'Last 7 Days' : r === 'month' ? 'This Month' : r}
          </button>
        ))}
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <input type="date" value={customFrom} onChange={e => { setCustomFrom(e.target.value); setTxPage(1) }}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-400">→</span>
            <input type="date" value={customTo} onChange={e => { setCustomTo(e.target.value); setTxPage(1) }}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
        )}
        <span className="ml-auto text-sm text-gray-500">{getDateBounds().label}</span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',  value: fmt(data?.totalRevenue),  sub: `${data?.txCount || 0} transactions`,    icon: DollarSign,   color: 'blue'   },
          { label: 'Gross Profit',   value: fmt(data?.grossProfit),   sub: `Margin: ${data?.profitMargin?.toFixed(1) || 0}%`, icon: TrendingUp, color: (data?.grossProfit ?? 0) >= 0 ? 'green' : 'red' },
          { label: 'Total COGS',     value: fmt(data?.totalCOGS),     sub: 'Cost of Goods Sold',                    icon: Package,      color: 'orange' },
          { label: 'Avg Sale Value', value: fmt(data?.avgSale),       sub: `Discount: ${fmt(data?.totalDiscount)}`, icon: ShoppingCart, color: 'purple' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl shadow p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 bg-${color}-100 rounded-lg`}><Icon className={`w-5 h-5 text-${color}-600`} /></div>
            </div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-xl font-bold text-${color}-600 mt-1`}>{value}</p>
            <p className="text-xs text-gray-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Payment breakdown ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Cash Collected', value: data?.totalCash,   icon: Banknote,  color: 'green'  },
          { label: 'Card / Bank',    value: data?.totalCard,   icon: CreditCard,color: 'blue'   },
          { label: 'Credit Given',   value: data?.totalCredit, icon: Building2, color: 'orange' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-${color}-50 border-2 border-${color}-200 rounded-xl p-4 flex items-center gap-4`}>
            <div className={`p-3 bg-${color}-100 rounded-full`}><Icon className={`w-6 h-6 text-${color}-600`} /></div>
            <div>
              <p className="text-sm text-gray-600">{label}</p>
              <p className={`text-xl font-bold text-${color}-600`}>{fmt(value)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Revenue vs Profit</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.chartData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: any) => `KES ${Number(v).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="Revenue" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="Profit"  fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Top Products</h2>
          <div className="space-y-3 max-h-[220px] overflow-y-auto">
            {data?.topProducts?.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">Qty: {p.qty}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{fmt(p.revenue)}</p>
                  <p className={`text-xs font-semibold ${p.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(p.profit)}</p>
                </div>
              </div>
            ))}
            {!data?.topProducts?.length && <p className="text-sm text-gray-400 text-center py-8">No data</p>}
          </div>
        </div>
      </div>

      {/* ── Cashier Summary ── */}
      {(data?.cashierSummary?.length ?? 0) > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Performance by Cashier</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Cashier</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Transactions</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Revenue</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Avg Sale</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.cashierSummary?.map(c => (
                  <tr key={c.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-center">{c.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">{fmt(c.revenue)}</td>
                    <td className="px-4 py-3 text-right">{fmt(c.count > 0 ? c.revenue / c.count : 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${data?.totalRevenue ? (c.revenue / data.totalRevenue) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8">
                          {data?.totalRevenue ? ((c.revenue / data.totalRevenue) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Transaction List ── */}
      <div className="bg-white rounded-xl shadow">
        <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Transaction List</h2>
            <p className="text-xs text-gray-500 mt-0.5">{filteredSales.length} transactions found</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={txSearch}
              onChange={e => { setTxSearch(e.target.value); setTxPage(1) }}
              placeholder="Search sale #, customer, cashier..."
              className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 w-6"></th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Sale #</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('created_at')}>
                  Date / Time <SortIcon field="created_at" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Cashier</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Items</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('total')}>
                  Total <SortIcon field="total" />
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />Loading...
                </td></tr>
              )}
              {pagedSales.map(sale => (
                <React.Fragment key={sale.id}>
                  <tr
                    key={sale.id}
                    className="hover:bg-blue-50 cursor-pointer transition"
                    onClick={() => setExpandedTx(expandedTx === sale.id ? null : sale.id)}
                  >
                    <td className="px-4 py-3 text-gray-400">
                      {expandedTx === sale.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-blue-700">{sale.sale_number}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{new Date(sale.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400">{new Date(sale.created_at).toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3">{sale.profiles?.full_name || '—'}</td>
                    <td className="px-4 py-3">
                      {sale.customers?.name || <span className="text-gray-400 italic">Walk-in</span>}
                    </td>
                    <td className="px-4 py-3 text-center">{sale.sale_items?.length || 0}</td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(Number(sale.total))}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {Number(sale.cash_amount)   > 0 && <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Cash</span>}
                        {Number(sale.card_amount)   > 0 && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Card</span>}
                        {Number(sale.credit_amount) > 0 && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">Credit</span>}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row — items breakdown */}
                  {expandedTx === sale.id && (
                    <tr className="bg-blue-50">
                      <td colSpan={8} className="px-8 py-4">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Items */}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Items Sold</p>
                            <table className="w-full text-xs">
                              <thead><tr className="text-gray-500">
                                <th className="text-left pb-1">Product</th>
                                <th className="text-center pb-1">Qty</th>
                                <th className="text-right pb-1">Price</th>
                                <th className="text-right pb-1">Total</th>
                              </tr></thead>
                              <tbody>
                                {sale.sale_items?.map((item: any, i: number) => (
                                  <tr key={i} className="border-t border-blue-100">
                                    <td className="py-1">{item.product_name}</td>
                                    <td className="text-center py-1">{item.quantity}</td>
                                    <td className="text-right py-1">{fmt(item.unit_price)}</td>
                                    <td className="text-right py-1 font-semibold">{fmt(item.subtotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Sale summary */}
                          <div className="text-xs space-y-1">
                            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">Summary</p>
                            {[
                              ['Subtotal',  fmt(sale.subtotal)],
                              ['Tax',       fmt(sale.tax_amount)],
                              ['Discount', `-${fmt(sale.discount_amount)}`],
                              ['Total',     fmt(sale.total)],
                            ].map(([k, v]) => (
                              <div key={k} className="flex justify-between">
                                <span className="text-gray-500">{k}:</span>
                                <span className="font-semibold">{v}</span>
                              </div>
                            ))}
                            <div className="border-t border-blue-200 mt-2 pt-2">
                              {Number(sale.cash_amount)   > 0 && <div className="flex justify-between"><span className="text-gray-500">Cash:</span><span>{fmt(sale.cash_amount)}</span></div>}
                              {Number(sale.card_amount)   > 0 && <div className="flex justify-between"><span className="text-gray-500">Card:</span><span>{fmt(sale.card_amount)}</span></div>}
                              {Number(sale.credit_amount) > 0 && <div className="flex justify-between"><span className="text-gray-500">Credit:</span><span className="text-orange-600 font-semibold">{fmt(sale.credit_amount)}</span></div>}
                              {Number(sale.change_amount) > 0 && <div className="flex justify-between"><span className="text-gray-500">Change:</span><span className="text-green-600">{fmt(sale.change_amount)}</span></div>}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!isLoading && filteredSales.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {((txPage - 1) * TX_PER_PAGE) + 1}–{Math.min(txPage * TX_PER_PAGE, filteredSales.length)} of {filteredSales.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setTxPage(p => Math.max(1, p - 1))}
                disabled={txPage === 1}
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
              >← Prev</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const page = i + 1
                return (
                  <button
                    key={page}
                    onClick={() => setTxPage(page)}
                    className={`px-3 py-1.5 border rounded-lg text-sm ${txPage === page ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}
                  >{page}</button>
                )
              })}
              <button
                onClick={() => setTxPage(p => Math.min(totalPages, p + 1))}
                disabled={txPage === totalPages}
                className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40"
              >Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}