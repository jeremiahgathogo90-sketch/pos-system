import { usePOSStore } from '../../../store/usePOSStore'
import { Trash2, Plus, Minus } from 'lucide-react'

export default function ShoppingCart() {
  const { cart, updateQuantity, updatePrice, removeFromCart, getSubtotal } = usePOSStore()

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <p className="text-lg">Cart is empty</p>
        <p className="text-sm mt-2">Add products to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {cart.map((item) => (
        <div key={item.product_id} className="bg-white rounded-lg p-3 shadow border border-gray-200">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 text-sm">{item.product_name}</h4>
            </div>
            <button
              onClick={() => removeFromCart(item.product_id)}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Price (Editable) */}
          <div className="mb-2">
            <label className="text-xs text-gray-500">Price per unit</label>
            <input
              type="number"
              step="0.01"
              value={item.price}
              onChange={(e) => updatePrice(item.product_id, parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
              min="0"
            />
          </div>

          {/* Quantity Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
                <Minus className="w-3 h-3" />
              </button>
              
              <input
                type="number"
                value={item.quantity}
                onChange={(e) => updateQuantity(item.product_id, parseInt(e.target.value) || 0)}
                className="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm"
                min="1"
                max={item.stock_available}
              />
              
              <button
                onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                disabled={item.quantity >= item.stock_available}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <p className="text-base font-bold text-gray-900">
              {formatCurrency(item.subtotal)}
            </p>
          </div>
        </div>
      ))}

      <div className="bg-blue-50 rounded-lg p-3 border-2 border-blue-200">
        <div className="flex items-center justify-between">
          <span className="text-base font-semibold text-gray-700">Subtotal:</span>
          <span className="text-xl font-bold text-blue-600">
            {formatCurrency(getSubtotal())}
          </span>
        </div>
      </div>
    </div>
  )
}