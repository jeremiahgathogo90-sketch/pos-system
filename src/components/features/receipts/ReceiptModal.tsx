import { useEffect, useRef } from 'react'
import { X, Printer, ShoppingCart } from 'lucide-react'

interface ReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  onNewSale: () => void
  saleData: any
  storeInfo?: any
  autoPrint?: boolean
}

export default function ReceiptModal({
  isOpen,
  onClose,
  onNewSale,
  saleData,
  storeInfo,
  autoPrint = false
}: ReceiptModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null)

  // Auto-print when modal opens
  useEffect(() => {
    if (isOpen && autoPrint && receiptRef.current) {
      // Delay print to ensure DOM is ready
      const timer = setTimeout(() => {
        handlePrint()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isOpen, autoPrint])

  const handlePrint = () => {
    console.log('🖨️ Print button clicked')
    if (receiptRef.current) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Receipt - ${saleData?.sale_number || 'SALE'}</title>
              <style>
                @media print {
                  @page { 
                    margin: 0;
                    size: 80mm auto;
                  }
                  body { 
                    margin: 0;
                    padding: 0;
                  }
                }
                body {
                  font-family: 'Courier New', monospace;
                  width: 80mm;
                  margin: 0 auto;
                  padding: 5mm;
                  font-size: 12px;
                }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .large { font-size: 16px; }
                .divider { 
                  border-top: 1px dashed #000; 
                  margin: 8px 0; 
                }
                table { 
                  width: 100%; 
                  border-collapse: collapse; 
                }
                td { 
                  padding: 2px 0; 
                }
                .right { text-align: right; }
              </style>
            </head>
            <body>
              ${receiptRef.current.innerHTML}
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        printWindow.print()
        printWindow.close()
      }
    }
  }

  const handleNewSale = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('🆕 New Sale button clicked')
    onNewSale() // This should clear cart and close modal
  }

  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    console.log('❌ Close button clicked')
    onClose()
  }

  const fmt = (amount: number) => {
    const num = Number(amount) || 0
    return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  if (!isOpen || !saleData) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        // Only close if clicking the backdrop
        if (e.target === e.currentTarget) {
          handleCloseClick(e)
        }
      }}
    >
      <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-green-50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-green-900">Sale Completed!</h2>
              <p className="text-sm text-green-700">#{saleData.sale_number}</p>
            </div>
          </div>
          <button
            onClick={handleCloseClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            type="button"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Receipt Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4">
          <div 
            ref={receiptRef}
            className="bg-white font-mono text-sm"
            style={{ width: '80mm', margin: '0 auto' }}
          >
            {/* Store Header */}
            <div className="text-center mb-4">
              <div className="text-lg font-bold">{storeInfo?.store_name || 'OTC'}</div>
              <div className="text-xs mt-1">occ lane</div>
              <div className="text-xs">Tel: {storeInfo?.phone || '0798111111'}</div>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Receipt Details */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Receipt #:</span>
                <span className="font-bold">{saleData.sale_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(saleData.created_at).toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{saleData.cashier_name || 'Cashier'}</span>
              </div>
              {saleData.customer_name && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{saleData.customer_name}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Items Table */}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="text-left py-1">Item</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">Price</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {saleData.items?.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className="py-1">{item.product_name}</td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">{fmt(item.unit_price)}</td>
                    <td className="text-right font-bold">{fmt(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Totals */}
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{fmt(saleData.subtotal)}</span>
              </div>
              {saleData.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span>Tax (16%):</span>
                  <span>{fmt(saleData.tax_amount)}</span>
                </div>
              )}
              {saleData.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span>-{fmt(saleData.discount_amount)}</span>
                </div>
              )}
            </div>

            <div className="border-t-2 border-gray-800 my-2" />

            <div className="text-base font-bold flex justify-between mb-2">
              <span>TOTAL:</span>
              <span>{fmt(saleData.total)}</span>
            </div>

            <div className="border-t border-dashed border-gray-400 my-2" />

            {/* Payment Method */}
            <div className="text-xs">
              <div className="font-bold mb-1">PAYMENT METHOD:</div>
              {saleData.cash_amount > 0 && (
                <div className="flex justify-between">
                  <span>Cash:</span>
                  <span>{fmt(saleData.cash_amount)}</span>
                </div>
              )}
              {saleData.card_amount > 0 && (
                <div className="flex justify-between">
                  <span>Card/Bank:</span>
                  <span>{fmt(saleData.card_amount)}</span>
                </div>
              )}
              {saleData.credit_amount > 0 && (
                <div className="flex justify-between">
                  <span>Credit:</span>
                  <span>{fmt(saleData.credit_amount)}</span>
                </div>
              )}
              {saleData.change_amount > 0 && (
                <div className="flex justify-between font-bold mt-1">
                  <span>Change:</span>
                  <span>{fmt(saleData.change_amount)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-400 my-3" />

            {/* Footer */}
            <div className="text-center text-xs space-y-1">
              <div className="font-bold">Thank you for your business!</div>
              <div>Please come again</div>
              {storeInfo?.receipt_footer && (
                <div className="mt-2">{storeInfo.receipt_footer}</div>
              )}
            </div>

            {/* Barcode placeholder */}
            <div className="text-center mt-3 text-xs">
              <div className="font-mono tracking-wider">{saleData.sale_number}</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t bg-gray-50 space-y-2">
          {/* New Sale Button */}
          <button
            onClick={handleNewSale}
            type="button"
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5" />
            New Sale
          </button>

          {/* Bottom Row - Print and Close */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrint}
              type="button"
              className="py-3 border-2 border-blue-600 text-blue-600 bg-white rounded-lg hover:bg-blue-50 transition font-semibold flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Printer className="w-5 h-5" />
              Print Again
            </button>
            
            <button
              onClick={handleCloseClick}
              type="button"
              className="py-3 border-2 border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition font-semibold active:scale-95 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
