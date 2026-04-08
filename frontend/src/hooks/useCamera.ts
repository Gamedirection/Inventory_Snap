import { useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'

export interface CapturedPhotoResult {
  blob: Blob
  capturedAt: string
  gpsLatitude: number | null
  gpsLongitude: number | null
}

async function getCurrentCoordinates(): Promise<{
  gpsLatitude: number | null
  gpsLongitude: number | null
}> {
  try {
    if (Capacitor.isNativePlatform()) {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
      })
      return {
        gpsLatitude: position.coords.latitude,
        gpsLongitude: position.coords.longitude,
      }
    }

    if (!navigator.geolocation) {
      return { gpsLatitude: null, gpsLongitude: null }
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 5000,
      })
    })

    return {
      gpsLatitude: position.coords.latitude,
      gpsLongitude: position.coords.longitude,
    }
  } catch {
    return { gpsLatitude: null, gpsLongitude: null }
  }
}

export function useCamera() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const capturePhoto = async (): Promise<CapturedPhotoResult | null> => {
    const capturedAt = new Date().toISOString()
    const coordsPromise = getCurrentCoordinates()

    // Native (Android / iOS)
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera,
          quality: 85,
        })
        if (!photo.dataUrl) return null
        const res = await fetch(photo.dataUrl)
        const blob = await res.blob()
        const coords = await coordsPromise
        return { blob, capturedAt, ...coords }
      } catch {
        return null
      }
    }

    // Web: programmatic click on hidden file input
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.capture = 'environment'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) {
          resolve(null)
          return
        }
        const coords = await coordsPromise
        resolve({
          blob: file,
          capturedAt,
          ...coords,
        })
      }
      input.click()
    })
  }

  const pickFromGallery = async (): Promise<Blob[]> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const photo = await Camera.getPhoto({
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos,
          quality: 85,
        })
        if (!photo.dataUrl) return []
        const res = await fetch(photo.dataUrl)
        return [await res.blob()]
      } catch {
        return []
      }
    }

    // Web: multi-file input
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.multiple = true
      input.onchange = async () => {
        const files = Array.from(input.files ?? [])
        resolve(files)
      }
      input.click()
    })
  }

  return { capturePhoto, pickFromGallery, fileInputRef }
}
