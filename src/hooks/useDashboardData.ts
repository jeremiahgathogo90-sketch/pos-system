import { useQuery } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { startOfDay, subDays } from 'date-fns'

export function useDashboardData() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const today = startOfDay(new Date())
      const sevenDaysAgo = subDays(today, 7)

      // Today's sales total
      const { data: todaySales, error: todayError } = await supabase
        .from('sales')
        .select('total')
        .gte('created_at', today.toISOString())

      if (todayError) throw todayError

      // Today's transaction count
      const todayTotal = todaySales?.reduce((sum, sale) => sum + Number(sale.total), 0) || 0
      const todayCount = todaySales?.length || 0

      // Low stock products
      const { data: lowStock, error: lowStockError } = await supabase
        .from('products')
        .select('id, name, stock_quantity, low_stock_threshold')
        .lte('stock_quantity', supabase.rpc('stock_quantity'))
        .eq('is_active', true)
        .order('stock_quantity', { ascending: true })
        .limit(5)

      if (lowStockError) throw lowStockError

      // Last 7 days sales for chart
      const { data: weekSales, error: weekError } = await supabase
        .from('sales')
        .select('created_at, total')
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true })

      if (weekError) throw weekError

      // Top 5 products by quantity sold
      const { data: topProducts, error: topError } = await supabase
        .from('sale_items')
        .select('product_name, quantity')
        .gte('created_at', sevenDaysAgo.toISOString())

      if (topError) throw topError

      // Aggregate top products
      const productSales = topProducts?.reduce((acc: any, item) => {
        const name = item.product_name
        if (!acc[name]) {
          acc[name] = 0
        }
        acc[name] += item.quantity
        return acc
      }, {})

      const topProductsArray = Object.entries(productSales || {})
        .map(([name, quantity]) => ({ name, quantity }))
        .sort((a: any, b: any) => b.quantity - a.quantity)
        .slice(0, 5)

      // Recent sales (last 10)
      const { data: recentSales, error: recentError } = await supabase
        .from('sales')
        .select('id, sale_number, total, payment_method, created_at')
        .order('created_at', { ascending: false })
        .limit(10)

      if (recentError) throw recentError

      // Aggregate sales by day for chart
      const salesByDay = weekSales?.reduce((acc: any, sale) => {
        const date = new Date(sale.created_at).toLocaleDateString()
        if (!acc[date]) {
          acc[date] = 0
        }
        acc[date] += Number(sale.total)
        return acc
      }, {})

      const chartData = Object.entries(salesByDay || {}).map(([date, total]) => ({
        date,
        total: Number(total),
      }))

      return {
        todayTotal,
        todayCount,
        lowStock: lowStock || [],
        chartData,
        topProducts: topProductsArray,
        recentSales: recentSales || [],
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}