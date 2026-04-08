import { useState, useRef, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { X, MapPin, Tag, Trash2, Plus, ChevronDown, PackagePlus, Archive, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { useDeletePhoto, usePhotoDetail, usePinItem, useUnpinItem, useUpdatePhotoLocation } from '@/api/hooks/usePhotos'
import { useItems, useCreateItem } from '@/api/hooks/useItems'
import { useLocationFlat } from '@/api/hooks/useLocations'
import type { PhotoOut, PhotoPin } from '@/lib/types'
import { cn, withAuthToken } from '@/lib/utils'

// ── Bounding-box overlay ──────────────────────────────────────────────────────

function PinOverlay({
  pins,
  onPinEdit,
  editingPinId,
  pendingBbox,
  canEdit,
}: {
  pins: PhotoPin[]
  onPinEdit?: (pin: PhotoPin) => void
  editingPinId?: string | null
  pendingBbox: { x: number; y: number; w: number; h: number } | null
  canEdit: boolean
}) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {pins.map((pin) => {
        if (!pin.annotation_bbox) return null
        const { x, y, width, height } = pin.annotation_bbox
        const isPointPin = width <= 0.015 && height <= 0.015
        const pointX = (x + width / 2) * 100
        const pointY = (y + height / 2) * 100
        const isEditing = pin.pin_id === editingPinId
        const color = isEditing ? '#d97706' : '#4a7c59'
        const fillColor = isEditing ? 'rgba(217,119,6,0.15)' : 'rgba(74,124,89,0.15)'
        return (
          <g key={pin.pin_id} style={{ pointerEvents: canEdit ? 'all' : 'none' }}>
            {isPointPin ? (
              <>
                <circle
                  cx={`${pointX}%`}
                  cy={`${pointY}%`}
                  r="7"
                  fill={color}
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="2"
                />
                <circle
                  cx={`${pointX}%`}
                  cy={`${pointY}%`}
                  r="2.5"
                  fill="white"
                />
              </>
            ) : (
              <rect
                x={`${x * 100}%`}
                y={`${y * 100}%`}
                width={`${width * 100}%`}
                height={`${height * 100}%`}
                fill={fillColor}
                stroke={color}
                strokeWidth={isEditing ? 2 : 1.5}
                strokeDasharray={isEditing ? '5 3' : undefined}
                rx="3"
              />
            )}
            <foreignObject
              x={isPointPin ? `${pointX}%` : `${x * 100}%`}
              y={isPointPin ? `${pointY}%` : `${(y + height) * 100}%`}
              width="120"
              height="22"
              style={{ overflow: 'visible' }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 4,
                         background: color, borderRadius: 4, padding: '2px 6px',
                         pointerEvents: 'all', cursor: canEdit ? 'pointer' : 'default',
                         width: 'max-content' }}
                onClick={(e) => { e.stopPropagation(); canEdit && onPinEdit?.(pin) }}
              >
                <span style={{ color: 'white', fontSize: 10, fontWeight: 600, lineHeight: 1.3 }}>
                  {pin.item_name}
                </span>
                {canEdit && (
                  <Pencil style={{ width: 9, height: 9, color: 'rgba(255,255,255,0.8)', flexShrink: 0 }} />
                )}
              </div>
            </foreignObject>
          </g>
        )
      })}

      {/* In-progress drawing box */}
      {pendingBbox && (
        <rect
          x={`${pendingBbox.x * 100}%`}
          y={`${pendingBbox.y * 100}%`}
          width={`${pendingBbox.w * 100}%`}
          height={`${pendingBbox.h * 100}%`}
          fill="rgba(192,86,42,0.1)"
          stroke="#c0562a"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          rx="3"
        />
      )}
    </svg>
  )
}

// ── Item search / pin sheet ───────────────────────────────────────────────────

function PinItemSheet({
  siteId,
  photoId,
  existingItemIds,
  pendingBbox,
  onPinned,
  onCancel,
}: {
  siteId: string
  photoId: string
  existingItemIds: Set<string>
  pendingBbox: { x: number; y: number; width: number; height: number } | null
  onPinned: () => void
  onCancel: () => void
}) {
  const [tab, setTab]         = useState<'search' | 'create'>('search')
  const [search, setSearch]   = useState('')
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat]   = useState('')

  const pinItem    = usePinItem(siteId)
  const createItem = useCreateItem(siteId)
  const { data: itemData } = useItems(siteId, { search, size: 30 })
  const items = itemData?.items ?? []
  const isPointPin = !!pendingBbox && pendingBbox.width <= 0.015 && pendingBbox.height <= 0.015

  const handlePin = async (itemId: string) => {
    try {
      await pinItem.mutateAsync({ photoId, itemId, annotationBbox: pendingBbox, setAsPrimary: false })
      toast.success('Item pinned')
      onPinned()
    } catch {
      toast.error('Failed to pin item')
    }
  }

  const handleCreateAndPin = async () => {
    if (!newName.trim()) { toast.error('Name is required'); return }
    try {
      const created = await createItem.mutateAsync({
        name: newName.trim(),
        category: newCat.trim() || undefined,
      } as any)
      await pinItem.mutateAsync({ photoId, itemId: created.id, annotationBbox: pendingBbox, setAsPrimary: true })
      toast.success(`"${created.name}" created and pinned`)
      onPinned()
    } catch {
      toast.error('Failed to create item')
    }
  }

  const busy = pinItem.isPending || createItem.isPending

  return (
    <div className="bg-kraft-50 border-t border-kraft-200 rounded-t-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-kraft-700">
          {pendingBbox ? (isPointPin ? 'Pin item to location' : 'Pin item to selection') : 'Pin item to photo'}
        </p>
        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-kraft-100">
          <X className="w-4 h-4 text-kraft-500" />
        </button>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 bg-kraft-200 rounded-xl p-1">
        <button
          onClick={() => setTab('search')}
          className={cn(
            'flex-1 text-xs font-medium py-1.5 rounded-lg transition-colors',
            tab === 'search' ? 'bg-white text-kraft-700 shadow-sm' : 'text-kraft-500'
          )}
        >
          Search inventory
        </button>
        <button
          onClick={() => setTab('create')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-lg transition-colors',
            tab === 'create' ? 'bg-white text-kraft-700 shadow-sm' : 'text-kraft-500'
          )}
        >
          <PackagePlus className="w-3.5 h-3.5" />
          Quick create
        </button>
      </div>

      {tab === 'search' ? (
        <>
          <input
            autoFocus
            className="input text-sm"
            placeholder="Search inventory…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {items.length === 0 && (
              <p className="text-xs text-kraft-400 text-center py-4">No items found</p>
            )}
            {items.map((item) => {
              const alreadyPinned = existingItemIds.has(item.id)
              return (
                <button
                  key={item.id}
                  disabled={alreadyPinned || busy}
                  onClick={() => handlePin(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors',
                    alreadyPinned
                      ? 'opacity-40 cursor-not-allowed bg-kraft-100'
                      : 'hover:bg-kraft-100 active:bg-kraft-200'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-kraft-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {item.primary_photo_url ? (
                      <img src={withAuthToken(item.primary_photo_url) ?? ''} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Tag className="w-4 h-4 text-kraft-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-kraft-700 truncate">{item.name}</p>
                    {item.category && <p className="text-xs text-kraft-400">{item.category}</p>}
                  </div>
                  {alreadyPinned && (
                    <span className="text-[10px] text-accent-sage font-semibold">Pinned</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <div className="space-y-2.5">
          <div>
            <label className="text-xs text-kraft-500 font-medium">Item name *</label>
            <input
              autoFocus
              className="input mt-1 text-sm"
              placeholder="e.g. Desk lamp"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAndPin()}
            />
          </div>
          <div>
            <label className="text-xs text-kraft-500 font-medium">Category</label>
            <input
              className="input mt-1 text-sm"
              placeholder="e.g. Furniture"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAndPin()}
            />
          </div>
          <Button
            variant="primary"
            className="w-full"
            leftIcon={<PackagePlus className="w-4 h-4" />}
            onClick={handleCreateAndPin}
            loading={busy}
          >
            Create & pin
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Location picker ───────────────────────────────────────────────────────────

function LocationPicker({
  siteId,
  photoId,
  currentLocationId,
}: {
  siteId: string
  photoId: string
  currentLocationId: string | null
}) {
  const [open, setOpen] = useState(false)
  const updateLocation = useUpdatePhotoLocation(siteId)
  const { data: locations = [] } = useLocationFlat(siteId)

  const current = locations.find((l) => l.id === currentLocationId)

  const handleChange = async (locationId: string | null) => {
    try {
      await updateLocation.mutateAsync({ photoId, locationId })
      toast.success('Location updated')
      setOpen(false)
    } catch {
      toast.error('Failed to update location')
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-kraft-200
                   bg-kraft-100 hover:border-kraft-300 text-xs font-medium text-kraft-600
                   transition-colors min-w-0 max-w-[180px]"
      >
        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{current?.path || current?.name || 'Set location'}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-64 bg-white border border-kraft-200
                        rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            <button
              onClick={() => handleChange(null)}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-kraft-500
                         hover:bg-kraft-50 transition-colors"
            >
              No location
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => handleChange(loc.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg text-xs transition-colors',
                  loc.id === currentLocationId
                    ? 'bg-accent-sage/10 text-accent-sage font-semibold'
                    : 'text-kraft-700 hover:bg-kraft-50'
                )}
              >
                {loc.path || loc.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main PhotoViewer ──────────────────────────────────────────────────────────

interface PhotoViewerProps {
  siteId: string
  photo: PhotoOut | null
  onClose: () => void
  canEdit?: boolean
}

export function PhotoViewer({ siteId, photo, onClose, canEdit = true }: PhotoViewerProps) {
  const [drawMode, setDrawMode] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [pendingBbox, setPendingBbox] = useState<{
    x: number; y: number; width: number; height: number
  } | null>(null)
  const [drawPreview, setDrawPreview] = useState<{
    x: number; y: number; w: number; h: number
  } | null>(null)
  const [pinSheetOpen, setPinSheetOpen] = useState(false)
  const [editingPin, setEditingPin] = useState<PhotoPin | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const unpinItem = useUnpinItem(siteId)
  const pinItem = usePinItem(siteId)
  const updatePhoto = useUpdatePhotoLocation(siteId)
  const deletePhoto = useDeletePhoto(siteId)

  const { data: detail, isLoading } = usePhotoDetail(siteId, photo?.id ?? null)

  const imageUrl = withAuthToken(photo?.url ?? photo?.original_url ?? null)

  const existingItemIds = new Set((detail?.pins ?? []).map((p) => p.item_id))

  // ── Drawing helpers ──────────────────────────────────────────────────────

  const getRelativePos = useCallback((e: ReactPointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
    const rect = imgRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    }
  }, [])

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawMode && !editingPin) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = getRelativePos(e)
    if (!pos) return
    setDrawing(true)
    setDrawStart(pos)
    setDrawPreview(null)
  }, [drawMode, editingPin, getRelativePos])

  const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing || !drawStart) return
    e.preventDefault()
    const pos = getRelativePos(e)
    if (!pos) return
    setDrawPreview({
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      w: Math.abs(pos.x - drawStart.x),
      h: Math.abs(pos.y - drawStart.y),
    })
  }, [drawing, drawStart, getRelativePos])

  const handlePointerUp = useCallback(async (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drawing || !drawStart) return
    e.preventDefault()
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    const pos = getRelativePos(e)
    if (!pos) return
    const bbox = {
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      width: Math.abs(pos.x - drawStart.x),
      height: Math.abs(pos.y - drawStart.y),
    }
    const finalBbox = bbox.width > 0.02 && bbox.height > 0.02
      ? bbox
      : { x: pos.x, y: pos.y, width: 0, height: 0 }

    setDrawing(false)
    setDrawStart(null)
    setDrawPreview(null)

    // Repositioning an existing pin: unpin + repin with new bbox
    if (editingPin && photo) {
      try {
        await unpinItem.mutateAsync({ photoId: photo.id, pinId: editingPin.pin_id })
        await pinItem.mutateAsync({
          photoId: photo.id,
          itemId: editingPin.item_id,
          annotationBbox: finalBbox,
        })
        toast.success(`"${editingPin.item_name}" repositioned`)
      } catch {
        toast.error('Failed to reposition pin')
      }
      setEditingPin(null)
      setDrawMode(false)
      return
    }

    // Normal draw — open PinItemSheet
    setPendingBbox(finalBbox)
    setPinSheetOpen(true)
  }, [drawing, drawStart, getRelativePos, editingPin, photo, unpinItem, pinItem])

  const handleUnpin = async (pinId: string) => {
    if (!photo) return
    try {
      await unpinItem.mutateAsync({ photoId: photo.id, pinId })
      toast.success('Pin removed')
    } catch {
      toast.error('Failed to remove pin')
    }
  }

  const handleArchivePhoto = async () => {
    if (!photo) return
    const confirmed = window.confirm('Archive this photo? It will be hidden from the Photos view.')
    if (!confirmed) return
    try {
      await updatePhoto.mutateAsync({ photoId: photo.id, archived: true })
      toast.success('Photo archived')
      onClose()
    } catch {
      toast.error('Failed to archive photo')
    }
  }

  const handleDeletePhoto = async () => {
    if (!photo) return
    const confirmed = window.confirm('Delete this photo permanently? This cannot be undone.')
    if (!confirmed) return
    try {
      await deletePhoto.mutateAsync(photo.id)
      toast.success('Photo deleted')
      onClose()
    } catch {
      toast.error('Failed to delete photo')
    }
  }

  if (!photo) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        <div className="flex items-center gap-2">
          {canEdit && (
            <button
              onClick={() => {
                if (editingPin) {
                  setEditingPin(null)
                  setDrawMode(false)
                } else {
                  setDrawMode((v) => !v)
                  setPendingBbox(null)
                  setPinSheetOpen(false)
                }
              }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors',
                editingPin
                  ? 'bg-amber-500 text-white'
                  : drawMode
                    ? 'bg-accent-rust text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white'
              )}
            >
              {editingPin ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  Cancel edit
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  {drawMode ? 'Cancel draw' : 'Pin item'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Image area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="relative flex-1 flex items-center justify-center select-none">
          {imageUrl ? (
            <div
              className={cn('relative inline-block', (drawMode || editingPin) && 'cursor-crosshair')}
              style={{ touchAction: (drawMode || editingPin) ? 'none' : 'auto' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => {
                setDrawing(false)
                setDrawStart(null)
                setDrawPreview(null)
              }}
              onPointerLeave={() => {
                if (drawing) {
                  setDrawing(false)
                  setDrawStart(null)
                  setDrawPreview(null)
                }
              }}
            >
              <img
                ref={imgRef}
                src={imageUrl}
                alt="Photo"
                className="max-h-[60vh] max-w-full object-contain select-none block"
                draggable={false}
              />
              {/* Pin overlays — same size as the rendered image */}
              {detail && (
                <div className="absolute inset-0 pointer-events-none">
                  <PinOverlay
                    pins={detail.pins}
                    onPinEdit={canEdit ? (pin) => {
                      setEditingPin(pin)
                      setDrawMode(true)
                      setPinSheetOpen(false)
                    } : undefined}
                    editingPinId={editingPin?.pin_id}
                    pendingBbox={drawPreview}
                    canEdit={canEdit}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="text-kraft-400 text-sm">No image available</div>
          )}

          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Spinner size="lg" className="text-white" />
            </div>
          )}
        </div>

        {/* Bottom info + controls */}
        <div className="flex-shrink-0 bg-black/50 backdrop-blur-sm">
          {/* Location bar */}
          <div className="flex items-center gap-2 px-4 py-2">
            <LocationPicker
              siteId={siteId}
              photoId={photo.id}
              currentLocationId={detail?.location_id ?? photo.location_id}
            />
            {detail?.location_path && (
              <span className="text-xs text-white/60 truncate flex-1 min-w-0">{detail.location_path}</span>
            )}
            {canEdit && (
              <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                <button
                  onClick={() => void handleArchivePhoto()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/20
                             bg-white/10 hover:bg-white/20 text-xs font-medium text-white/80 transition-colors"
                >
                  <Archive className="w-3.5 h-3.5" />
                  Archive
                </button>
                <button
                  onClick={() => void handleDeletePhoto()}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-accent-rust/40
                             bg-accent-rust/20 hover:bg-accent-rust/30 text-xs font-medium text-accent-rust transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>

          {/* Pinned items list */}
          {(detail?.pins ?? []).length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-[10px] uppercase tracking-wide text-white/40 mb-2">
                Pinned items ({detail!.pins.length})
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {detail!.pins.map((pin) => (
                  <div
                    key={pin.pin_id}
                    className="flex-shrink-0 flex items-center gap-1.5 bg-white/10 rounded-xl
                               px-2.5 py-1.5 border border-white/10"
                  >
                    <span className="text-xs text-white font-medium">{pin.item_name}</span>
                    {pin.category && (
                      <span className="text-[10px] text-white/50">{pin.category}</span>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => handleUnpin(pin.pin_id)}
                        className="p-0.5 rounded hover:bg-white/10 ml-0.5"
                      >
                        <Trash2 className="w-3 h-3 text-white/50 hover:text-accent-rust" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Draw mode hint */}
          {(drawMode || editingPin) && !pinSheetOpen && (
            <div className="px-4 pb-3">
              <p className="text-xs text-amber-300 text-center">
                {editingPin
                  ? `Repositioning "${editingPin.item_name}" — drag to draw a new box, or tap to place a point pin`
                  : 'Draw a box around the item, or tap anywhere to pin without a selection'}
              </p>
            </div>
          )}
        </div>

        {/* Pin item sheet */}
        {pinSheetOpen && photo && (
          <PinItemSheet
            siteId={siteId}
            photoId={photo.id}
            existingItemIds={existingItemIds}
            pendingBbox={pendingBbox}
            onPinned={() => {
              setPinSheetOpen(false)
              setPendingBbox(null)
              setDrawMode(false)
            }}
            onCancel={() => {
              setPinSheetOpen(false)
              setPendingBbox(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
