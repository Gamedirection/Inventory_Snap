import { create } from 'zustand'

interface OfflineState {
  isOnline: boolean
  pendingCount: number
  lastSyncAt: string | null
  setOnline: (online: boolean) => void
  setPendingCount: (count: number) => void
  setLastSyncAt: (at: string) => void
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOnline: navigator.onLine,
  pendingCount: 0,
  lastSyncAt: null,

  setOnline: (online) => set({ isOnline: online }),
  setPendingCount: (count) => set({ pendingCount: count }),
  setLastSyncAt: (at) => set({ lastSyncAt: at }),
}))
