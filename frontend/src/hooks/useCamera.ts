import { useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

export function useCamera() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const capturePhoto = async (): Promise<Blob | null> => {
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
        return res.blob()
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
        resolve(file ?? null)
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
