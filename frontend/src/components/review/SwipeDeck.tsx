import { useState, useCallback } from 'react'
import { SwipeCard } from '@/components/ui/SwipeCard'
import { ReviewCard } from './ReviewCard'
import type { ReviewQueueItem, ProposalOut } from '@/lib/types'
import { useApproveProposal, useRejectProposal } from '@/api/hooks/useReview'
import toast from 'react-hot-toast'

interface FlatCard {
  proposal: ProposalOut
  photoUrl: string
  locationName: string | null
  photoIndex: number   // 1-based within its photo
  photoTotal: number   // total proposals in its photo
}

function flattenQueue(items: ReviewQueueItem[]): FlatCard[] {
  return items.flatMap((item) =>
    item.proposals.map((proposal, i) => ({
      proposal,
      photoUrl: item.photo.url || item.photo.thumbnail_url || '',
      locationName: item.photo.location?.name ?? null,
      photoIndex: i + 1,
      photoTotal: item.proposals.length,
    }))
  )
}

interface SwipeDeckProps {
  items: ReviewQueueItem[]
  siteId: string
}

export function SwipeDeck({ items, siteId }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const approve = useApproveProposal(siteId)
  const reject  = useRejectProposal(siteId)

  const flatCards = flattenQueue(items)
  const current   = flatCards[currentIndex]
  const next      = flatCards[currentIndex + 1]

  const advance = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, flatCards.length))
  }, [flatCards.length])

  // Swipe UP or RIGHT → approve (add to inventory) then advance
  const handleApprove = useCallback(async () => {
    if (!current) return
    try {
      await approve.mutateAsync({ proposalId: current.proposal.id })
      toast.success(`"${current.proposal.ai_label ?? 'Item'}" added to inventory`)
      advance()
    } catch {
      toast.error('Failed to approve — please try again')
    }
  }, [current, approve, advance])

  // Swipe DOWN → skip without adding, then advance
  const handleSkip = useCallback(async () => {
    if (!current) return
    try {
      await reject.mutateAsync({ proposalId: current.proposal.id })
      toast('Skipped', { icon: '→' })
      advance()
    } catch {
      toast.error('Failed to skip — please try again')
    }
  }, [current, reject, advance])

  // Swipe LEFT → hard reject (delete from queue) then advance
  const handleDelete = useCallback(async () => {
    if (!current) return
    try {
      await reject.mutateAsync({ proposalId: current.proposal.id })
      toast('Deleted', { icon: '🗑' })
      advance()
    } catch {
      toast.error('Failed to delete — please try again')
    }
  }, [current, reject, advance])

  if (!current) return null

  return (
    <div className="relative w-full">
      {/* Ghost of next card peeking below */}
      {next && (
        <div
          className="absolute inset-x-4 top-2 z-0 opacity-50 scale-[0.97] origin-bottom pointer-events-none"
          aria-hidden
        >
          <div className="card p-0 overflow-hidden">
            <div className="aspect-[4/3] bg-kraft-200" />
            <div className="px-4 py-3 h-[72px] bg-kraft-100" />
          </div>
        </div>
      )}

      {/* Current card */}
      <div className="relative z-10">
        <SwipeCard
          onSwipeUp={handleApprove}
          onSwipeRight={handleApprove}
          onSwipeDown={handleSkip}
          onSwipeLeft={handleDelete}
          threshold={90}
        >
          <ReviewCard
            proposal={current.proposal}
            photoUrl={current.photoUrl}
            locationName={current.locationName}
            photoIndex={current.photoIndex}
            photoTotal={current.photoTotal}
          />
        </SwipeCard>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {flatCards.slice(0, Math.min(flatCards.length, 9)).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === currentIndex
                ? 'w-4 bg-kraft-600'
                : i < currentIndex
                ? 'w-1.5 bg-kraft-300'
                : 'w-1.5 bg-kraft-200'
            }`}
          />
        ))}
        {flatCards.length > 9 && (
          <span className="text-xs text-kraft-400 self-center">+{flatCards.length - 9}</span>
        )}
      </div>

      <p className="text-center text-xs text-kraft-400 mt-2">
        {Math.max(flatCards.length - currentIndex, 0)} item{flatCards.length - currentIndex !== 1 ? 's' : ''} remaining
      </p>
    </div>
  )
}
