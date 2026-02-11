import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../libs/supabase'
import { Plus, Edit, Trash2, Search, DollarSign, CreditCard } from 'lucide-react'
import CustomerFormModal from '../components/features/customers/CustomerFormModal'
import toast from 'react-hot-toast'

export default function CustomersPage() {
  const queryClient = useQueryClient()
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [editingCustomerId, setEditingCustomerId] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Customer deleted!')
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete customer')
    },
  })

  const filteredCustomers = customers?.filter(customer =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalCustomers = customers?.length || 0
  const customersWithCredit = customers?.filter(c => c.outstanding_balance > 0).length || 0
  const totalOutstanding = customers?.reduce((sum, c) => sum + Number(c.outstanding_balance), 0) || 0

  const formatCurrency = (amount: number) => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const handleEdit = (customerId: string) => {
    setEditingCustomerId(customerId)
    setShowCustomerForm(true)
  }

  const handleAddNew = () => {
    setEditingCustomerId(undefined)
    setShowCustomerForm(true)
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
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage customer information and credit accounts</p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Customers</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{totalCustomers}</p>
            </div>
            <div className="p-4 bg-blue-100 rounded-full">
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">With Outstanding Credit</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">{customersWithCredit}</p>
            </div>
            <div className="p-4 bg-orange-100 rounded-full">
              <CreditCard className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Outstanding</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {formatCurrency(totalOutstanding)}
              </p>
            </div>
            <div className="p-4 bg-red-100 rounded-full">
              <DollarSign className="w-8 h-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers by name or phone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit Limit</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers?.map(customer => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      {customer.email && (
                        <p className="text-sm text-gray-500">{customer.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {customer.phone || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-right text-gray-900">
                    {formatCurrency(Number(customer.credit_limit))}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex px-2 py-1 text-sm font-semibold rounded-full ${
                      Number(customer.outstanding_balance) > 0
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {formatCurrency(Number(customer.outstanding_balance))}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(customer.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete customer "${customer.name}"?`)) {
                            deleteMutation.mutate(customer.id)
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

      <CustomerFormModal
        isOpen={showCustomerForm}
        onClose={() => {
          setShowCustomerForm(false)
          setEditingCustomerId(undefined)
        }}
        customerId={editingCustomerId}
      />
    </div>
  )
}