import { useEffect, useRef } from 'react'
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useCameraStore, type CaptureQueueItem } from '@/store/cameraStore'
import { cn } from '@/lib/utils'

function StatusOverlay({ status }: { status: CaptureQueueItem['uploadStatus'] }) {
  if (status === 'uploading') {
    return (
      <div className="absolute inset-0 bg-kraft-900/40 rounded-xl flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-white animate-spin" />
      </div>
    )
  }
  if (status === 'uploaded') {
    return (
      <div className="absolute bottom-1 right-1">
        <CheckCircle className="w-4 h-4 text-accent-sage fill-white" />
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

export function PhotoQueue() {
  const { captureQueue, removeFromQueue } = useCameraStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest
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
            item.uploadStatus === 'uploaded'  ? 'border-accent-sage/50' :
            item.uploadStatus === 'failed'    ? 'border-accent-rust/50' :
            item.uploadStatus === 'uploading' ? 'border-kraft-400' :
                                               'border-kraft-300'
          )}
        >
          <img
            src={item.thumbnailUrl ?? ''}
            alt="Queued photo"
            className="w-full h-full object-cover"
          />
          <StatusOverlay status={item.uploadStatus} />

          {/* Remove button — only for non-uploading */}
          {item.uploadStatus !== 'uploading' && (
            <button
              onClick={() => removeFromQueue(item.tempId)}
              className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full
                         bg-kraft-900/70 text-white flex items-center justify-center"
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
