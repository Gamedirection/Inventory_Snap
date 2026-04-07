import { useState } from 'react'
import { MapPin, ChevronRight } from 'lucide-react'
import { useCameraStore } from '@/store/cameraStore'
import { useLocationFlat } from '@/api/hooks/useLocations'
import { useSiteStore } from '@/store/siteStore'
import type { LocationOut } from '@/lib/types'

function buildBreadcrumb(locations: LocationOut[], locationId: string | null): string {
  if (!locationId) return 'No location set'
  const loc = locations.find((l) => l.id === locationId)
  if (!loc) return 'Unknown location'
  // path is dot-separated list of ancestor IDs in backend; reconstruct from flat list
  const parts: string[] = []
  let current: LocationOut | undefined = loc
  while (current) {
    parts.unshift(current.name)
    current = current.parent_id
      ? locations.find((l) => l.id === current!.parent_id)
      : undefined
  }
  return parts.join(' › ')
}

interface LocationPickerModalProps {
  siteId: string
  onSelect: (locationId: string | null) => void
  onClose: () => void
}

function LocationPickerModal({ siteId, onSelect, onClose }: LocationPickerModalProps) {
  const { data: locations = [] } = useLocationFlat(siteId)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-kraft-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-kraft-50 rounded-t-3xl max-h-[70vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-kraft-300" />
        </div>
        <div className="px-4 py-3 border-b border-kraft-200">
          <h2 className="text-sm font-semibold text-kraft-700">Set Location</h2>
        </div>

        <ul className="py-2">
          <li>
            <button
              onClick={() => { onSelect(null); onClose() }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-kraft-100 text-left"
            >
              <MapPin className="w-4 h-4 text-kraft-400" />
              <span className="text-sm text-kraft-500 italic">No location</span>
            </button>
          </li>
          {locations.map((loc) => (
            <li key={loc.id}>
              <button
                onClick={() => { onSelect(loc.id); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-kraft-100 text-left"
                style={{ paddingLeft: `${((loc.path?.split('.').length ?? 1)) * 16}px` }}
              >
                <MapPin className="w-4 h-4 text-kraft-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-kraft-700 truncate">{loc.name}</p>
                  {loc.description && (
                    <p className="text-xs text-kraft-400 truncate">{loc.description}</p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function LocationContextBar() {
  const [pickerOpen, setPickerOpen] = useState(false)
  const { activeSiteId, activeSiteName } = useSiteStore()
  const { activeLocationId, setActiveLocation } = useCameraStore()
  const { data: locations = [] } = useLocationFlat(activeSiteId)

  const breadcrumb = buildBreadcrumb(locations, activeLocationId)

  const handleSelect = (locationId: string | null) => {
    if (activeSiteId) {
      setActiveLocation(activeSiteId, locationId)
    }
  }

  return (
    <>
      <button
        onClick={() => setPickerOpen(true)}
        className="flex items-center gap-2 w-full px-4 py-2.5
                   bg-kraft-100 border border-kraft-200 rounded-xl
                   hover:border-kraft-300 transition-colors text-left"
      >
        <MapPin className="w-4 h-4 text-kraft-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-kraft-400 leading-none mb-0.5">{activeSiteName ?? 'Site'}</p>
          <p className="text-sm font-medium text-kraft-700 truncate">{breadcrumb}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-kraft-400 flex-shrink-0" />
      </button>

      {pickerOpen && activeSiteId && (
        <LocationPickerModal
          siteId={activeSiteId}
          onSelect={handleSelect}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  )
}
