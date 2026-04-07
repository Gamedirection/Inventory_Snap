import { MapPin, ArrowRight } from 'lucide-react'
import type { ItemMovement } from '@/lib/types'
import { formatRelative } from '@/lib/utils'

interface MovementTimelineProps {
  movements: ItemMovement[]
}

export function MovementTimeline({ movements }: MovementTimelineProps) {
  if (movements.length === 0) {
    return (
      <p className="text-sm text-kraft-400 text-center py-6">No movement history</p>
    )
  }

  // Most recent first
  const sorted = [...movements].sort(
    (a, b) => new Date(b.moved_at).getTime() - new Date(a.moved_at).getTime()
  )

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-5 bottom-5 w-px bg-kraft-200" aria-hidden />

      <ol className="space-y-4">
        {sorted.map((movement, idx) => {
          const isCurrent = idx === 0

          return (
            <li key={movement.id} className="relative flex gap-4">
              {/* Dot */}
              <div
                className={`
                  relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                  border-2 transition-colors
                  ${isCurrent
                    ? 'bg-kraft-700 border-kraft-700 shadow-sm'
                    : 'bg-kraft-50 border-kraft-300'
                  }
                `}
              >
                <MapPin
                  className={`w-4 h-4 ${isCurrent ? 'text-kraft-100' : 'text-kraft-400'}`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                {/* From → To */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {movement.from_location ? (
                    <span className="text-xs text-kraft-400">
                      {movement.from_location.name}
                    </span>
                  ) : (
                    <span className="text-xs text-kraft-400 italic">Added</span>
                  )}
                  {movement.from_location && (
                    <ArrowRight className="w-3 h-3 text-kraft-400 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${isCurrent ? 'text-kraft-700' : 'text-kraft-500'}`}
                  >
                    {movement.to_location?.name ?? 'Unassigned'}
                  </span>
                  {isCurrent && (
                    <span className="tag text-[10px] px-1.5 bg-accent-sage/10 text-accent-sage border-accent-sage/30">
                      Current
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs text-kraft-400">
                    {formatRelative(movement.moved_at)}
                  </span>
                  <span className="text-kraft-300">·</span>
                  <span className="text-xs text-kraft-400">
                    {movement.moved_by.full_name ?? movement.moved_by.email}
                  </span>
                </div>

                {movement.notes && (
                  <p className="mt-1 text-xs text-kraft-500 bg-kraft-200 rounded-lg px-2 py-1">
                    {movement.notes}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
