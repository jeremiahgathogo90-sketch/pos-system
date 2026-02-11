import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../libs/supabase'
import { usePOSStore } from '../../../store/usePOSStore'
import { Package, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProductGrid() {
  const addToCart = usePOSStore((state) => state.addToCart)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      return data
    },
  })

  const handleAddToCart = (product: any) => {
    if (product.stock_quantity <= 0) {
      toast.error('Product out of stock!')
      return
    }

    addToCart({
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      price: Number(product.price),
      quantity: 1,
      subtotal: Number(product.price),
      stock_available: product.stock_quantity,
    })

    toast.success(`${product.name} added to cart`)
  }

  // Filter products based on search
  const filteredProducts = products?.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products by name, SKU, or barcode..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {filteredProducts?.map((product) => (
          <button
            key={product.id}
            onClick={() => handleAddToCart(product)}
            className="bg-white rounded-lg shadow hover:shadow-md transition p-3 text-left group"
          >
            <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-lg" />
              ) : (
                <Package className="w-10 h-10 text-gray-400" />
              )}
            </div>
            
            <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition line-clamp-2 text-sm">
              {product.name}
            </h3>
            
            <div className="mt-2 flex items-center justify-between">
              <p className="text-base font-bold text-blue-600">
                KES {Number(product.price).toLocaleString()}
              </p>
              <p className={`text-xs font-semibold ${
                product.stock_quantity <= product.low_stock_threshold 
                  ? 'text-red-600' 
                  : 'text-gray-500'
              }`}>
                {product.stock_quantity}
              </p>
            </div>
          </button>
        ))}
      </div>

      {filteredProducts?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No products found matching "{searchQuery}"</p>
        </div>
      )}
    </div>
  )
}