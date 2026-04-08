import { create } from 'zustand'
import type { PhotoAiStatus } from '@/lib/types'

export interface CaptureQueueItem {
  tempId: string
  blob: Blob
  locationId: string | null
  siteId: string
  capturedAt: string
  gpsLatitude?: number | null
  gpsLongitude?: number | null
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed'
  thumbnailUrl?: string
  /** Set after successful upload — the real photo ID from the server */
  photoId?: string
  /** AI processing status polled from the server */
  aiStatus?: PhotoAiStatus
}

export interface RescanQueueItem {
  photoId: string
  siteId: string
  /** Label of the item that triggered the rescan (for display) */
  label: string
  aiStatus: PhotoAiStatus
}

interface CameraState {
  activeLocationId: string | null
  activeSiteId: string | null
  captureQueue: CaptureQueueItem[]
  rescanQueue: RescanQueueItem[]
  setActiveLocation: (siteId: string, locationId: string | null) => void
  addToQueue: (item: CaptureQueueItem) => void
  updateQueueItem: (tempId: string, updates: Partial<CaptureQueueItem>) => void
  removeFromQueue: (tempId: string) => void
  clearQueue: () => void
  addRescan: (item: RescanQueueItem) => void
  updateRescan: (photoId: string, aiStatus: PhotoAiStatus) => void
  removeRescan: (photoId: string) => void
}

export const useCameraStore = create<CameraState>((set) => ({
  activeLocationId: null,
  activeSiteId: null,
  captureQueue: [],
  rescanQueue: [],

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

  addRescan: (item) =>
    set((state) => ({
      // Avoid duplicates — replace if same photoId already tracked
      rescanQueue: [
        ...state.rescanQueue.filter((r) => r.photoId !== item.photoId),
        item,
      ],
    })),

  updateRescan: (photoId, aiStatus) =>
    set((state) => ({
      rescanQueue: state.rescanQueue.map((r) =>
        r.photoId === photoId ? { ...r, aiStatus } : r
      ),
    })),

  removeRescan: (photoId) =>
    set((state) => ({
      rescanQueue: state.rescanQueue.filter((r) => r.photoId !== photoId),
    })),
}))
