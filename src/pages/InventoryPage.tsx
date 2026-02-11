import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { Plus, Edit, Trash2, Download, Upload, Search, AlertTriangle } from 'lucide-react'
import ProductFormModal from '../components/features/inventory/ProductFormModal'
import CSVImport from '../components/features/inventory/CSVImport'
import CategoryManager from '../components/features/inventory/CategoryManager'
import { exportProductsToCSV } from '../libs/csvUtils'
import toast from 'react-hot-toast'

export default function InventoryPage() {
  const queryClient = useQueryClient()
  const [showProductForm, setShowProductForm] = useState(false)
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [editingProductId, setEditingProductId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name)')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  // Delete product
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Product deleted!')
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete product')
    },
  })

  // Filter products
  const filteredProducts = products?.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || product.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Calculate stats
  const totalProducts = products?.length || 0
  const lowStockCount = products?.filter(p => p.stock_quantity <= p.low_stock_threshold).length || 0
  const totalValue = products?.reduce((sum, p) => sum + (p.price * p.stock_quantity), 0) || 0

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const handleExport = () => {
    if (!products || !categories) return
    exportProductsToCSV(products, categories)
    toast.success('Products exported!')
  }

  const handleEdit = (productId: string) => {
    setEditingProductId(productId)
    setShowProductForm(true)
  }

  const handleAddNew = () => {
    setEditingProductId(undefined)
    setShowProductForm(true)
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-500 mt-1">Manage products, stock levels, and categories</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCSVImport(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Upload className="w-5 h-5" />
            Import CSV
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </button>
          <button
            onClick={handleAddNew}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Products</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalProducts}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Low Stock Items</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{lowStockCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-500">Total Stock Value</p>
          <p className="text-3xl font-bold text-green-600 mt-2">
            {formatCurrency(totalValue)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category Manager - Left Sidebar */}
        <div className="lg:col-span-1">
          <CategoryManager />
        </div>

        {/* Products Table - Main Area */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow">
          {/* Search & Filter */}
          <div className="p-6 border-b border-gray-200 space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name or SKU..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Products Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProducts?.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {product.stock_quantity <= product.low_stock_threshold && (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-gray-500 line-clamp-1">{product.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{product.sku}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {product.categories?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(Number(product.price))}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                        product.stock_quantity <= product.low_stock_threshold
                          ? 'bg-red-100 text-red-800'
                          : product.stock_quantity <= product.low_stock_threshold * 2
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(product.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${product.name}"?`)) {
                              deleteMutation.mutate(product.id)
                            }
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductFormModal
        isOpen={showProductForm}
        onClose={() => {
          setShowProductForm(false)
          setEditingProductId(undefined)
        }}
        productId={editingProductId}
      />
      
      <CSVImport
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
      />
    </div>
  )
}