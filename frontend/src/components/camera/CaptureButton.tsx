import { useState } from 'react'
import { Camera } from 'lucide-react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'
import { useCamera } from '@/hooks/useCamera'
import { useCameraStore } from '@/store/cameraStore'
import { generateTempId } from '@/lib/utils'

interface CaptureButtonProps {
  disabled?: boolean
}

export function CaptureButton({ disabled }: CaptureButtonProps) {
  const [isCapturing, setIsCapturing] = useState(false)
  const { capturePhoto } = useCamera()
  const { addToQueue, activeLocationId, activeSiteId } = useCameraStore()

  const handleCapture = async () => {
    if (isCapturing || !activeSiteId) return
    setIsCapturing(true)

    try {
      // Haptic feedback on native
      if (Capacitor.isNativePlatform()) {
        await Haptics.impact({ style: ImpactStyle.Medium })
      }

      const result = await capturePhoto()
      if (!result) return

      const item = {
        tempId: generateTempId(),
        blob: result.blob,
        siteId: activeSiteId,
        locationId: activeLocationId,
        capturedAt: result.capturedAt,
        gpsLatitude: result.gpsLatitude,
        gpsLongitude: result.gpsLongitude,
        uploadStatus: 'pending' as const,
        thumbnailUrl: URL.createObjectURL(result.blob),
      }

      addToQueue(item)
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <button
      onClick={handleCapture}
      disabled={disabled || isCapturing || !activeSiteId}
      aria-label="Capture photo"
      className="
        w-20 h-20 rounded-full bg-kraft-700 shadow-lg shadow-kraft-800/30
        flex items-center justify-center
        hover:bg-kraft-800 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        transition-all duration-150
        border-4 border-kraft-50
        ring-4 ring-kraft-300
      "
    >
      {isCapturing ? (
        <div className="w-7 h-7 rounded-full border-3 border-kraft-100 border-t-transparent animate-spin" />
      ) : (
        <Camera className="w-8 h-8 text-kraft-50" strokeWidth={1.8} />
      )}
    </button>
  )
}
