import { useEffect } from 'react'
import { CheckCircle2, ClipboardCheck } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { SwipeDeck } from '@/components/review/SwipeDeck'
import { Spinner } from '@/components/ui/Spinner'
import { useReviewQueue, reviewKeys } from '@/api/hooks/useReview'
import { useAuthStore } from '@/store/authStore'

export function ReviewPage() {
  const { siteId } = useParams({ strict: false }) as { siteId?: string }
  const qc = useQueryClient()
  const { accessToken } = useAuthStore()
  const { data, isLoading } = useReviewQueue(siteId ?? null)

  // SSE: auto-refresh when AI results arrive
  useEffect(() => {
    if (!siteId || !accessToken) return

    const es = new EventSource(
      `/api/v1/sites/${siteId}/events?token=${encodeURIComponent(accessToken)}`
    )

    const handleUpdate = () => {
      qc.invalidateQueries({ queryKey: reviewKeys.queue(siteId) })
      qc.invalidateQueries({ queryKey: reviewKeys.count(siteId) })
    }

    es.addEventListener('review_queue_updated', handleUpdate)
    es.onerror = () => es.close()

    return () => es.close()
  }, [siteId, accessToken, qc])

  const pendingItems = data?.items?.filter((i) => i.pending_count > 0) ?? []

  return (
    <AppShell headerTitle="Review Queue">
      <div className="px-4 pt-4 pb-6 max-w-lg mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-accent-sage/10 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-10 h-10 text-accent-sage" />
            </div>
            <h2 className="text-lg font-semibold text-kraft-700 mb-1">All caught up!</h2>
            <p className="text-sm text-kraft-400 max-w-xs">
              No items waiting for review. Capture more photos to add inventory.
            </p>

            {data && data.total > 0 && (
              <p className="mt-4 text-xs text-kraft-400">
                {data.total} total photos processed
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Queue count header */}
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-kraft-500" />
              <p className="text-sm font-medium text-kraft-600">
                {pendingItems.length} photo{pendingItems.length !== 1 ? 's' : ''} to review
              </p>
              <span className="ml-auto text-xs text-kraft-400">
                Swipe to act
              </span>
            </div>

            {siteId && (
              <SwipeDeck
                items={pendingItems}
                siteId={siteId}
              />
            )}
          </div>
        )}
      </div>
    </AppShell>
  )
}
