import { useState, useCallback, useRef } from 'react'
import { Plus, SlidersHorizontal, X, Trash2, MoveRight, Images, List } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { ItemCard } from '@/components/inventory/ItemCard'
import { PhotoCard } from '@/components/inventory/PhotoCard'
import { PhotoViewer } from '@/components/inventory/PhotoViewer'
import { SearchBar } from '@/components/shared/SearchBar'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useItems, useCreateItem } from '@/api/hooks/useItems'
import { usePhotoGallery } from '@/api/hooks/usePhotos'
import { useLocationFlat } from '@/api/hooks/useLocations'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ItemCondition, ItemFilters, PhotoOut } from '@/lib/types'

const CONDITIONS: ItemCondition[] = ['excellent', 'good', 'fair', 'poor', 'damaged']

const createSchema = z.object({
  name:        z.string().min(1, 'Name required'),
  category:    z.string().optional(),
  description: z.string().optional(),
  condition:   z.enum(['excellent', 'good', 'fair', 'poor', 'damaged']).default('good'),
  quantity:    z.coerce.number().min(1).default(1),
  location_id: z.string().optional(),
})
type CreateFormValues = z.infer<typeof createSchema>

function FilterChips({
  filters,
  onChange,
}: {
  filters: ItemFilters
  onChange: (f: Partial<ItemFilters>) => void
}) {
  const activeCount = [filters.category, filters.condition, filters.is_verified].filter(Boolean).length

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      <button
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium
                    border transition-colors flex-shrink-0
                    ${activeCount > 0
                      ? 'bg-kraft-700 text-kraft-50 border-kraft-700'
                      : 'bg-kraft-100 text-kraft-600 border-kraft-200 hover:border-kraft-300'
                    }`}
      >
        <SlidersHorizontal className="w-3 h-3" />
        Filters
        {activeCount > 0 && (
          <span className="ml-0.5 w-4 h-4 rounded-full bg-kraft-100 text-kraft-700 text-[10px]
                           flex items-center justify-center font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {CONDITIONS.map((c) => (
        <button
          key={c}
          onClick={() => onChange({ condition: filters.condition === c ? undefined : c })}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex-shrink-0 capitalize
                      ${filters.condition === c
                        ? 'bg-kraft-600 text-kraft-50 border-kraft-600'
                        : 'bg-kraft-100 text-kraft-600 border-kraft-200 hover:border-kraft-300'
                      }`}
        >
          {c}
        </button>
      ))}

      <button
        onClick={() => onChange({ is_verified: filters.is_verified ? undefined : true })}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium
                    border transition-colors flex-shrink-0
                    ${filters.is_verified
                      ? 'bg-accent-sage text-white border-accent-sage'
                      : 'bg-kraft-100 text-kraft-600 border-kraft-200 hover:border-kraft-300'
                    }`}
      >
        Verified only
      </button>
    </div>
  )
}

function CreateItemModal({
  siteId,
  open,
  onClose,
}: {
  siteId: string
  open: boolean
  onClose: () => void
}) {
  const createItem = useCreateItem(siteId)
  const { data: locations = [] } = useLocationFlat(siteId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormValues>({ resolver: zodResolver(createSchema) })

  const onSubmit = async (values: CreateFormValues) => {
    try {
      const item = await createItem.mutateAsync({
        ...values,
        location_id: values.location_id || null,
      })
      toast.success(`"${item.name}" created`)
      reset()
      onClose()
    } catch {
      toast.error('Failed to create item')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Item">
      <form onSubmit={handleSubmit(onSubmit)} className="px-5 pb-5 flex flex-col gap-4">
        <div>
          <label className="label">Name *</label>
          <input className={`input ${errors.name ? 'border-accent-rust' : ''}`}
                 placeholder="e.g. Office Chair" {...register('name')} />
          {errors.name && <p className="mt-1 text-xs text-accent-rust">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Category</label>
            <input className="input" placeholder="Furniture" {...register('category')} />
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" min={1} className="input" defaultValue={1} {...register('quantity')} />
          </div>
        </div>

        <div>
          <label className="label">Condition</label>
          <select className="input" {...register('condition')}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Location</label>
          <select className="input" {...register('location_id')}>
            <option value="">No location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.path || l.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input" rows={2} placeholder="Optional notes" {...register('description')} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting || createItem.isPending}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}

type Tab = 'items' | 'photos'

function PhotosGrid({ siteId }: { siteId: string }) {
  const [viewerPhoto, setViewerPhoto] = useState<PhotoOut | null>(null)
  const { data: photos = [], isLoading } = usePhotoGallery(siteId)
  const { data: locations = [] } = useLocationFlat(siteId)

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <Images className="w-10 h-10 text-kraft-300 mb-3" />
        <p className="text-sm font-medium text-kraft-600 mb-1">No photos yet</p>
        <p className="text-xs text-kraft-400">Capture photos to start building your gallery.</p>
      </div>
    )
  }

  const locationMap = new Map(locations.map((location) => [location.id, location.path || location.name]))
  const groupedPhotos = photos.reduce<Record<string, PhotoOut[]>>((groups, photo) => {
    const key = photo.location_id ? locationMap.get(photo.location_id) ?? 'Unassigned' : 'Unassigned'
    groups[key] ??= []
    groups[key].push(photo)
    return groups
  }, {})

  return (
    <>
      <div className="space-y-5 p-4">
        {Object.entries(groupedPhotos).map(([group, groupPhotos]) => (
          <section key={group} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-kraft-700">{group}</h3>
              <span className="text-xs text-kraft-400">{groupPhotos.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {groupPhotos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onClick={setViewerPhoto} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {viewerPhoto && (
        <PhotoViewer
          siteId={siteId}
          photo={viewerPhoto}
          onClose={() => setViewerPhoto(null)}
          canEdit
        />
      )}
    </>
  )
}

export function InventoryPage() {
  const { siteId } = useParams({ strict: false }) as { siteId?: string }
  const [tab, setTab] = useState<Tab>('items')
  const [filters, setFilters] = useState<ItemFilters>({ size: 50, page: 1 })
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [createOpen, setCreateOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useItems(siteId ?? null, filters)
  const items = data?.items ?? []

  const updateFilter = useCallback((updates: Partial<ItemFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates, page: 1 }))
  }, [])

  const handleSearch = useCallback((search: string) => {
    updateFilter({ search })
  }, [updateFilter])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Virtualizer
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 90,
    overscan: 5,
  })

  return (
    <AppShell>
      <div className="flex flex-col h-full">
        {/* Tab switcher */}
        <div className="px-4 pt-4 pb-0 border-b border-kraft-200 bg-kraft-50">
          <div className="flex gap-1 bg-kraft-200/50 rounded-xl p-1 mb-3">
            <button
              onClick={() => setTab('items')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                          text-sm font-medium transition-all
                          ${tab === 'items'
                            ? 'bg-white text-kraft-700 shadow-sm'
                            : 'text-kraft-500 hover:text-kraft-700'
                          }`}
            >
              <List className="w-4 h-4" />
              Items
              {data && (
                <span className="text-xs text-kraft-400">({data.total})</span>
              )}
            </button>
            <button
              onClick={() => setTab('photos')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
                          text-sm font-medium transition-all
                          ${tab === 'photos'
                            ? 'bg-white text-kraft-700 shadow-sm'
                            : 'text-kraft-500 hover:text-kraft-700'
                          }`}
            >
              <Images className="w-4 h-4" />
              Photos
            </button>
          </div>

          {/* Items filters (only shown on items tab) */}
          {tab === 'items' && (
            <div className="space-y-3 pb-3">
              <SearchBar onSearch={handleSearch} placeholder="Search items…" />
              <FilterChips filters={filters} onChange={updateFilter} />
            </div>
          )}
        </div>

        {/* Tab content */}
        {tab === 'photos' ? (
          <div className="flex-1 overflow-y-auto">
            {siteId && <PhotosGrid siteId={siteId} />}
          </div>
        ) : (
          /* Items list */
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="flex justify-center py-16"><Spinner size="lg" /></div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <p className="text-sm font-medium text-kraft-600 mb-1">No items found</p>
                <p className="text-xs text-kraft-400">
                  Try adjusting your filters or capture new photos.
                </p>
              </div>
            ) : (
              <div
                style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
              >
                {rowVirtualizer.getVirtualItems().map((vRow) => {
                  const item = items[vRow.index]
                  return (
                    <div
                      key={vRow.key}
                      style={{
                        position: 'absolute',
                        top: vRow.start,
                        left: 0,
                        right: 0,
                        height: vRow.size,
                        paddingBottom: 8,
                      }}
                    >
                      <ItemCard
                        item={item}
                        siteId={siteId!}
                        selected={selected.has(item.id)}
                        onSelect={selected.size > 0 ? toggleSelect : undefined}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Multi-select action bar */}
      {selected.size > 0 && tab === 'items' && (
        <div className="fixed bottom-20 left-4 right-4 z-40 bg-kraft-800 text-kraft-50
                        rounded-xl px-4 py-3 flex items-center gap-3 shadow-xl">
          <span className="text-sm font-medium flex-1">
            {selected.size} selected
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="p-1.5 rounded-lg hover:bg-kraft-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg
                             bg-kraft-700 hover:bg-kraft-600 transition-colors">
            <MoveRight className="w-4 h-4" />
            Move
          </button>
          <button className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg
                             bg-accent-rust hover:opacity-90 transition-colors">
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      )}

      {/* FAB — only on items tab */}
      {tab === 'items' && (
        <button
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full
                     bg-kraft-700 text-kraft-50 shadow-lg shadow-kraft-800/30
                     flex items-center justify-center
                     hover:bg-kraft-800 active:scale-95 transition-all"
          aria-label="Add item"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {siteId && (
        <CreateItemModal
          siteId={siteId}
          open={createOpen}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </AppShell>
  )
}
