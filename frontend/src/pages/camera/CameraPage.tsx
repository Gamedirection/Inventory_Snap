import { useEffect } from 'react'
import { Upload, Loader2 } from 'lucide-react'
import { useParams } from '@tanstack/react-router'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { CaptureButton } from '@/components/camera/CaptureButton'
import { PhotoQueue } from '@/components/camera/PhotoQueue'
import { LocationContextBar } from '@/components/camera/LocationContextBar'
import { DropZone } from '@/components/camera/DropZone'
import { useCameraStore } from '@/store/cameraStore'
import { useSiteStore } from '@/store/siteStore'
import { useUploadPhoto } from '@/api/hooks/usePhotos'

export function CameraPage() {
  const { siteId } = useParams({ strict: false }) as { siteId?: string }
  const { setActiveSite } = useSiteStore()
  const { activeSiteId, captureQueue, updateQueueItem } = useCameraStore()
  const upload = useUploadPhoto(siteId ?? '')

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
        await upload.mutateAsync({
          blob: item.blob,
          locationId: item.locationId,
          capturedAt: item.capturedAt,
        })
        updateQueueItem(item.tempId, { uploadStatus: 'uploaded' })
        toast.success('Photo uploaded — AI processing started')
      } catch {
        updateQueueItem(item.tempId, { uploadStatus: 'failed' })
        toast.error('Upload failed — tap to retry')
      }
    })
  }, [captureQueue.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = captureQueue.filter((i) => i.uploadStatus === 'pending').length
  const uploadingCount = captureQueue.filter((i) => i.uploadStatus === 'uploading').length

  return (
    <AppShell headerTitle="Camera">
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

          {pendingCount > 0 && uploadingCount === 0 && (
            <p className="text-xs text-kraft-400">{pendingCount} queued for upload</p>
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

        {/* Upload summary */}
        {captureQueue.some((i) => i.uploadStatus === 'uploaded') && (
          <div className="flex items-center gap-2 text-xs text-accent-sage bg-accent-sage/10
                          border border-accent-sage/30 rounded-xl px-3 py-2">
            <Upload className="w-3.5 h-3.5" />
            <span>
              {captureQueue.filter((i) => i.uploadStatus === 'uploaded').length} photo
              {captureQueue.filter((i) => i.uploadStatus === 'uploaded').length > 1 ? 's' : ''} uploaded
              — check Review tab for AI results
            </span>
          </div>
        )}
      </div>
    </AppShell>
  )
}
