import { useRef, useEffect } from 'react'
import { X, Printer } from 'lucide-react'

interface ReceiptItem {
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}

interface ReceiptProps {
  isOpen: boolean
  onClose: () => void
  onNewSale?: () => void
  saleData: {
    sale_number: string
    cashier_name: string
    customer_name?: string
    items: ReceiptItem[]
    subtotal: number
    tax_amount: number
    discount_amount: number
    total: number
    cash_amount?: number | null
    card_amount?: number | null
    credit_amount?: number | null
    change_amount?: number | null
    created_at: string
  }
  storeInfo?: {
    store_name?: string
    name?: string
    address?: string
    phone?: string
    receipt_footer?: string
  }
  autoPrint?: boolean
}

export default function ReceiptModal({
  isOpen,
  onClose,
  onNewSale,
  saleData,
  storeInfo,
  autoPrint = true,
}: ReceiptProps) {
  const componentRef = useRef<HTMLDivElement>(null)

  // Auto-print when modal opens
  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        handlePrint()
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Safe number formatter - handles undefined, null, NaN
  const fmt = (amount: number | null | undefined): string => {
    const num = Number(amount ?? 0)
    if (isNaN(num)) return 'KES 0.00'
    return `KES ${num.toLocaleString('en-KE', { minimumFractionDigits: 2 })}`
  }

  const handlePrint = () => {
    const receiptContent = componentRef.current?.innerHTML
    if (!receiptContent) return

    const printWindow = window.open('', '_blank', 'width=400,height=600')
    if (!printWindow) {
      alert('Please allow popups to print receipts')
      return
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${saleData.sale_number}</title>
          <style>
            @media print {
              @page { size: 80mm auto; margin: 2mm; }
              body { margin: 0; }
            }
            body {
              font-family: 'Courier New', monospace;
              width: 76mm;
              margin: 0 auto;
              font-size: 12px;
            }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 3px 2px; font-size: 11px; }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .dashed { border-top: 1px dashed #000; margin: 4px 0; }
            .solid { border-top: 2px solid #000; margin: 4px 0; }
          </style>
        </head>
        <body>
          ${receiptContent}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleNewSale = () => {
    onNewSale?.()
    onClose()
  }

  // Guard — never render if saleData is missing
  if (!isOpen || !saleData) return null

  // Safe values with fallbacks
  const cashAmount   = Number(saleData.cash_amount   ?? 0)
  const cardAmount   = Number(saleData.card_amount   ?? 0)
  const creditAmount = Number(saleData.credit_amount ?? 0)
  const changeAmount = Number(saleData.change_amount ?? 0)
  const subtotal     = Number(saleData.subtotal      ?? 0)
  const taxAmount    = Number(saleData.tax_amount    ?? 0)
  const discount     = Number(saleData.discount_amount ?? 0)
  const total        = Number(saleData.total         ?? 0)
  const storeName    = storeInfo?.store_name || storeInfo?.name || 'STORE NAME'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-green-50 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-green-700">✅ Sale Completed!</h2>
            <p className="text-xs text-green-600 mt-0.5">#{saleData.sale_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Preview */}
        <div className="p-4 bg-gray-50 max-h-[55vh] overflow-y-auto">
          <div
            ref={componentRef}
            style={{ fontFamily: 'Courier New, monospace', fontSize: '12px', width: '100%' }}
          >
            {/* Store Header */}
            <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '8px', marginBottom: '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{storeName}</div>
              {storeInfo?.address && <div style={{ fontSize: '11px' }}>{storeInfo.address}</div>}
              {storeInfo?.phone   && <div style={{ fontSize: '11px' }}>Tel: {storeInfo.phone}</div>}
            </div>

            {/* Sale Info */}
            <div style={{ fontSize: '11px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Receipt #:</span>
                <strong>{saleData.sale_number}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Date:</span>
                <span>{new Date(saleData.created_at).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cashier:</span>
                <span>{saleData.cashier_name}</span>
              </div>
              {saleData.customer_name && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Customer:</span>
                  <span>{saleData.customer_name}</span>
                </div>
              )}
            </div>

            {/* Dashed line */}
            <div style={{ borderTop: '1px dashed black', margin: '6px 0' }}></div>

            {/* Items Table */}
            <table style={{ width: '100%', fontSize: '11px', marginBottom: '6px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid black' }}>
                  <th style={{ textAlign: 'left', padding: '2px' }}>Item</th>
                  <th style={{ textAlign: 'center', padding: '2px' }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '2px' }}>Price</th>
                  <th style={{ textAlign: 'right', padding: '2px' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(saleData.items || []).map((item, index) => (
                  <tr key={index} style={{ borderBottom: '1px dotted #ccc' }}>
                    <td style={{ padding: '2px' }}>{item.product_name}</td>
                    <td style={{ textAlign: 'center', padding: '2px' }}>{item.quantity}</td>
                    <td style={{ textAlign: 'right', padding: '2px' }}>{fmt(item.unit_price)}</td>
                    <td style={{ textAlign: 'right', padding: '2px', fontWeight: 'bold' }}>{fmt(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Solid line */}
            <div style={{ borderTop: '2px solid black', margin: '6px 0' }}></div>

            {/* Totals */}
            <div style={{ fontSize: '11px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span><span>{fmt(subtotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tax (16%):</span><span>{fmt(taxAmount)}</span>
              </div>
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'green' }}>
                  <span>Discount:</span><span>-{fmt(discount)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', borderTop: '2px solid black', marginTop: '4px', paddingTop: '4px' }}>
                <span>TOTAL:</span><span>{fmt(total)}</span>
              </div>
            </div>

            {/* Dashed line */}
            <div style={{ borderTop: '1px dashed black', margin: '6px 0' }}></div>

            {/* Payment Details */}
            <div style={{ fontSize: '11px', marginBottom: '6px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>PAYMENT METHOD:</div>
              {cashAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Cash:</span><span>{fmt(cashAmount)}</span>
                </div>
              )}
              {cardAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Card/Bank:</span><span>{fmt(cardAmount)}</span>
                </div>
              )}
              {creditAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Credit:</span><span>{fmt(creditAmount)}</span>
                </div>
              )}
              {changeAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #ccc', marginTop: '4px', paddingTop: '4px' }}>
                  <span>CHANGE:</span><span>{fmt(changeAmount)}</span>
                </div>
              )}
            </div>

            {/* Solid line */}
            <div style={{ borderTop: '2px solid black', margin: '8px 0' }}></div>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '11px' }}>
              <div style={{ fontWeight: 'bold' }}>THANK YOU FOR YOUR BUSINESS!</div>
              {storeInfo?.receipt_footer && (
                <div style={{ marginTop: '4px' }}>{storeInfo.receipt_footer}</div>
              )}
              <div style={{ marginTop: '4px', color: '#666' }}>Goods once sold are not refundable</div>
              <div style={{ marginTop: '8px', background: 'black', color: 'white', padding: '4px 8px', display: 'inline-block', fontFamily: 'monospace' }}>
                {saleData.sale_number}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t space-y-2">
          {/* Primary: New Sale */}
          <button
            onClick={handleNewSale}
            className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-xl hover:bg-green-700 transition shadow-lg"
          >
            ✓ New Sale
          </button>

          {/* Secondary */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 py-2.5 border-2 border-blue-500 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition"
            >
              <Printer className="w-4 h-4" />
              Print Again
            </button>
            <button
              onClick={onClose}
              className="py-2.5 border-2 border-gray-300 text-gray-600 rounded-lg font-medium hover:bg-gray-50 transition"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}