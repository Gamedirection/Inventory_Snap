import { create } from 'zustand'

export interface CaptureQueueItem {
  tempId: string
  blob: Blob
  locationId: string | null
  siteId: string
  capturedAt: string
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed'
  thumbnailUrl?: string
}

interface CameraState {
  activeLocationId: string | null
  activeSiteId: string | null
  captureQueue: CaptureQueueItem[]
  setActiveLocation: (siteId: string, locationId: string | null) => void
  addToQueue: (item: CaptureQueueItem) => void
  updateQueueItem: (tempId: string, updates: Partial<CaptureQueueItem>) => void
  removeFromQueue: (tempId: string) => void
  clearQueue: () => void
}

export const useCameraStore = create<CameraState>((set) => ({
  activeLocationId: null,
  activeSiteId: null,
  captureQueue: [],

  setActiveLocation: (siteId, locationId) =>
    set({ activeSiteId: siteId, activeLocationId: locationId }),

  addToQueue: (item) =>
    set((state) => ({ captureQueue: [...state.captureQueue, item] })),

  updateQueueItem: (tempId, updates) =>
    set((state) => ({
      captureQueue: state.captureQueue.map((item) =>
        item.tempId === tempId ? { ...item, ...updates } : item
      ),
    })),

  removeFromQueue: (tempId) =>
    set((state) => ({
      captureQueue: state.captureQueue.filter((item) => item.tempId !== tempId),
    })),

  clearQueue: () => set({ captureQueue: [] }),
}))
