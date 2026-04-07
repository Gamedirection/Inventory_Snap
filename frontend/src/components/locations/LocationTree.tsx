import { useState } from 'react'
import { ChevronRight, ChevronDown, MapPin, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Location } from '@/lib/types'

interface LocationTreeProps {
  locations: Location[]
  onSelect?: (location: Location) => void
  selectedId?: string | null
  className?: string
}

const LEVEL_ICONS: Record<string, string> = {
  floor: '🏢',
  room: '🚪',
  zone: '📐',
  shelf: '📦',
  container: '🗃️',
}

const LEVEL_INDENT: Record<string, number> = {
  floor: 0,
  room: 1,
  zone: 2,
  shelf: 3,
  container: 4,
}

interface TreeNodeProps {
  location: Location
  onSelect?: (location: Location) => void
  selectedId?: string | null
  depth?: number
}

function TreeNode({ location, onSelect, selectedId, depth = 0 }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasChildren = location.children && location.children.length > 0
  const isSelected = selectedId === location.id
  const indent = (LEVEL_INDENT[location.level] ?? depth) * 16

  return (
    <div>
      <button
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors',
          isSelected
            ? 'bg-kraft-700 text-kraft-50'
            : 'hover:bg-kraft-200 text-kraft-700'
        )}
        style={{ paddingLeft: `${12 + indent}px` }}
        onClick={() => onSelect?.(location)}
      >
        {/* Expand toggle */}
        <span
          className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )
          ) : (
            <span className="w-3.5 h-3.5" />
          )}
        </span>

        <span className="flex-shrink-0 text-sm">
          {LEVEL_ICONS[location.level] ?? '📍'}
        </span>

        <span className="flex-1 text-sm font-medium truncate">{location.name}</span>

        {location.item_count > 0 && (
          <span
            className={cn(
              'flex-shrink-0 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md',
              isSelected ? 'bg-kraft-600 text-kraft-200' : 'bg-kraft-200 text-kraft-500'
            )}
          >
            <Package size={10} />
            {location.item_count}
          </span>
        )}
      </button>

      {hasChildren && expanded && (
        <div>
          {location.children!.map((child) => (
            <TreeNode
              key={child.id}
              location={child}
              onSelect={onSelect}
              selectedId={selectedId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function LocationTree({ locations, onSelect, selectedId, className }: LocationTreeProps) {
  if (locations.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-kraft-400', className)}>
        <MapPin size={32} className="mb-2 opacity-50" />
        <p className="text-sm">No locations yet</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-0.5', className)}>
      {locations.map((loc) => (
        <TreeNode
          key={loc.id}
          location={loc}
          onSelect={onSelect}
          selectedId={selectedId}
        />
      ))}
    </div>
  )
}
