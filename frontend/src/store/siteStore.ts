import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
      setActiveSite: (id, name) => {
        if (!UUID_RE.test(id)) {
          console.warn('siteStore: rejected non-UUID site id', id)
          return
        }
        set({ activeSiteId: id, activeSiteName: name })
      },
      clearActiveSite: () => set({ activeSiteId: null, activeSiteName: null }),
    }),
    {
      name: 'inventory-snap-site',
      // Reject persisted values that aren't valid UUIDs (handles corrupted state)
      merge: (persisted, current) => {
        const p = persisted as Partial<SiteState>
        if (p.activeSiteId && !UUID_RE.test(p.activeSiteId)) {
          return { ...current, activeSiteId: null, activeSiteName: null }
        }
        return { ...current, ...p }
      },
    }
  )
)
