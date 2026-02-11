import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { Plus, Edit, Trash2, Search, Truck } from 'lucide-react'
import SupplierFormModal from '../components/features/suppliers/SupplierFormModal'
import toast from 'react-hot-toast'

export default function SuppliersPage() {
  const queryClient = useQueryClient()
  const [showSupplierForm, setShowSupplierForm] = useState(false)
  const [editingSupplierId, setEditingSupplierId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: suppliers, isLoading } = useQuery({
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('suppliers')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Supplier deleted!')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete supplier')
    },
  })

  const filteredSuppliers = suppliers?.filter(supplier =>
    supplier.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalSuppliers = suppliers?.length || 0
  const totalDebt = suppliers?.reduce((sum, s) => sum + Number(s.outstanding_debt), 0) || 0

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="text-gray-500 mt-1">Manage supplier information and outstanding debts</p>
        </div>
        <button
          onClick={() => setShowSupplierForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add Supplier
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Suppliers</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalSuppliers}</p>
            </div>
            <div className="p-4 bg-blue-100 rounded-full">
              <Truck className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Outstanding Debt</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {formatCurrency(totalDebt)}
              </p>
            </div>
            <div className="p-4 bg-red-100 rounded-full">
              <Truck className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suppliers..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding Debt</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSuppliers?.map(supplier => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{supplier.name}</p>
                      {supplier.contact_person && (
                        <p className="text-sm text-gray-500">{supplier.contact_person}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      {supplier.phone && <p className="text-gray-900">{supplier.phone}</p>}
                      {supplier.email && <p className="text-gray-500">{supplier.email}</p>}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                      Number(supplier.outstanding_debt) > 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {formatCurrency(Number(supplier.outstanding_debt))}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditingSupplierId(supplier.id)
                          setShowSupplierForm(true)
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete supplier "${supplier.name}"?`)) {
                            deleteMutation.mutate(supplier.id)
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

      <SupplierFormModal
        isOpen={showSupplierForm}
        onClose={() => {
          setShowSupplierForm(false)
          setEditingSupplierId(undefined)
        }}
        supplierId={editingSupplierId}
      />
    </div>
  )
}