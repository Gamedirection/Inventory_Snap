import type { ProposalOut } from '@/lib/types'
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge'
import { MapPin, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewCardProps {
  /** The single proposal being reviewed on this card. */
  proposal: ProposalOut
  /** URL of the photo this proposal belongs to. */
  photoUrl: string
  /** Optional location name to display. */
  locationName?: string | null
  /** e.g. "2 of 3" — badge showing position in this photo's proposals. */
  photoIndex: number
  photoTotal: number
}

/**
 * A single-proposal review card.
 * Displays the photo with only this proposal's bounding box highlighted.
 * Swiping (handled by SwipeDeck/SwipeCard) triggers approve (up) or skip (down).
 */
export function ReviewCard({
  proposal,
  photoUrl,
  locationName,
  photoIndex,
  photoTotal,
}: ReviewCardProps) {
  const bbox = proposal.bounding_box as
    | { x: number; y: number; width: number; height: number }
    | null

  return (
    <div className="card p-0 overflow-hidden">
      {/* Photo with single bbox highlight */}
      <div className="relative bg-kraft-900 aspect-[4/3]">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt="Review photo"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-kraft-500 text-sm">
            No photo
          </div>
        )}

        {/* Bounding box — percentage-based so it works with object-contain */}
        {bbox && (
          <div
            className="absolute border-2 border-accent-sage rounded-sm pointer-events-none"
            style={{
              left:   `${bbox.x * 100}%`,
              top:    `${bbox.y * 100}%`,
              width:  `${bbox.width * 100}%`,
              height: `${bbox.height * 100}%`,
              background: 'rgba(74,124,89,0.12)',
              boxShadow: '0 0 0 1px rgba(74,124,89,0.4)',
            }}
          />
        )}

        {/* Photo count badge */}
        {photoTotal > 1 && (
          <div className="absolute top-2 left-2">
            <span className="tag bg-kraft-900/80 text-kraft-100 border-kraft-700 text-[10px]">
              {photoIndex} / {photoTotal} in photo
            </span>
          </div>
        )}

        {/* Location */}
        {locationName && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-white/70" />
            <span className="tag bg-kraft-900/70 text-kraft-100 border-kraft-700 text-[10px]">
              {locationName}
            </span>
          </div>
        )}
      </div>

      {/* Item info */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-kraft-700 leading-tight">
              {proposal.proposed_fields?.name ?? proposal.ai_label ?? 'Unknown object'}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {proposal.ai_category && (
                <span className="tag text-[10px] px-1.5">{proposal.ai_category}</span>
              )}
              <ConfidenceBadge score={proposal.ai_confidence ?? 0} />
              {proposal.brand && (
                <span className="text-xs text-kraft-400">{proposal.brand}</span>
              )}
            </div>
            {proposal.short_description && (
              <p className="text-xs text-kraft-500 mt-1 line-clamp-2">
                {proposal.short_description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Swipe hint */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 text-xs text-kraft-400',
        'border-t border-kraft-200'
      )}>
        <span className="flex items-center gap-1">
          <ChevronDown className="w-3.5 h-3.5 text-kraft-400" />
          Swipe down to skip
        </span>
        <span className="flex items-center gap-1">
          Swipe up to approve
          <ChevronUp className="w-3.5 h-3.5 text-accent-sage" />
        </span>
      </div>
    </div>
  )
}
