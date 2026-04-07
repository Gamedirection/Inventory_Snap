import { useState } from 'react'
import { Filter, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ItemFilterState {
  category: string | null
  condition: string | null
  verified: boolean | null
  item_type: string | null
  location_id: string | null
}

const CATEGORIES = [
  'Electronics', 'Furniture', 'Tools', 'Clothing', 'Books', 'Appliances',
  'Vehicles', 'Sports', 'Art', 'Collectibles', 'Other',
]

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'unknown', label: 'Unknown' },
]

const ITEM_TYPES = [
  { value: 'unique', label: 'Unique' },
  { value: 'bulk', label: 'Bulk' },
  { value: 'grouped_set', label: 'Set' },
]

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap',
        active
          ? 'bg-kraft-700 text-kraft-50 border-kraft-700'
          : 'bg-white text-kraft-600 border-kraft-200 hover:border-kraft-400'
      )}
    >
      {label}
    </button>
  )
}

interface ItemFiltersProps {
  filters: ItemFilterState
  onChange: (filters: ItemFilterState) => void
  className?: string
}

export function ItemFilters({ filters, onChange, className }: ItemFiltersProps) {
  const [showAll, setShowAll] = useState(false)

  const activeCount = Object.values(filters).filter(Boolean).length

  const setFilter = <K extends keyof ItemFilterState>(key: K, value: ItemFilterState[K]) => {
    onChange({ ...filters, [key]: filters[key] === value ? null : value })
  }

  const clearAll = () => {
    onChange({ category: null, condition: null, verified: null, item_type: null, location_id: null })
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-kraft-500">
          <Filter size={12} />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-kraft-700 text-kraft-50">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button onClick={clearAll} className="text-xs text-accent-rust flex items-center gap-1 ml-auto">
            <X size={10} /> Clear all
          </button>
        )}
      </div>

      {/* Verification quick filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <FilterChip
          label="✓ Verified"
          active={filters.verified === true}
          onClick={() => setFilter('verified', true)}
        />
        <FilterChip
          label="⚠ Unverified"
          active={filters.verified === false}
          onClick={() => setFilter('verified', false)}
        />
        {CONDITIONS.slice(0, 3).map(c => (
          <FilterChip
            key={c.value}
            label={c.label}
            active={filters.condition === c.value}
            onClick={() => setFilter('condition', c.value)}
          />
        ))}
        {!showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-kraft-300 text-kraft-400 whitespace-nowrap hover:border-kraft-500 transition-colors flex items-center gap-1"
          >
            More <ChevronDown size={10} />
          </button>
        )}
      </div>

      {showAll && (
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-kraft-400 py-1.5 flex-shrink-0">Category:</span>
            {CATEGORIES.map(cat => (
              <FilterChip
                key={cat}
                label={cat}
                active={filters.category === cat}
                onClick={() => setFilter('category', cat)}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-kraft-400 py-1.5 flex-shrink-0">Condition:</span>
            {CONDITIONS.map(c => (
              <FilterChip
                key={c.value}
                label={c.label}
                active={filters.condition === c.value}
                onClick={() => setFilter('condition', c.value)}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-kraft-400 py-1.5 flex-shrink-0">Type:</span>
            {ITEM_TYPES.map(t => (
              <FilterChip
                key={t.value}
                label={t.label}
                active={filters.item_type === t.value}
                onClick={() => setFilter('item_type', t.value)}
              />
            ))}
          </div>
          <button
            onClick={() => setShowAll(false)}
            className="text-xs text-kraft-400 flex items-center gap-1"
          >
            <ChevronDown size={10} className="rotate-180" /> Show less
          </button>
        </div>
      )}
    </div>
  )
}
