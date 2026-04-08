import { useEffect, useRef } from 'react'
import { X, Loader2, CheckCircle, AlertCircle, RefreshCw, ScanSearch } from 'lucide-react'
import { useCameraStore, type CaptureQueueItem } from '@/store/cameraStore'
import { usePhotoAiStatus } from '@/api/hooks/usePhotos'
import type { PhotoAiStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

// ── Upload status overlay ─────────────────────────────────────────────────────

function UploadOverlay({ status }: { status: CaptureQueueItem['uploadStatus'] }) {
  if (status === 'uploading') {
    return (
      <div className="absolute inset-0 bg-kraft-900/40 rounded-xl flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-white animate-spin" />
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="absolute inset-0 bg-accent-rust/20 rounded-xl flex items-center justify-center">
        <AlertCircle className="w-5 h-5 text-accent-rust" />
      </div>
    )
  }
  return null
}

// ── AI scan status layer — polls server while pending/processing ──────────────

function AiScanLayer({
  siteId,
  photoId,
  onStatusChange,
}: {
  siteId: string
  photoId: string
  onStatusChange: (status: PhotoAiStatus) => void
}) {
  const { data: photo } = usePhotoAiStatus(siteId, photoId)

  // Sync status back to camera store so CameraPage scanningCount stays accurate
  useEffect(() => {
    if (photo?.ai_status) {
      onStatusChange(photo.ai_status)
    }
  }, [photo?.ai_status]) // eslint-disable-line react-hooks/exhaustive-deps

  const status = photo?.ai_status

  if (status === 'pending' || status === 'processing') {
    return (
      <div className="absolute inset-0 bg-kraft-900/55 rounded-xl flex flex-col items-center justify-center gap-1">
        <RefreshCw className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: '1.4s' }} />
        <span className="text-[9px] font-medium text-amber-200 tracking-wide uppercase">
          {status === 'processing' ? 'Scanning…' : 'Queued'}
        </span>
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <div className="absolute top-1 right-1 flex items-center gap-0.5
                       bg-accent-sage rounded-full px-1 py-0.5">
        <ScanSearch className="w-2.5 h-2.5 text-white" />
        <span className="text-[8px] font-semibold text-white">Done</span>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="absolute top-1 right-1 flex items-center gap-0.5
                       bg-accent-rust rounded-full px-1 py-0.5">
        <span className="text-[8px] font-semibold text-white">AI fail</span>
      </div>
    )
  }

  return null
}

// ── Main component ────────────────────────────────────────────────────────────

export function PhotoQueue() {
  const { captureQueue, removeFromQueue, updateQueueItem } = useCameraStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [captureQueue.length])

  if (captureQueue.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-kraft-400">
        Photos will appear here
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto py-1 px-1 scrollbar-hide"
      style={{ scrollBehavior: 'smooth' }}
    >
      {captureQueue.map((item) => (
        <div
          key={item.tempId}
          className={cn(
            'relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden',
            'border-2',
            item.uploadStatus === 'uploaded' && !item.aiStatus             ? 'border-kraft-300' :
            item.uploadStatus === 'uploaded' && item.aiStatus === 'completed' ? 'border-accent-sage/60' :
            item.uploadStatus === 'uploaded' && item.aiStatus === 'failed'    ? 'border-accent-rust/50' :
            item.uploadStatus === 'uploaded'                                  ? 'border-amber-400/60' :
            item.uploadStatus === 'failed'                                    ? 'border-accent-rust/50' :
            item.uploadStatus === 'uploading'                                 ? 'border-kraft-400' :
                                                                               'border-kraft-300'
          )}
        >
          <img
            src={item.thumbnailUrl ?? ''}
            alt="Queued photo"
            className="w-full h-full object-cover"
          />

          {/* Upload in-progress overlays */}
          <UploadOverlay status={item.uploadStatus} />

          {/* AI scanning animation — shown once upload succeeds and photoId is known */}
          {item.uploadStatus === 'uploaded' && item.photoId && (
            <AiScanLayer
              siteId={item.siteId}
              photoId={item.photoId}
              onStatusChange={(status) =>
                updateQueueItem(item.tempId, { aiStatus: status })
              }
            />
          )}

          {/* Uploaded but no AI status yet — show plain checkmark */}
          {item.uploadStatus === 'uploaded' && !item.photoId && (
            <div className="absolute bottom-1 right-1">
              <CheckCircle className="w-4 h-4 text-accent-sage fill-white" />
            </div>
          )}

          {/* Remove button */}
          {item.uploadStatus !== 'uploading' && (
            <button
              onClick={() => removeFromQueue(item.tempId)}
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full
                         bg-kraft-900/70 text-white flex items-center justify-center
                         z-10"
              aria-label="Remove photo"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
