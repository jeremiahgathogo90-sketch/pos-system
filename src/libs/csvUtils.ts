import type { Product, Category } from '../types/database.types'

export function exportProductsToCSV(products: any[], categories: Category[]) {
  // Create category lookup
  const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]))

  // CSV Headers
  const headers = [
    'Name',
    'SKU',
    'Barcode',
    'Category',
    'Cost Price',
    'Selling Price',
    'Stock Quantity',
    'Low Stock Threshold',
    'Description',
  ]

  // Convert products to CSV rows
  const rows = products.map(product => [
    product.name,
    product.sku,
    product.barcode || '',
    categoryMap.get(product.category_id) || '',
    product.cost,
    product.price,
    product.stock_quantity,
    product.low_stock_threshold,
    product.description || '',
  ])

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma
        const cellStr = String(cell)
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`
        }
        return cellStr
      }).join(',')
    ),
  ].join('\n')

  // Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `products_export_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function downloadCSVTemplate() {
  const headers = [
    'Name',
    'SKU',
    'Barcode',
    'Category',
    'Cost Price',
    'Selling Price',
    'Stock Quantity',
    'Low Stock Threshold',
    'Description',
  ]

  const sampleData = [
    'Coca Cola 500ml',
    'COKE-500',
    '123456789',
    'Beverages',
    '25.00',
    '50.00',
    '100',
    '10',
    'Refreshing cola drink',
  ]

  const csvContent = [headers.join(','), sampleData.join(',')].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', 'product_import_template.csv')
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}