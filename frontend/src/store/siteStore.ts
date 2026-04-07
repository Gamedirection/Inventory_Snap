import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SiteState {
  activeSiteId: string | null
  activeSiteName: string | null
  setActiveSite: (id: string, name: string) => void
  clearActiveSite: () => void
}

export const useSiteStore = create<SiteState>()(
  persist(
    (set) => ({
      activeSiteId: null,
      activeSiteName: null,
      setActiveSite: (id, name) => set({ activeSiteId: id, activeSiteName: name }),
      clearActiveSite: () => set({ activeSiteId: null, activeSiteName: null }),
    }),
    { name: 'inventory-snap-site' }
  )
)
