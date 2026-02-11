import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../libs/supabase'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CategoryManager() {
  const queryClient = useQueryClient()
  const [newCategory, setNewCategory] = useState('')
  const [showForm, setShowForm] = useState(false)

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

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('categories')
        .insert({ name })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Category added!')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setNewCategory('')
      setShowForm(false)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add category')
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Category deleted!')
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: (error: any) => {
      toast.error(error.message || 'Cannot delete category with products')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newCategory.trim()) {
      addCategory.mutate(newCategory.trim())
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Categories</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Category name"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={addCategory.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Save
          </button>
        </form>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {categories?.map((category) => (
          <div
            key={category.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
          >
            <span className="font-medium text-gray-900">{category.name}</span>
            <button
              onClick={() => {
                if (confirm(`Delete category "${category.name}"?`)) {
                  deleteCategory.mutate(category.id)
                }
              }}
              className="text-red-500 hover:text-red-700 p-1"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}