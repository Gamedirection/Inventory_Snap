import { useState } from 'react'
import { SwipeCard } from '@/components/ui/SwipeCard'
import { ReviewCard } from './ReviewCard'
import type { ReviewQueueItem } from '@/lib/types'
import { useBulkReview } from '@/api/hooks/useReview'
import toast from 'react-hot-toast'

interface SwipeDeckProps {
  items: ReviewQueueItem[]
  siteId: string
}

export function SwipeDeck({ items, siteId }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const bulkReview = useBulkReview(siteId)

  const currentItem = items[currentIndex]
  const nextItem    = items[currentIndex + 1]

  if (!currentItem) return null

  const advance = () => {
    if (currentIndex < items.length - 1) {
      setCurrentIndex((i) => i + 1)
    }
  }

  const handleSwipeRight = async () => {
    // Approve all proposals in this photo
    const actions = currentItem.proposals.map((p) => ({
      proposalId: p.id,
      action: 'approve' as const,
    }))
    try {
      await bulkReview.mutateAsync(actions)
      toast.success('All approved')
    } catch {
      toast.error('Failed to approve')
    }
    advance()
  }

  const handleSwipeLeft = async () => {
    const actions = currentItem.proposals.map((p) => ({
      proposalId: p.id,
      action: 'reject' as const,
    }))
    try {
      await bulkReview.mutateAsync(actions)
      toast('Rejected', { icon: '🗑' })
    } catch {
      toast.error('Failed to reject')
    }
    advance()
  }

  return (
    <div className="relative w-full">
      {/* Next card peeking underneath */}
      {nextItem && (
        <div
          className="absolute inset-x-4 top-2 z-0 opacity-60 scale-[0.97] origin-bottom"
          aria-hidden
        >
          <div className="card p-0 overflow-hidden pointer-events-none">
            <div className="aspect-[4/3] bg-kraft-200" />
          </div>
        </div>
      )}

      {/* Current card */}
      <div className="relative z-10">
        <SwipeCard
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          threshold={100}
        >
          <ReviewCard
            item={currentItem}
            siteId={siteId}
            onDone={advance}
          />
        </SwipeCard>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-1.5 mt-4">
        {items.slice(0, Math.min(items.length, 7)).map((_, i) => (
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
        {items.length > 7 && (
          <span className="text-xs text-kraft-400">+{items.length - 7}</span>
        )}
      </div>
    </div>
  )
}
