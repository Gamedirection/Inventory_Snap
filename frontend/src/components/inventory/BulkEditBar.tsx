import { Trash2, MoveRight, Tag, User, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface BulkEditBarProps {
  selectedIds: string[]
  onClearSelection: () => void
  onMove: () => void
  onTag: () => void
  onAssignOwner: () => void
  onDelete: () => void
  className?: string
}

export function BulkEditBar({
  selectedIds,
  onClearSelection,
  onMove,
  onTag,
  onAssignOwner,
  onDelete,
  className,
}: BulkEditBarProps) {
  if (selectedIds.length === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-20 left-4 right-4 z-40',
        'bg-kraft-800 text-kraft-50 rounded-2xl shadow-xl p-3',
        'flex items-center gap-2',
        className
      )}
    >
      <button
        onClick={onClearSelection}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-kraft-700 transition-colors"
      >
        <X size={14} />
      </button>

      <span className="text-sm font-medium flex-1">
        {selectedIds.length} selected
      </span>

      <button
        onClick={onMove}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-kraft-700 hover:bg-kraft-600 text-xs transition-colors"
      >
        <MoveRight size={12} /> Move
      </button>

      <button
        onClick={onTag}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-kraft-700 hover:bg-kraft-600 text-xs transition-colors"
      >
        <Tag size={12} /> Tag
      </button>

      <button
        onClick={onAssignOwner}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-kraft-700 hover:bg-kraft-600 text-xs transition-colors"
      >
        <User size={12} /> Owner
      </button>

      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-rust/80 hover:bg-accent-rust text-xs transition-colors"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
