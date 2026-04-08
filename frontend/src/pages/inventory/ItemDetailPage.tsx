import React, { useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import {
  QrCode, MapPin, CheckCircle2, Package,
  DollarSign, Calendar, Hash, Tag, ChevronLeft, ChevronRight, Trash2, Pencil
} from 'lucide-react'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'
import { AppShell } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { MovementTimeline } from '@/components/inventory/MovementTimeline'
import { ItemEditModal } from '@/components/inventory/ItemEditModal'
import { useDeleteItem, useItem, useItemMovements, useItemPhotos } from '@/api/hooks/useItems'
import { formatDate, cn, withAuthToken } from '@/lib/utils'

const conditionVariant: Record<string, 'sage' | 'kraft' | 'rust'> = {
  new: 'sage', excellent: 'sage', good: 'sage', fair: 'kraft',
  poor: 'rust', broken: 'rust', in_repair: 'kraft', lost: 'rust',
  misplaced: 'kraft', shared: 'kraft', stolen: 'rust', archived: 'kraft',
  damaged: 'rust', unknown: 'kraft',
}

function InfoRow({ label, value, icon: Icon }: {
  label: string
  value: React.ReactNode
  icon?: React.ElementType
}) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-kraft-200 last:border-0">
      {Icon && <Icon className="w-4 h-4 text-kraft-400 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-kraft-400 leading-none mb-0.5">{label}</p>
        <p className="text-sm text-kraft-700 font-medium">{value}</p>
      </div>
    </div>
  )
}

function PhotoGallery({ urls }: { urls: string[] }) {
  const [idx, setIdx] = useState(0)
  if (urls.length === 0) return null

  return (
    <div className="relative aspect-video bg-kraft-800 rounded-xl overflow-hidden">
      <img
        src={urls[idx]}
        alt={`Photo ${idx + 1}`}
        className="w-full h-full object-contain"
      />
      {urls.length > 1 && (
        <>
          <button
            onClick={() => setIdx((i) => (i - 1 + urls.length) % urls.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                       bg-kraft-900/60 text-white flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIdx((i) => (i + 1) % urls.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full
                       bg-kraft-900/60 text-white flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {urls.map((_, i) => (
              <div
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  'w-1.5 h-1.5 rounded-full cursor-pointer transition-colors',
                  i === idx ? 'bg-white' : 'bg-white/40'
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ItemDetailPage() {
  const { siteId, itemId } = useParams({ strict: false }) as { siteId?: string; itemId?: string }
  const navigate = useNavigate()
  const [qrOpen, setQrOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const { data: item, isLoading } = useItem(siteId ?? null, itemId ?? null)
  const { data: movements = [] } = useItemMovements(siteId ?? null, itemId ?? null)
  const { data: linkedPhotos = [] } = useItemPhotos(siteId ?? null, itemId ?? null)
  const deleteItem = useDeleteItem(siteId ?? '', itemId ?? '')

  if (isLoading) {
    return (
      <AppShell showBack>
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      </AppShell>
    )
  }

  if (!item) {
    return (
      <AppShell showBack headerTitle="Item not found">
        <div className="flex flex-col items-center py-16 text-center px-4">
          <Package className="w-12 h-12 text-kraft-300 mb-4" />
          <p className="text-kraft-500">This item doesn't exist or was deleted.</p>
        </div>
      </AppShell>
    )
  }

  const isVerified = (item.verification_count ?? 0) >= 2

  // Use all linked photos if available, otherwise fall back to primary
  const photoUrls: string[] = (
    linkedPhotos.length > 0
      ? linkedPhotos.map((p) => p.url)
      : item.primary_photo_url ? [item.primary_photo_url] : []
  ).map((u) => withAuthToken(u) ?? u)

  const serialDisplay = item.serial_numbers?.length ? item.serial_numbers.join(', ') : null
  const priceDisplay = item.purchase_price_cents != null
    ? `$${(item.purchase_price_cents / 100).toFixed(2)} ${item.currency_code}`
    : null

  const handleDeleteItem = async () => {
    if (!siteId || !itemId) return
    const confirmed = window.confirm(`Delete item "${item.name}"? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteItem.mutateAsync()
      toast.success('Item deleted')
      navigate({ to: `/sites/${siteId}/inventory` })
    } catch {
      toast.error('Failed to delete item')
    }
  }

  return (
    <AppShell
      showBack
      headerTitle={item.name}
      headerAction={
        <button
          onClick={() => setQrOpen(true)}
          className="p-2 rounded-xl text-kraft-500 hover:text-kraft-700 hover:bg-kraft-200 transition-colors"
          aria-label="QR code"
        >
          <QrCode className="w-5 h-5" />
        </button>
      }
    >
      <div className="px-4 pt-4 pb-8 space-y-5 max-w-lg mx-auto">

        {/* Photo gallery */}
        {photoUrls.length > 0 ? (
          <PhotoGallery urls={photoUrls} />
        ) : (
          <div className="aspect-video bg-kraft-100 border border-kraft-200 rounded-xl
                          flex items-center justify-center">
            <Package className="w-12 h-12 text-kraft-300" />
          </div>
        )}

        {/* Name + badges */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-kraft-800 leading-tight">{item.name}</h1>
            {isVerified && (
              <CheckCircle2 className="w-6 h-6 text-accent-sage flex-shrink-0 mt-0.5" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.category && <span className="tag">{item.category}</span>}
            <Badge variant={conditionVariant[item.condition] ?? 'kraft'}>{item.condition}</Badge>
          </div>
          {item.description && (
            <p className="text-sm text-kraft-500 mt-2">{item.description}</p>
          )}
        </div>

        {/* Identity section */}
        <div className="card">
          <p className="section-title">Identity</p>
          <InfoRow label="Brand"         value={item.brand}     icon={Tag} />
          <InfoRow label="Model"         value={item.model}     icon={Package} />
          <InfoRow label="Serial number" value={serialDisplay}  icon={Hash} />
          <InfoRow
            label="Quantity"
            value={item.quantity > 1 ? `${item.quantity}` : null}
            icon={Package}
          />
        </div>

        {/* Location */}
        {item.location_path && (
          <div className="card">
            <p className="section-title">Location</p>
            <div className="flex items-center gap-2 py-1">
              <MapPin className="w-4 h-4 text-kraft-400" />
              <span className="text-sm text-kraft-700">{item.location_path}</span>
            </div>
          </div>
        )}

        {/* Purchase info */}
        {(item.purchase_date || item.purchase_price_cents) && (
          <div className="card">
            <p className="section-title">Purchase</p>
            <InfoRow
              label="Purchase date"
              value={item.purchase_date ? formatDate(item.purchase_date) : null}
              icon={Calendar}
            />
            <InfoRow
              label="Purchase price"
              value={priceDisplay}
              icon={DollarSign}
            />
          </div>
        )}

        {/* Tags */}
        {item.custom_tags && item.custom_tags.length > 0 && (
          <div className="card">
            <p className="section-title">Tags</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {item.custom_tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div className="card">
            <p className="section-title">Notes</p>
            <p className="text-sm text-kraft-600 whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}

        {/* Movement history */}
        {movements.length > 0 && (
          <div className="card">
            <p className="section-title">Movement history</p>
            <MovementTimeline movements={movements} />
          </div>
        )}

        {/* Verification status */}
        <div className="card">
          <p className="section-title">Verification</p>
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center',
              isVerified ? 'bg-accent-sage/15' : 'bg-kraft-200'
            )}>
              <CheckCircle2 className={cn(
                'w-4 h-4',
                isVerified ? 'text-accent-sage' : 'text-kraft-400'
              )} />
            </div>
            <div>
              <p className="text-sm font-medium text-kraft-700">
                {isVerified ? 'Verified' : 'Unverified'}
              </p>
              <p className="text-xs text-kraft-400">
                {item.verification_count} verification{item.verification_count !== 1 ? 's' : ''}
                {!isVerified && ' · needs 2 to verify'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <p className="section-title">Actions</p>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex-1 bg-[#c8a97e] hover:bg-[#b8976a] text-white border-0"
            >
              <Pencil className="w-4 h-4 mr-1.5 inline-block" />
              Edit
            </Button>
            <Button
              type="button"
              variant="rust"
              leftIcon={<Trash2 className="w-4 h-4" />}
              onClick={handleDeleteItem}
              loading={deleteItem.isPending}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {item && (
        <ItemEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          siteId={siteId!}
          item={item}
        />
      )}

      {/* QR Modal */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="Item QR Code" size="sm">
        <div className="flex flex-col items-center gap-4 px-5 pb-6">
          <div className="p-4 bg-white rounded-xl border border-kraft-200">
            <QRCodeSVG
              value={`inventorysnap://item/${siteId}/${itemId}`}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-kraft-700">{item.name}</p>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}
