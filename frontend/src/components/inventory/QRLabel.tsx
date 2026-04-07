import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Item } from '@/lib/types'

interface QRLabelProps {
  item: Item
  siteId: string
  open: boolean
  onClose: () => void
}

export function QRLabel({ item, siteId, open, onClose }: QRLabelProps) {
  const printRef = useRef<HTMLDivElement>(null)

  const qrValue = `${window.location.origin}/sites/${siteId}/inventory/${item.id}`

  const handlePrint = () => {
    if (!printRef.current) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Label — ${item.name}</title>
          <style>
            body { margin: 0; padding: 16px; font-family: sans-serif; }
            .label { border: 2px solid #4a3320; border-radius: 8px; padding: 12px; max-width: 200px; }
            .name { font-size: 11px; font-weight: bold; margin: 4px 0; word-break: break-word; }
            .meta { font-size: 9px; color: #6b4f32; margin: 2px 0; }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
        </body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  return (
    <Modal open={open} onClose={onClose} title="QR Label">
      <div className="flex flex-col items-center gap-4">
        {/* Preview */}
        <div
          ref={printRef}
          className="label border-2 border-kraft-700 rounded-xl p-4 flex flex-col items-center gap-3 w-48"
        >
          <QRCodeSVG
            value={qrValue}
            size={120}
            level="M"
            includeMargin={false}
            fgColor="#2d1f12"
          />
          <div className="text-center">
            <p className="name text-xs font-bold text-kraft-800 leading-tight">{item.name}</p>
            {item.category && (
              <p className="meta text-xs text-kraft-500 mt-0.5">{item.category}</p>
            )}
            {item.serial_numbers?.[0] && (
              <p className="meta text-xs text-kraft-400 mt-0.5 font-mono">
                S/N: {item.serial_numbers[0]}
              </p>
            )}
            {item.location_path && (
              <p className="meta text-xs text-kraft-400 mt-0.5">{item.location_path}</p>
            )}
            <p className="meta text-xs text-kraft-300 mt-1 font-mono break-all">
              {item.id.slice(0, 8)}...
            </p>
          </div>
        </div>

        <p className="text-xs text-kraft-400 text-center max-w-xs">
          Scan to open this item in Inventory Snap
        </p>

        <div className="flex gap-2 w-full">
          <Button variant="primary" onClick={handlePrint} className="flex-1">
            <Printer size={14} /> Print label
          </Button>
          <Button variant="ghost" onClick={onClose}>
            <X size={14} />
          </Button>
        </div>
      </div>
    </Modal>
  )
}
