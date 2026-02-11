import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { Plus, Package, CheckCircle } from 'lucide-react'
import PurchaseOrderFormModal from '../components/features/purchaseOrders/PurchaseOrderFormModal'
import toast from 'react-hot-toast'

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient()
  const [showPOForm, setShowPOForm] = useState(false)

  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchase-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select('*, suppliers(name), purchase_order_items(quantity)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const receivePO = useMutation({
    mutationFn: async (poId: string) => {
      // Get PO items
      const { data: items, error: itemsError } = await supabase
        .from('purchase_order_items')
        .select('product_id, quantity')
        .eq('purchase_order_id', poId)

      if (itemsError) throw itemsError

      // Update stock for each product
      for (const item of items) {
        const { error: updateError } = await supabase.rpc('increment_stock', {
          product_id: item.product_id,
          quantity_to_add: item.quantity,
        })

        if (updateError) {
          // Fallback if RPC doesn't exist
          const { data: product } = await supabase
            .from('products')
            .select('stock_quantity')
            .eq('id', item.product_id)
            .single()

          await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity + item.quantity })
            .eq('id', item.product_id)
        }
      }

      // Mark PO as received
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: 'received',
          received_date: new Date().toISOString(),
        })
        .eq('id', poId)

      if (poError) throw poError
    },
    onSuccess: () => {
      toast.success('Purchase order received! Stock updated.')
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to receive purchase order')
    },
  })

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const totalPOs = purchaseOrders?.length || 0
  const pendingPOs = purchaseOrders?.filter(po => po.status === 'pending').length || 0
  const totalValue = purchaseOrders
    ?.filter(po => po.status === 'pending')
    .reduce((sum, po) => sum + Number(po.total_amount), 0) || 0

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-500 mt-1">Manage orders to suppliers</p>
        </div>
        <button
          onClick={() => setShowPOForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          New Purchase Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Orders</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalPOs}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Pending Orders</p>
          <p className="text-3xl font-bold text-orange-600 mt-2">{pendingPOs}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Pending Value</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {purchaseOrders?.map(po => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {po.po_number}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {po.suppliers?.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {po.purchase_order_items?.length || 0} items
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                    {formatCurrency(Number(po.total_amount))}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      po.status === 'received'
                        ? 'bg-green-100 text-green-800'
                        : po.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {po.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(po.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {po.status === 'pending' && (
                      <button
                        onClick={() => receivePO.mutate(po.id)}
                        className="inline-flex items-center gap-2 px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Mark Received
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <PurchaseOrderFormModal
        isOpen={showPOForm}
        onClose={() => setShowPOForm(false)}
      />
    </div>
  )
}