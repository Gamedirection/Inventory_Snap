import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  ChevronRight,
  ChevronDown,
  MapPin,
  Plus,
  Map as MapIcon,
  FolderTree,
  Upload,
  Crosshair,
  CheckCircle2,
  MinusCircle,
  Trash2,
  Archive,
  Search,
  X,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { FloorPlanBoard } from '@/components/map/FloorPlanBoard'
import { ItemForm } from '@/components/inventory/ItemForm'
import { useDeleteItem, useItems, usePatchItem } from '@/api/hooks/useItems'
import {
  useCreateLocation,
  useDeleteLocation,
  useFloorMap,
  useLocationFlat,
  useLocationTree,
  useUpdateFloorMap,
  useUploadFloorMapImage,
} from '@/api/hooks/useLocations'
import type { ItemOut, LocationOut } from '@/lib/types'
import { withAuthToken } from '@/lib/utils'

const ARCHIVED_TAG = '__archived__'

interface TreeNodeProps {
  location: LocationOut
  depth?: number
  siteId: string
  onAddChild?: (parentId: string) => void
  onDelete?: (location: LocationOut) => void
}

function TreeNode({ location, depth = 0, siteId, onAddChild, onDelete }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = (location.children?.length ?? 0) > 0

  return (
    <li>
      <div
        className="flex items-center gap-2 py-2.5 px-3 rounded-xl hover:bg-kraft-200/60 transition-colors group cursor-pointer"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => hasChildren && setExpanded((e) => !e)}
      >
        <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-kraft-400">
          {hasChildren ? (
            expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <MapPin className="w-3 h-3 text-kraft-300" />
          )}
        </div>

        <span className="flex-1 text-sm font-medium text-kraft-700 truncate">
          {location.name}
        </span>

        {location.item_count > 0 && (
          <Badge variant="kraft">{location.item_count}</Badge>
        )}

        {onAddChild && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddChild(location.id)
              }}
              className="p-1 rounded-lg text-kraft-400 hover:text-kraft-600 hover:bg-kraft-300 transition-all"
              aria-label="Add child location"
            >
              <Plus className="w-3 h-3" />
            </button>
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(location)
                }}
                className="p-1 rounded-lg text-kraft-400 hover:text-accent-rust hover:bg-kraft-300 transition-all"
                aria-label="Delete location"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && hasChildren && (
        <ul className="mt-0.5">
          {location.children!.map((child) => (
            <TreeNode
              key={child.id}
              location={child}
              depth={depth + 1}
              siteId={siteId}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

const createSchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  floor_level: z.coerce.number().optional(),
})
type CreateForm = z.infer<typeof createSchema>

function AddLocationModal({
  siteId,
  parentId,
  open,
  onClose,
}: {
  siteId: string
  parentId: string | null
  open: boolean
  onClose: () => void
}) {
  const createLocation = useCreateLocation(siteId)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
  })

  const onSubmit = async (values: CreateForm) => {
    try {
      await createLocation.mutateAsync({ ...values, parent_id: parentId })
      toast.success('Location added')
      reset()
      onClose()
    } catch {
      toast.error('Failed to create location')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={parentId ? 'Add Sub-location' : 'Add Location'} size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="px-5 pb-5 flex flex-col gap-4">
        <div>
          <label className="label">Name *</label>
          <input className={`input ${errors.name ? 'border-accent-rust' : ''}`} placeholder="e.g. Aisle 3, Shelf B" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-accent-rust">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">Description</label>
          <input className="input" placeholder="Optional" {...register('description')} />
        </div>
        <div>
          <label className="label">Floor level</label>
          <input type="number" className="input" placeholder="0" {...register('floor_level')} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting || createLocation.isPending}>
            Add
          </Button>
        </div>
      </form>
    </Modal>
  )
}

type ViewMode = 'hierarchy' | 'floorplan'

async function getImageDimensions(file: File) {
  const objectUrl = URL.createObjectURL(file)
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
      img.onerror = () => reject(new Error('Invalid image'))
      img.src = objectUrl
    })
    return dimensions
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

// ── Add item to location sheet ────────────────────────────────────────────────

function AddItemToLocationSheet({
  siteId,
  locationName,
  onAdd,
  onClose,
}: {
  siteId: string
  locationName: string
  onAdd: (item: ItemOut) => Promise<void>
  onClose: () => void
}) {
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState<string | null>(null)
  const { data, isLoading } = useItems(siteId, { search, size: 40 })
  const items = data?.items ?? []

  const handleAdd = async (item: ItemOut) => {
    setAdding(item.id)
    try {
      await onAdd(item)
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-kraft-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-kraft-50 rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-kraft-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-kraft-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-kraft-700">
            Add item to <span className="text-kraft-500">{locationName}</span>
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-kraft-200 text-kraft-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kraft-400" />
            <input
              className="input pl-9 text-sm"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1 px-4 pb-[max(env(safe-area-inset-bottom,0px),16px)]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-kraft-500">No items found</p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {items.map((item) => {
                const thumbUrl = item.primary_photo_url ? withAuthToken(item.primary_photo_url) : null
                const isAdding = adding === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isAdding}
                    onClick={() => void handleAdd(item)}
                    className="w-full flex items-center gap-3 rounded-xl border border-kraft-200
                               bg-white hover:border-kraft-400 hover:bg-kraft-50 transition-colors
                               p-2.5 text-left disabled:opacity-50"
                  >
                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-lg bg-kraft-200 flex-shrink-0 overflow-hidden">
                      {thumbUrl ? (
                        <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Archive className="w-5 h-5 text-kraft-400" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-kraft-700 truncate">{item.name}</p>
                      <p className="text-xs text-kraft-400 truncate mt-0.5">
                        {[item.category, item.brand].filter(Boolean).join(' · ') || 'No category'}
                      </p>
                    </div>

                    {/* Add indicator */}
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                                    ${isAdding ? 'bg-kraft-200' : 'bg-accent-sage/10'}`}>
                      {isAdding
                        ? <Spinner size="sm" />
                        : <Plus className="w-3.5 h-3.5 text-accent-sage" />
                      }
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Floor plan panel ──────────────────────────────────────────────────────────

function FloorPlanPanel({
  siteId,
  locations,
  initialLocationId,
  initialItemId,
}: {
  siteId: string
  locations: LocationOut[]
  initialLocationId?: string | null
  initialItemId?: string | null
}) {
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [movingPinId, setMovingPinId] = useState<string | null>(null)
  const [pendingNewPin, setPendingNewPin] = useState(false)
  const [editItemOpen, setEditItemOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)

  const locationMap = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations]
  )

  const getRootFloorId = useCallback((locationId: string | null | undefined): string | null => {
    if (!locationId) return null
    let current = locationMap.get(locationId) ?? null
    let fallback = current?.id ?? null
    while (current) {
      fallback = current.id
      if (!current.parent_id) return current.id
      current = locationMap.get(current.parent_id) ?? null
    }
    return fallback
  }, [locationMap])

  const floorLocations = useMemo(() => {
    const topLevel = locations.filter((location) => !location.parent_id)
    return topLevel.sort((a, b) => (a.path || a.name).localeCompare(b.path || b.name))
  }, [locations])

  const [activeFloorId, setActiveFloorId] = useState<string | null>(() => getRootFloorId(initialLocationId) ?? floorLocations[0]?.id ?? null)

  const sortedLocations = useMemo(() => {
    const allowedRoot = activeFloorId
    const scoped = locations.filter((location) => getRootFloorId(location.id) === allowedRoot)
    return [...scoped].sort((a, b) => {
      if ((a.level === 'floor') && (b.level !== 'floor')) return -1
      if ((a.level !== 'floor') && (b.level === 'floor')) return 1
      return (a.path || a.name).localeCompare(b.path || b.name)
    })
  }, [activeFloorId, getRootFloorId, locations])

  useEffect(() => {
    if (initialLocationId && locationMap.has(initialLocationId)) {
      setSelectedLocationId(initialLocationId)
    } else if (!selectedLocationId && sortedLocations.length > 0) {
      setSelectedLocationId(sortedLocations[0].id)
    }
  }, [initialLocationId, locationMap, selectedLocationId, sortedLocations])

  useEffect(() => {
    if (!activeFloorId && floorLocations.length > 0) {
      setActiveFloorId(floorLocations[0].id)
    }
  }, [activeFloorId, floorLocations])

  useEffect(() => {
    if (selectedLocationId && getRootFloorId(selectedLocationId) !== activeFloorId) {
      setSelectedLocationId(sortedLocations[0]?.id ?? null)
      setSelectedItemId(null)
      setSelectedPinId(null)
      setMovingPinId(null)
      setPendingNewPin(false)
    }
  }, [activeFloorId, getRootFloorId, selectedLocationId, sortedLocations])

  const selectedLocation = sortedLocations.find((location) => location.id === selectedLocationId) ?? null
  const floorMapQuery = useFloorMap(siteId, selectedLocationId)
  const floorMap = floorMapQuery.data
  const uploadFloorMap = useUploadFloorMapImage(siteId, selectedLocationId ?? '')
  const updateFloorMap = useUpdateFloorMap(siteId, selectedLocationId ?? '')
  const patchItem = usePatchItem(siteId)
  const deleteItem = useDeleteItem(siteId, selectedItemId ?? '')
  const { data: itemsResponse, isLoading: itemsLoading } = useItems(
    selectedLocationId ? siteId : null,
    selectedLocationId ? { location_id: selectedLocationId, page: 1, size: 200, sort: 'name_asc' } : { page: 1, size: 200 }
  )

  const items = itemsResponse?.items ?? []

  useEffect(() => {
    if (initialItemId && items.some((item) => item.id === initialItemId)) {
      setSelectedItemId(initialItemId)
      const target = items.find((item) => item.id === initialItemId)
      setSelectedPinId(target?.pins?.[0]?.id ?? null)
    }
  }, [initialItemId, items])

  useEffect(() => {
    if (selectedItemId && !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null)
      setSelectedPinId(null)
      setPendingNewPin(false)
    }
  }, [items, selectedItemId])

  useEffect(() => {
    if (selectedPinId && !items.some((item) => item.pins?.some((pin) => pin.id === selectedPinId))) {
      setSelectedPinId(null)
    }
  }, [items, selectedPinId])

  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null
  const selectedItemPins = selectedItem?.pins ?? []
  const pinnedCount = items.reduce((count, item) => count + (item.pins?.length ?? 0), 0)

  const pins = items.flatMap((item) =>
    (item.pins ?? []).map((pin, index) => ({
      id: pin.id,
      itemId: item.id,
      label: item.quantity > 1 ? `${item.name} ${index + 1}` : item.name,
      x: pin.x,
      y: pin.y,
      color: pin.id === selectedPinId ? '#b75d3c' : item.id === selectedItemId ? '#7d9b69' : '#4a7c59',
    }))
  )

  const saveItemPins = async (
    itemId: string,
    pinsPayload: Array<{ id?: string; x: number; y: number }>,
    focusPinId?: string | null,
  ) => {
    try {
      const updated = await patchItem.mutateAsync({
        itemId,
        payload: {
          pins: pinsPayload,
        },
      })
      if (updated.id === selectedItemId) {
        const focusedPin = updated.pins.find((pin) => pin.id === focusPinId) ?? updated.pins[updated.pins.length - 1] ?? null
        setSelectedPinId(focusedPin?.id ?? null)
      }
      setPendingNewPin(false)
      toast.success('Pins saved')
    } catch {
      toast.error('Failed to save pins')
    }
  }

  const handleAddPin = () => {
    if (!selectedItem) {
      toast.error('Select an item first')
      return
    }
    if (selectedItemPins.length >= selectedItem.quantity) {
      toast.error(`This item already has ${selectedItem.quantity} pin${selectedItem.quantity !== 1 ? 's' : ''}`)
      return
    }
    setPendingNewPin(true)
    setSelectedPinId(null)
  }

  const handleRemoveSelectedPin = async () => {
    if (!selectedItem || !selectedPinId) {
      return
    }
    const nextPins = selectedItemPins.filter((pin) => pin.id !== selectedPinId)
    await saveItemPins(
      selectedItem.id,
      nextPins.map((pin) => ({ id: pin.id, x: pin.x, y: pin.y })),
      nextPins[0]?.id ?? null,
    )
    setSelectedPinId(null)
  }

  const handleDeleteSelectedItem = async () => {
    if (!selectedItem) return
    const confirmed = window.confirm(`Delete item "${selectedItem.name}"? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteItem.mutateAsync()
      setSelectedItemId(null)
      setSelectedPinId(null)
      setPendingNewPin(false)
      setEditItemOpen(false)
      toast.success('Item deleted')
    } catch {
      toast.error('Failed to delete item')
    }
  }

  const handleArchiveSelectedItem = async () => {
    if (!selectedItem) return
    const confirmed = window.confirm(`Archive item "${selectedItem.name}"? It will be hidden from inventory lists.`)
    if (!confirmed) return
    try {
      const nextTags = Array.from(new Set([...(selectedItem.custom_tags ?? []), ARCHIVED_TAG]))
      await patchItem.mutateAsync({
        itemId: selectedItem.id,
        payload: { custom_tags: nextTags },
      })
      setSelectedItemId(null)
      setSelectedPinId(null)
      setPendingNewPin(false)
      toast.success('Item archived')
    } catch {
      toast.error('Failed to archive item')
    }
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !selectedLocationId) {
      return
    }

    if (file.type !== 'image/png') {
      toast.error('Please upload a PNG floor plan')
      event.target.value = ''
      return
    }

    try {
      const dimensions = await getImageDimensions(file)
      await uploadFloorMap.mutateAsync(file)
      await updateFloorMap.mutateAsync({
        width: dimensions.width,
        height: dimensions.height,
        vector_data: floorMap?.vector_data ?? undefined,
      })
      toast.success('Floor plan uploaded')
    } catch {
      toast.error('Failed to upload floor plan')
    } finally {
      event.target.value = ''
    }
  }

  const hasFloorPlan = Boolean(floorMap?.image_url)

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-4">
        {floorLocations.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {floorLocations.map((floor) => (
              <button
                key={floor.id}
                type="button"
                onClick={() => {
                  setActiveFloorId(floor.id)
                  setSelectedLocationId(floor.id)
                  setSelectedItemId(null)
                  setSelectedPinId(null)
                  setPendingNewPin(false)
                }}
                className={`min-w-[92px] rounded-xl border px-3 py-2 text-left transition-colors ${
                  activeFloorId === floor.id
                    ? 'border-kraft-700 bg-kraft-100 text-kraft-700'
                    : 'border-kraft-200 bg-white text-kraft-500 hover:border-kraft-300'
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">Floor</p>
                <p className="mt-1 text-sm font-semibold truncate">{floor.name}</p>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex-1">
            <label className="label">Floor plan location</label>
            <select
              className="input"
              value={selectedLocationId ?? ''}
              onChange={(e) => {
                setSelectedLocationId(e.target.value || null)
                setSelectedItemId(null)
                setSelectedPinId(null)
                setPendingNewPin(false)
              }}
            >
              {sortedLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.path || location.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              leftIcon={<Upload className="w-4 h-4" />}
              loading={uploadFloorMap.isPending || updateFloorMap.isPending}
              onClick={() => uploadInputRef.current?.click()}
              disabled={!selectedLocationId}
            >
              {hasFloorPlan ? 'Replace PNG' : 'Upload PNG'}
            </Button>
            {selectedItem && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleAddPin}
                disabled={patchItem.isPending || selectedItemPins.length >= selectedItem.quantity}
              >
                Add Pin
              </Button>
            )}
            {selectedItem && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditItemOpen(true)}
              >
                Edit Item
              </Button>
            )}
            {selectedItem && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleArchiveSelectedItem()}
                loading={patchItem.isPending}
              >
                <Archive className="w-4 h-4" />
                Archive Item
              </Button>
            )}
            {selectedItem && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleDeleteSelectedItem()}
                loading={deleteItem.isPending}
                className="text-accent-rust"
              >
                Delete Item
              </Button>
            )}
            {selectedItem && selectedPinId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleRemoveSelectedPin()}
                disabled={patchItem.isPending}
              >
                Remove Pin
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-xl bg-kraft-100 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft-400">Location</p>
            <p className="mt-1 text-sm font-semibold text-kraft-700">{selectedLocation?.name ?? 'None'}</p>
          </div>
          <div className="rounded-xl bg-kraft-100 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft-400">Items</p>
            <p className="mt-1 text-sm font-semibold text-kraft-700">{items.length}</p>
          </div>
          <div className="rounded-xl bg-kraft-100 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft-400">Pinned</p>
            <p className="mt-1 text-sm font-semibold text-kraft-700">{pinnedCount}</p>
          </div>
          <div className="rounded-xl bg-kraft-100 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.12em] text-kraft-400">Placement</p>
            <p className="mt-1 text-sm font-semibold text-kraft-700">
              {selectedItem
                ? pendingNewPin
                  ? `Tap map to place ${selectedItem.name}`
                  : `Selected: ${selectedItem.name}`
                : 'Select an item'}
            </p>
          </div>
        </div>
      </div>

      {!selectedLocationId ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-kraft-600">Create a location first</p>
          <p className="mt-1 text-xs text-kraft-400">Floor plans are attached to a specific location.</p>
        </div>
      ) : floorMapQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : !hasFloorPlan ? (
        <div className="card flex flex-col items-center py-16 text-center">
          <div className="w-20 h-20 rounded-2xl bg-kraft-200 flex items-center justify-center mb-4">
            <MapIcon className="w-10 h-10 text-kraft-400" />
          </div>
          <h2 className="text-sm font-semibold text-kraft-600 mb-1">No floor plan uploaded</h2>
          <p className="text-xs text-kraft-400 max-w-xs mb-5">
            Upload a PNG for {selectedLocation?.name ?? 'this location'} and then pin items directly on it.
          </p>
          <Button type="button" variant="primary" leftIcon={<Upload className="w-4 h-4" />} onClick={() => uploadInputRef.current?.click()}>
            Upload Floor Plan
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="card p-0 -mx-4 rounded-none overflow-hidden sm:mx-0 sm:rounded-xl sm:p-4">
            <FloorPlanBoard
              imageUrl={floorMap?.image_url}
              imageWidth={floorMap?.width}
              imageHeight={floorMap?.height}
              pins={pins}
              selectedPinId={selectedPinId}
              movingPinId={movingPinId}
              onPinSelect={(pinId, itemId) => {
                if (movingPinId === pinId) {
                  // Tap same pin again → cancel move mode
                  setMovingPinId(null)
                  return
                }
                setSelectedItemId(itemId)
                setSelectedPinId(pinId)
                setMovingPinId(pinId)   // immediately enter move mode
                setPendingNewPin(false)
              }}
              onCanvasClick={(x, y) => {
                if (movingPinId) {
                  // Move the selected pin to tapped location
                  const targetItem = items.find((entry) =>
                    entry.pins?.some((p) => p.id === movingPinId)
                  )
                  if (!targetItem) return
                  void saveItemPins(
                    targetItem.id,
                    targetItem.pins.map((p) =>
                      p.id === movingPinId
                        ? { id: p.id, x, y }
                        : { id: p.id, x: p.x, y: p.y }
                    ),
                    movingPinId,
                  )
                  setMovingPinId(null)
                  return
                }
                if (!selectedItem) {
                  toast.error('Select an item before placing a pin')
                  return
                }
                if (!pendingNewPin) {
                  toast.error('Tap Add Pin first to place another instance')
                  return
                }
                if (selectedItemPins.length >= selectedItem.quantity) {
                  toast.error('No remaining quantity to place')
                  setPendingNewPin(false)
                  return
                }
                void saveItemPins(
                  selectedItem.id,
                  [
                    ...selectedItemPins.map((pin) => ({ id: pin.id, x: pin.x, y: pin.y })),
                    { x, y },
                  ],
                )
              }}
            />
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="section-title">Items in {selectedLocation?.name}</p>
                <p className="text-xs text-kraft-400">Choose one, then tap the plan to place it.</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="kraft">{items.length}</Badge>
                {selectedLocationId && (
                  <button
                    type="button"
                    onClick={() => setAddItemOpen(true)}
                    className="w-7 h-7 rounded-full bg-kraft-700 text-kraft-50 flex items-center justify-center
                               hover:bg-kraft-800 transition-colors"
                    aria-label="Add item to location"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {itemsLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size="md" />
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-kraft-200 px-4 py-8 text-center">
                <p className="text-sm font-medium text-kraft-600">No items in this location</p>
                <p className="mt-1 text-xs text-kraft-400">
                  Move items into {selectedLocation?.name} to pin them here.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {items.map((item: ItemOut) => {
                  const isSelected = item.id === selectedItemId
                  const placedCount = item.pins?.length ?? 0
                  const isPinned = placedCount > 0

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSelectedItemId(item.id)
                        setSelectedPinId(item.pins?.[0]?.id ?? null)
                        setPendingNewPin(false)
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? 'border-kraft-700 bg-kraft-100'
                          : 'border-kraft-200 hover:border-kraft-300 hover:bg-kraft-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-kraft-700 truncate">{item.name}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-kraft-400">
                            {item.category ? <span>{item.category}</span> : null}
                            {item.quantity > 1 ? <span>Qty {item.quantity}</span> : null}
                            <span>{placedCount}/{item.quantity} pinned</span>
                          </div>
                        </div>
                        {isPinned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-sage/10 px-2 py-1 text-[11px] font-medium text-accent-sage">
                            <CheckCircle2 className="w-3 h-3" />
                            {placedCount}/{item.quantity}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-kraft-100 px-2 py-1 text-[11px] font-medium text-kraft-500">
                            <Crosshair className="w-3 h-3" />
                            Unplaced
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {selectedItem && (
              <div className="mt-3 rounded-xl border border-kraft-200 bg-kraft-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-kraft-700">{selectedItem.name}</p>
                    <p className="text-xs text-kraft-400">
                      {selectedItemPins.length} of {selectedItem.quantity} instances placed
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleAddPin}
                    disabled={patchItem.isPending || selectedItemPins.length >= selectedItem.quantity}
                  >
                    Add Pin
                  </Button>
                </div>
                {selectedItemPins.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {selectedItemPins.map((pin, index) => (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={() => {
                          setSelectedPinId(pin.id)
                          setSelectedItemId(selectedItem.id)
                          setPendingNewPin(false)
                        }}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                          selectedPinId === pin.id ? 'border-kraft-700 bg-kraft-100' : 'border-kraft-200 bg-white'
                        }`}
                      >
                        <span className="text-sm text-kraft-700">Pin {index + 1}</span>
                        {selectedPinId === pin.id ? <CheckCircle2 className="h-4 w-4 text-accent-sage" /> : <MinusCircle className="h-4 w-4 text-kraft-300" />}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedItem && (
        <Modal
          open={editItemOpen}
          onClose={() => setEditItemOpen(false)}
          title={`Edit ${selectedItem.name}`}
          size="lg"
        >
          <div className="max-h-[80vh] overflow-y-auto px-5 pb-5">
            <ItemForm
              siteId={siteId}
              existing={selectedItem}
              onSuccess={() => {
                setEditItemOpen(false)
                toast.success('Item updated')
              }}
              onCancel={() => setEditItemOpen(false)}
            />
          </div>
        </Modal>
      )}

      {addItemOpen && selectedLocationId && (
        <AddItemToLocationSheet
          siteId={siteId}
          locationName={selectedLocation?.name ?? 'this location'}
          onClose={() => setAddItemOpen(false)}
          onAdd={async (item) => {
            await patchItem.mutateAsync({
              itemId: item.id,
              payload: { location_id: selectedLocationId },
            })
            toast.success(`"${item.name}" added to ${selectedLocation?.name ?? 'location'}`)
            setAddItemOpen(false)
          }}
        />
      )}
    </div>
  )
}

export function MapPage() {
  const { siteId } = useParams({ strict: false }) as { siteId?: string }
  const searchParams = new URLSearchParams(window.location.search)
  const initialView = searchParams.get('view') === 'floorplan' ? 'floorplan' : 'hierarchy'
  const initialLocationId = searchParams.get('locationId')
  const initialItemId = searchParams.get('itemId')
  const [view, setView] = useState<ViewMode>(initialView)
  const [addParentId, setAddParentId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const { data: tree = [], isLoading } = useLocationTree(siteId ?? null)
  const { data: flatLocations = [] } = useLocationFlat(siteId ?? null)
  const deleteLocation = useDeleteLocation(siteId ?? '')

  const totalLocations = (function count(nodes: LocationOut[]): number {
    return nodes.reduce((acc, n) => acc + 1 + count(n.children ?? []), 0)
  })(tree)

  const openAdd = (parentId: string | null = null) => {
    setAddParentId(parentId)
    setAddOpen(true)
  }

  const handleDeleteLocation = async (location: LocationOut) => {
    if (!siteId) return
    const confirmed = window.confirm(`Delete location "${location.name}" and all nested sub-locations? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteLocation.mutateAsync(location.id)
      toast.success('Location deleted')
    } catch {
      toast.error('Failed to delete location')
    }
  }

  return (
    <AppShell headerTitle="Site Map">
      <div className="flex flex-col h-full">
        <div className="flex gap-1 px-4 pt-4 pb-3">
          <button
            onClick={() => setView('hierarchy')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === 'hierarchy'
                ? 'bg-kraft-700 text-kraft-50'
                : 'bg-kraft-100 text-kraft-600 hover:bg-kraft-200'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            Hierarchy
          </button>
          <button
            onClick={() => setView('floorplan')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${
              view === 'floorplan'
                ? 'bg-kraft-700 text-kraft-50'
                : 'bg-kraft-100 text-kraft-600 hover:bg-kraft-200'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Floor Plan
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {view === 'hierarchy' ? (
            isLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : tree.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <MapPin className="w-12 h-12 text-kraft-300 mb-4" />
                <h2 className="text-sm font-semibold text-kraft-600 mb-1">No locations yet</h2>
                <p className="text-xs text-kraft-400 mb-4">
                  Add locations to organize your inventory.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => openAdd(null)}
                >
                  Add Location
                </Button>
              </div>
            ) : (
              <div className="card p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="section-title">
                    {totalLocations} location{totalLocations !== 1 ? 's' : ''}
                  </p>
                  <button
                    onClick={() => openAdd(null)}
                    className="flex items-center gap-1 text-xs text-kraft-500 hover:text-kraft-700 hover:bg-kraft-200 px-2 py-1 rounded-lg transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
                <ul className="space-y-0.5">
                  {tree.map((node) => (
                    <TreeNode
                      key={node.id}
                      location={node}
                      siteId={siteId!}
                      onAddChild={(parentId) => openAdd(parentId)}
                      onDelete={handleDeleteLocation}
                    />
                  ))}
                </ul>
              </div>
            )
          ) : (
            <FloorPlanPanel
              siteId={siteId!}
              locations={flatLocations}
              initialLocationId={initialLocationId}
              initialItemId={initialItemId}
            />
          )}
        </div>
      </div>

      {siteId && (
        <AddLocationModal
          siteId={siteId}
          parentId={addParentId}
          open={addOpen}
          onClose={() => setAddOpen(false)}
        />
      )}
    </AppShell>
  )
}
