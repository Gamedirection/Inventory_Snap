import { useState } from 'react'
import { ChevronRight, MapPin, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { LocationTree } from './LocationTree'
import { useLocationTree } from '@/api/hooks/useLocations'
import type { Location } from '@/lib/types'
import { cn } from '@/lib/utils'

interface LocationPickerProps {
  siteId: string
  value: string | null
  onChange: (locationId: string | null, location: Location | null) => void
  placeholder?: string
  className?: string
}

function buildBreadcrumb(locations: Location[], targetId: string): string {
  const findPath = (nodes: Location[], id: string, path: string[]): string[] | null => {
    for (const node of nodes) {
      if (node.id === id) return [...path, node.name]
      if (node.children?.length) {
        const found = findPath(node.children, id, [...path, node.name])
        if (found) return found
      }
    }
    return null
  }
  return findPath(locations, targetId, [])?.join(' › ') ?? ''
}

function findById(nodes: Location[], id: string): Location | null {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findById(node.children, id)
      if (found) return found
    }
  }
  return null
}

export function LocationPicker({
  siteId,
  value,
  onChange,
  placeholder = 'Select location',
  className,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false)
  const { data: tree = [] } = useLocationTree(siteId)

  const selectedLabel = value ? buildBreadcrumb(tree, value) : null

  const handleSelect = (loc: Location) => {
    onChange(loc.id, loc)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null, null)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-kraft-200',
          'bg-white text-left text-sm hover:border-kraft-400 transition-colors',
          className
        )}
      >
        <MapPin size={14} className="flex-shrink-0 text-kraft-400" />
        <span className={cn('flex-1 truncate', selectedLabel ? 'text-kraft-700' : 'text-kraft-400')}>
          {selectedLabel ?? placeholder}
        </span>
        {value ? (
          <X size={14} className="flex-shrink-0 text-kraft-400 hover:text-kraft-700" onClick={handleClear} />
        ) : (
          <ChevronRight size={14} className="flex-shrink-0 text-kraft-400" />
        )}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Select Location"
      >
        <div className="max-h-96 overflow-y-auto">
          <LocationTree
            locations={tree}
            onSelect={handleSelect}
            selectedId={value}
          />
        </div>
        <button
          className="mt-3 w-full btn-ghost text-sm"
          onClick={() => { onChange(null, null); setOpen(false) }}
        >
          Clear selection
        </button>
      </Modal>
    </>
  )
}
