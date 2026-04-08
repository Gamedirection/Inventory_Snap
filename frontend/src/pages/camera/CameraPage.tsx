import { useEffect, useState } from 'react'
import { Upload, Loader2, ScanSearch, Camera, ClipboardCheck, CheckCircle2 } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { CaptureButton } from '@/components/camera/CaptureButton'
import { PhotoQueue } from '@/components/camera/PhotoQueue'
import { LocationContextBar } from '@/components/camera/LocationContextBar'
import { DropZone } from '@/components/camera/DropZone'
import { SwipeDeck } from '@/components/review/SwipeDeck'
import { Spinner } from '@/components/ui/Spinner'
import { useCameraStore } from '@/store/cameraStore'
import { useSiteStore } from '@/store/siteStore'
import { useAuthStore } from '@/store/authStore'
import { useUploadPhoto } from '@/api/hooks/usePhotos'
import { useReviewQueue, useReviewQueueCount, reviewKeys } from '@/api/hooks/useReview'
import { cn } from '@/lib/utils'

type Tab = 'capture' | 'review'

export function CameraPage() {
  const { siteId } = useParams({ strict: false }) as { siteId?: string }
  const [tab, setTab] = useState<Tab>('capture')

  const { setActiveSite } = useSiteStore()
  const { activeSiteId, captureQueue, updateQueueItem } = useCameraStore()
  const { accessToken } = useAuthStore()
  const upload = useUploadPhoto(siteId ?? '')

  const { data: reviewData, isLoading: reviewLoading } = useReviewQueue(siteId ?? null)
  const { data: countData } = useReviewQueueCount(siteId ?? null)
  const qc = useQueryClient()

  const pendingCount = countData?.pending_count ?? 0

  // Keep camera store in sync with the route siteId
  useEffect(() => {
    if (siteId && siteId !== activeSiteId) {
      setActiveSite(siteId, '')
    }
  }, [siteId, activeSiteId, setActiveSite])

  // Process pending uploads whenever queue changes
  useEffect(() => {
    const pending = captureQueue.filter((item) => item.uploadStatus === 'pending')
    if (!siteId || pending.length === 0) return

    pending.forEach(async (item) => {
      updateQueueItem(item.tempId, { uploadStatus: 'uploading' })
      try {
        const result = await upload.mutateAsync({
          blob: item.blob,
          locationId: item.locationId,
          capturedAt: item.capturedAt,
          gpsLatitude: item.gpsLatitude,
          gpsLongitude: item.gpsLongitude,
        })
        updateQueueItem(item.tempId, {
          uploadStatus: 'uploaded',
          photoId: result.photo_id,
          aiStatus: result.ai_status,
        })
        toast.success('Photo uploaded — AI scanning started')
      } catch {
        updateQueueItem(item.tempId, { uploadStatus: 'failed' })
        toast.error('Upload failed — tap to retry')
      }
    })
  }, [captureQueue.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // SSE: auto-refresh review queue when AI results arrive
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

  const uploadingCount = captureQueue.filter((i) => i.uploadStatus === 'uploading').length
  const scanningCount  = captureQueue.filter(
    (i) => i.uploadStatus === 'uploaded' && (i.aiStatus === 'pending' || i.aiStatus === 'processing')
  ).length
  const queuePendingCount = captureQueue.filter((i) => i.uploadStatus === 'pending').length

  const pendingItems   = reviewData?.items?.filter((i) => i.pending_count > 0) ?? []
  const totalProposals = pendingItems.reduce((acc, i) => acc + i.proposals.length, 0)

  return (
    <AppShell headerTitle="Camera">
      {/* Tab bar */}
      <div className="sticky top-0 z-20 bg-kraft-50 border-b border-kraft-200 px-4">
        <div className="flex gap-1 max-w-lg mx-auto">
          <button
            onClick={() => setTab('capture')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === 'capture'
                ? 'border-kraft-700 text-kraft-700'
                : 'border-transparent text-kraft-400 hover:text-kraft-600'
            )}
          >
            <Camera className="w-4 h-4" />
            Capture
          </button>
          <button
            onClick={() => setTab('review')}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
              tab === 'review'
                ? 'border-kraft-700 text-kraft-700'
                : 'border-transparent text-kraft-400 hover:text-kraft-600'
            )}
          >
            <ClipboardCheck className="w-4 h-4" />
            Review
            {pendingCount > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] px-1 bg-accent-rust text-white
                               text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount > 99 ? '99+' : pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Capture tab ─────────────────────────────────────────── */}
      {tab === 'capture' && (
        <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
          {/* Location Context */}
          <section>
            <p className="section-title">Capture location</p>
            <LocationContextBar />
          </section>

          {/* Camera action area */}
          <section className="flex flex-col items-center gap-4 py-6 bg-kraft-100
                               border border-kraft-200 rounded-2xl">
            <CaptureButton disabled={!siteId} />

            {uploadingCount > 0 && (
              <div className="flex items-center gap-2 text-xs text-kraft-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Uploading {uploadingCount} photo{uploadingCount > 1 ? 's' : ''}…
              </div>
            )}

            {scanningCount > 0 && uploadingCount === 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600">
                <ScanSearch className="w-3 h-3 animate-pulse" />
                AI scanning {scanningCount} photo{scanningCount > 1 ? 's' : ''}…
              </div>
            )}

            {queuePendingCount > 0 && uploadingCount === 0 && (
              <p className="text-xs text-kraft-400">{queuePendingCount} queued for upload</p>
            )}
          </section>

          {/* Photo queue */}
          {captureQueue.length > 0 && (
            <section>
              <p className="section-title">Recent captures ({captureQueue.length})</p>
              <PhotoQueue />
            </section>
          )}

          {/* Desktop / tablet drop zone */}
          <section className="hidden sm:block">
            <p className="section-title">Batch import</p>
            <DropZone />
          </section>

          {/* Upload summary — tap to go to review */}
          {captureQueue.some((i) => i.uploadStatus === 'uploaded') && (
            <button
              onClick={() => setTab('review')}
              className="flex items-center gap-2 text-xs text-accent-sage bg-accent-sage/10
                         border border-accent-sage/30 rounded-xl px-3 py-2 w-full text-left"
            >
              <Upload className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {captureQueue.filter((i) => i.uploadStatus === 'uploaded').length} photo
                {captureQueue.filter((i) => i.uploadStatus === 'uploaded').length > 1 ? 's' : ''} uploaded
                — tap to review AI results
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── Review tab ──────────────────────────────────────────── */}
      {tab === 'review' && (
        <div className="px-4 pt-4 pb-6 max-w-lg mx-auto">
          {reviewLoading ? (
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
                No items waiting for review. Capture photos to add inventory.
              </p>
              {reviewData && reviewData.total > 0 && (
                <p className="mt-4 text-xs text-kraft-400">
                  {reviewData.total} total photos processed
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-kraft-500" />
                <p className="text-sm font-medium text-kraft-600">
                  {totalProposals} detected item{totalProposals !== 1 ? 's' : ''} to review
                </p>
                <span className="ml-auto text-xs text-kraft-400">↑ add · ↓ skip</span>
              </div>
              {siteId && <SwipeDeck items={pendingItems} siteId={siteId} />}
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
