import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../libs/supabase'
import { useAuthContext } from '../../../contexts/AuthContext'
import { X, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

interface POFormModalProps {
  isOpen: boolean
  onClose: () => void
}

interface POItem {
  product_id: string
  product_name: string
  quantity: number
  unit_cost: number
  subtotal: number
}

export default function PurchaseOrderFormModal({ isOpen, onClose }: POFormModalProps) {
  const queryClient = useQueryClient()
  const { user } = useAuthContext()
  
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<POItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, cost')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })

  const addItem = () => {
    if (!selectedProduct || quantity <= 0 || unitCost <= 0) {
      toast.error('Please fill all item fields')
      return
    }

    const product = products?.find(p => p.id === selectedProduct)
    if (!product) return

    const newItem: POItem = {
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_cost: unitCost,
      subtotal: quantity * unitCost,
    }

    setItems([...items, newItem])
    setSelectedProduct('')
    setQuantity(1)
    setUnitCost(0)
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const createPO = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error('Please select a supplier')
      if (items.length === 0) throw new Error('Please add at least one item')

      const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0)
      const poNumber = `PO-${Date.now()}`

      // Create PO
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: poNumber,
          supplier_id: supplierId,
          total_amount: totalAmount,
          notes,
          created_by: user?.id,
        })
        .select()
        .single()

      if (poError) throw poError

      // Create PO items
      const poItems = items.map(item => ({
        purchase_order_id: po.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        subtotal: item.subtotal,
      }))

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(poItems)

      if (itemsError) throw itemsError

      return po
    },
    onSuccess: () => {
      toast.success('Purchase order created!')
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      onClose()
      resetForm()
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create purchase order')
    },
  })

  const resetForm = () => {
    setSupplierId('')
    setNotes('')
    setItems([])
    setSelectedProduct('')
    setQuantity(1)
    setUnitCost(0)
  }

  const handleProductChange = (productId: string) => {
    setSelectedProduct(productId)
    const product = products?.find(p => p.id === productId)
    if (product) {
      setUnitCost(Number(product.cost))
    }
  }

  if (!isOpen) return null

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Create Purchase Order</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Supplier Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supplier *
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Supplier</option>
              {suppliers?.map(supplier => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          {/* Add Items */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Add Items</h3>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-5">
                <select
                  value={selectedProduct}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Product</option>
                  {products?.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Qty"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="1"
                />
              </div>
              <div className="col-span-3">
                <input
                  type="number"
                  step="0.01"
                  value={unitCost}
                  onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
                  placeholder="Unit Cost"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  min="0"
                />
              </div>
              <div className="col-span-2">
                <button
                  onClick={addItem}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Order Items</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Cost</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm">{item.product_name}</td>
                        <td className="px-4 py-2 text-sm text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-right">
                          KES {item.unit_cost.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium text-right">
                          KES {item.subtotal.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                        Total:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-lg">
                        KES {totalAmount.toLocaleString()}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => createPO.mutate()}
              disabled={createPO.isPending || items.length === 0}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {createPO.isPending ? 'Creating...' : 'Create Purchase Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}