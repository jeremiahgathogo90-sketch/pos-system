import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../libs/supabase'
import { Upload, Download, FileText, X } from 'lucide-react'
import { downloadCSVTemplate } from '../../../libs/csvUtils'
import toast from 'react-hot-toast'

interface CSVImportProps {
  isOpen: boolean
  onClose: () => void
}

export default function CSVImport({ isOpen, onClose }: CSVImportProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
      if (error) throw error
      return data
    },
  })

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      throw new Error('CSV file is empty or invalid')
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))

    // Parse rows
    const rows = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      
      return {
        rowNumber: index + 2,
        name: values[0] || '',
        sku: values[1] || '',
        barcode: values[2] || null,
        category: values[3] || '',
        cost: parseFloat(values[4]) || 0,
        price: parseFloat(values[5]) || 0,
        stock: parseInt(values[6]) || 0,
        threshold: parseInt(values[7]) || 10,
        description: values[8] || null,
      }
    })

    return rows
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setErrors([])

    try {
      const text = await selectedFile.text()
      const parsed = parseCSV(text)
      setPreview(parsed.slice(0, 5)) // Show first 5 rows
    } catch (error: any) {
      toast.error(error.message)
      setFile(null)
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file || !categories) throw new Error('Missing file or categories')

      const text = await file.text()
      const rows = parseCSV(text)
      
      const validationErrors: string[] = []
      const productsToInsert: any[] = []

      // Create category lookup
      const categoryMap = new Map(
        categories.map(cat => [cat.name.toLowerCase(), cat.id])
      )

      // Validate and prepare products
      rows.forEach(row => {
        // Validation
        if (!row.name) {
          validationErrors.push(`Row ${row.rowNumber}: Missing product name`)
          return
        }
        if (!row.sku) {
          validationErrors.push(`Row ${row.rowNumber}: Missing SKU`)
          return
        }
        if (!row.category) {
          validationErrors.push(`Row ${row.rowNumber}: Missing category`)
          return
        }

        const categoryId = categoryMap.get(row.category.toLowerCase())
        if (!categoryId) {
          validationErrors.push(`Row ${row.rowNumber}: Category "${row.category}" not found`)
          return
        }

        if (row.price <= 0) {
          validationErrors.push(`Row ${row.rowNumber}: Invalid price`)
          return
        }

        // Prepare product
        productsToInsert.push({
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          category_id: categoryId,
          cost: row.cost,
          price: row.price,
          stock_quantity: row.stock,
          low_stock_threshold: row.threshold,
          description: row.description,
        })
      })

      if (validationErrors.length > 0) {
        setErrors(validationErrors)
        throw new Error(`${validationErrors.length} validation errors found`)
      }

      // Insert products
      const { error } = await supabase
        .from('products')
        .insert(productsToInsert)

      if (error) throw error

      return productsToInsert.length
    },
    onSuccess: (count) => {
      toast.success(`Successfully imported ${count} products!`)
      queryClient.invalidateQueries({ queryKey: ['products'] })
      onClose()
      setFile(null)
      setPreview([])
      setErrors([])
    },
    onError: (error: any) => {
      toast.error(error.message || 'Import failed')
    },
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Import Products from CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Download Template */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">Need a template?</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Download our CSV template with sample data and correct format
                </p>
                <button
                  onClick={downloadCSVTemplate}
                  className="mt-3 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">
                Preview (First 5 rows)
              </h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">SKU</th>
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-right">Price</th>
                      <th className="px-4 py-2 text-right">Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2">{row.name}</td>
                        <td className="px-4 py-2">{row.sku}</td>
                        <td className="px-4 py-2">{row.category}</td>
                        <td className="px-4 py-2 text-right">{row.price}</td>
                        <td className="px-4 py-2 text-right">{row.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2">
                Validation Errors ({errors.length})
              </h3>
              <ul className="text-sm text-red-700 space-y-1 max-h-40 overflow-y-auto">
                {errors.map((error, i) => (
                  <li key={i}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => importMutation.mutate()}
              disabled={!file || importMutation.isPending || errors.length > 0}
              className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              {importMutation.isPending ? 'Importing...' : 'Import Products'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}