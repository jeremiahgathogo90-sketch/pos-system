import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../libs/supabase'
import { useAuthContext } from '../../../contexts/AuthContext'
import { usePOSStore } from '../../../store/usePOSStore'
import { Clock, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SuspendedOrders() {
  const queryClient = useQueryClient()
  const { user } = useAuthContext()
  const { cart, clearCart } = usePOSStore()

  const { data: orders } = useQuery({
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

  const suspendOrder = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) {
        throw new Error('Cart is empty')
      }

      const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)

      const { error } = await supabase
        .from('suspended_orders')
        .insert({
          cashier_id: user?.id,
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
    onError: (error: any) => {
      toast.error(error.message || 'Failed to suspend order')
    },
  })

  const resumeOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const order = orders?.find((o) => o.id === orderId)
      if (!order) throw new Error('Order not found')

      // Delete from database
      const { error } = await supabase
        .from('suspended_orders')
        .delete()
        .eq('id', orderId)

      if (error) throw error

      return order
    },
    onSuccess: (order) => {
      // Load items into cart
      usePOSStore.setState({ cart: order.items })
      toast.success('Order resumed')
      queryClient.invalidateQueries({ queryKey: ['suspended-orders'] })
    },
  })

  const deleteOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('suspended_orders')
        .delete()
        .eq('id', orderId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Order deleted')
      queryClient.invalidateQueries({ queryKey: ['suspended-orders'] })
    },
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Suspended Orders</h2>
        <button
          onClick={() => suspendOrder.mutate()}
          disabled={cart.length === 0 || suspendOrder.isPending}
          className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition disabled:opacity-50"
        >
          Hold Order
        </button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {orders?.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No suspended orders</p>
        ) : (
          orders?.map((order) => (
            <div
              key={order.id}
              className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Clock className="w-4 h-4" />
                    {new Date(order.created_at).toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-700">
                    {order.items.length} items • KES {order.subtotal.toLocaleString()}
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => resumeOrder.mutate(order.id)}
                    className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                  >
                    Resume
                  </button>
                  <button
                    onClick={() => deleteOrder.mutate(order.id)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}