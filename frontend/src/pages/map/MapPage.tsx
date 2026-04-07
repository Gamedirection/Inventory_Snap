import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
  ChevronRight, ChevronDown, MapPin, Plus, Map as MapIcon, FolderTree
} from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { useLocationTree, useCreateLocation } from '@/api/hooks/useLocations'
import type { LocationOut } from '@/lib/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

// ── Location Tree Node ────────────────────────────────────────────────────────
interface TreeNodeProps {
  location: LocationOut
  depth?: number
  siteId: string
  onAddChild?: (parentId: string) => void
}

function TreeNode({ location, depth = 0, siteId, onAddChild }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1)
  const hasChildren = (location.children?.length ?? 0) > 0

  return (
    <li>
      <div
        className="flex items-center gap-2 py-2.5 px-3 rounded-xl
                   hover:bg-kraft-200/60 transition-colors group cursor-pointer"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => hasChildren && setExpanded((e) => !e)}
      >
        {/* Expand/collapse icon */}
        <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center text-kraft-400">
          {hasChildren ? (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5" />
              : <ChevronRight className="w-3.5 h-3.5" />
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
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(location.id) }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-kraft-400
                       hover:text-kraft-600 hover:bg-kraft-300 transition-all"
            aria-label="Add child location"
          >
            <Plus className="w-3 h-3" />
          </button>
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
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// ── Create Location Form ──────────────────────────────────────────────────────
const createSchema = z.object({
  name:        z.string().min(1, 'Name required'),
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
          <input className={`input ${errors.name ? 'border-accent-rust' : ''}`}
                 placeholder="e.g. Aisle 3, Shelf B" {...register('name')} />
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

// ── Map Page ──────────────────────────────────────────────────────────────────
type ViewMode = 'hierarchy' | 'floorplan'

export function MapPage() {
  const { siteId } = useParams({ strict: false }) as { siteId?: string }
  const [view, setView] = useState<ViewMode>('hierarchy')
  const [addParentId, setAddParentId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const { data: tree = [], isLoading } = useLocationTree(siteId ?? null)

  const totalLocations = (function count(nodes: LocationOut[]): number {
    return nodes.reduce((acc, n) => acc + 1 + count(n.children ?? []), 0)
  })(tree)

  const openAdd = (parentId: string | null = null) => {
    setAddParentId(parentId)
    setAddOpen(true)
  }

  return (
    <AppShell headerTitle="Site Map">
      <div className="flex flex-col h-full">
        {/* View toggle */}
        <div className="flex gap-1 px-4 pt-4 pb-3">
          <button
            onClick={() => setView('hierarchy')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm
                        font-medium transition-colors
                        ${view === 'hierarchy'
                          ? 'bg-kraft-700 text-kraft-50'
                          : 'bg-kraft-100 text-kraft-600 hover:bg-kraft-200'
                        }`}
          >
            <FolderTree className="w-4 h-4" />
            Hierarchy
          </button>
          <button
            onClick={() => setView('floorplan')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm
                        font-medium transition-colors
                        ${view === 'floorplan'
                          ? 'bg-kraft-700 text-kraft-50'
                          : 'bg-kraft-100 text-kraft-600 hover:bg-kraft-200'
                        }`}
          >
            <MapIcon className="w-4 h-4" />
            Floor Plan
          </button>
        </div>

        {/* Content */}
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
                    className="flex items-center gap-1 text-xs text-kraft-500 hover:text-kraft-700
                               hover:bg-kraft-200 px-2 py-1 rounded-lg transition-colors"
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
                    />
                  ))}
                </ul>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-2xl bg-kraft-200 flex items-center justify-center mb-4">
                <MapIcon className="w-10 h-10 text-kraft-400" />
              </div>
              <h2 className="text-sm font-semibold text-kraft-600 mb-1">No floor plan uploaded</h2>
              <p className="text-xs text-kraft-400 max-w-xs">
                Floor plan support is coming soon. You can define locations using the hierarchy view.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      {view === 'hierarchy' && tree.length > 0 && (
        <button
          onClick={() => openAdd(null)}
          className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full
                     bg-kraft-700 text-kraft-50 shadow-lg shadow-kraft-800/30
                     flex items-center justify-center
                     hover:bg-kraft-800 active:scale-95 transition-all"
          aria-label="Add location"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

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
