import { useState } from 'react'
import { ChevronDown, Building2, Plus, Check } from 'lucide-react'
import { useSites } from '@/api/hooks/useSites'
import { useSiteStore } from '@/store/siteStore'
import { useNavigate } from '@tanstack/react-router'

export function SiteSelector() {
  const [open, setOpen] = useState(false)
  const { activeSiteId, activeSiteName, setActiveSite } = useSiteStore()
  const { data: sites = [] } = useSites()
  const navigate = useNavigate()

  const handleSelect = (id: string, name: string) => {
    setActiveSite(id, name)
    setOpen(false)
    navigate({ to: `/sites/${id}/inventory` })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-kraft-700 font-semibold text-sm
                   hover:text-kraft-800 transition-colors max-w-[180px]"
      >
        <Building2 className="w-4 h-4 flex-shrink-0 text-kraft-500" />
        <span className="truncate">{activeSiteName ?? 'Select site'}</span>
        <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-kraft-400" />
      </button>

      {/* Bottom sheet */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-kraft-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-kraft-50 rounded-t-3xl shadow-2xl max-h-[60vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-kraft-300" />
            </div>

            <div className="px-4 py-3 border-b border-kraft-200">
              <h2 className="text-sm font-semibold text-kraft-700">Switch Site</h2>
            </div>

            <ul className="py-2">
              {sites.map((site) => (
                <li key={site.id}>
                  <button
                    onClick={() => handleSelect(site.id, site.name)}
                    className="w-full flex items-center gap-3 px-4 py-3
                               hover:bg-kraft-100 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-kraft-200 flex items-center
                                    justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-kraft-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-kraft-700 truncate">{site.name}</p>
                      <p className="text-xs text-kraft-400">
                        {site.item_count} items · {site.member_count} members
                      </p>
                    </div>
                    {activeSiteId === site.id && (
                      <Check className="w-4 h-4 text-accent-sage flex-shrink-0" />
                    )}
                  </button>
                </li>
              ))}
            </ul>

            <div className="px-4 pb-4 pt-2 border-t border-kraft-200">
              <button
                onClick={() => { setOpen(false); navigate({ to: '/sites' }) }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                           border border-dashed border-kraft-300 text-kraft-500
                           hover:bg-kraft-100 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Manage sites
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
