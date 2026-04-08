import { useRef, useState } from 'react'
import { useParams, useNavigate } from '@tanstack/react-router'
import {
  Building2, Package, Users, Map, Camera, ClipboardCheck, ChevronRight, Trash2,
  Warehouse, Home, Factory, Store, School, Hotel, Landmark, Building, ImagePlus, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/Spinner'
import {
  useDeleteSite, useSite, useUploadSiteIcon, useDeleteSiteIcon, useSetSiteIconPreset,
} from '@/api/hooks/useSites'
import { useReviewQueueCount } from '@/api/hooks/useReview'
import { useSiteStore } from '@/store/siteStore'
import { withAuthToken } from '@/lib/utils'
import type { SiteOut } from '@/lib/types'

// ── Preset icon registry ─────────────────────────────────────────────────────

const PRESETS: { name: string; icon: LucideIcon; label: string }[] = [
  { name: 'Building2',  icon: Building2,  label: 'Office'    },
  { name: 'Building',   icon: Building,   label: 'Building'  },
  { name: 'Warehouse',  icon: Warehouse,  label: 'Warehouse' },
  { name: 'Home',       icon: Home,       label: 'Home'      },
  { name: 'Factory',    icon: Factory,    label: 'Factory'   },
  { name: 'Store',      icon: Store,      label: 'Store'     },
  { name: 'School',     icon: School,     label: 'School'    },
  { name: 'Hotel',      icon: Hotel,      label: 'Hotel'     },
  { name: 'Landmark',   icon: Landmark,   label: 'Landmark'  },
]

const PRESET_MAP: Record<string, LucideIcon> = Object.fromEntries(
  PRESETS.map(({ name, icon }) => [name, icon])
)

// ── SiteIcon — renders either a custom image, preset, or default ─────────────

function SiteIcon({ site, size = 'md' }: { site: SiteOut; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-16 h-16' : 'w-12 h-12'
  const iconDim = size === 'lg' ? 'w-8 h-8' : 'w-6 h-6'
  const iconSrc = site.icon_url ? withAuthToken(site.icon_url) ?? site.icon_url : null
  const PresetIcon = site.icon_preset ? PRESET_MAP[site.icon_preset] : null

  return (
    <div className={`${dim} rounded-xl bg-kraft-200 flex items-center justify-center overflow-hidden flex-shrink-0`}>
      {iconSrc ? (
        <img src={iconSrc} alt={site.name} className="w-full h-full object-cover" />
      ) : PresetIcon ? (
        <PresetIcon className={`${iconDim} text-kraft-600`} />
      ) : (
        <Building2 className={`${iconDim} text-kraft-600`} />
      )}
    </div>
  )
}

// ── Icon picker bottom sheet ──────────────────────────────────────────────────

function IconPickerSheet({
  site,
  onClose,
}: {
  site: SiteOut
  onClose: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadIcon = useUploadSiteIcon(site.id)
  const deleteIcon = useDeleteSiteIcon(site.id)
  const setPreset  = useSetSiteIconPreset(site.id)
  const hasIcon = !!(site.icon_url || site.icon_preset)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadIcon.mutateAsync(file)
      toast.success('Icon updated')
      onClose()
    } catch {
      toast.error('Failed to upload icon')
    }
  }

  const handlePreset = async (name: string) => {
    try {
      await setPreset.mutateAsync(name)
      toast.success('Icon updated')
      onClose()
    } catch {
      toast.error('Failed to set icon')
    }
  }

  const handleRemove = async () => {
    try {
      await deleteIcon.mutateAsync()
      toast.success('Icon removed')
      onClose()
    } catch {
      toast.error('Failed to remove icon')
    }
  }

  const busy = uploadIcon.isPending || setPreset.isPending || deleteIcon.isPending

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-kraft-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-kraft-50 rounded-t-3xl shadow-2xl max-h-[75vh] overflow-y-auto pb-[max(env(safe-area-inset-bottom,0px),16px)]">
        {/* Handle + header */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-kraft-300" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-kraft-200">
          <h2 className="text-sm font-semibold text-kraft-700">Site icon</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-kraft-200 text-kraft-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-5">
          {/* Upload custom image */}
          <div>
            <p className="text-xs font-medium text-kraft-500 mb-2">Custom image</p>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed
                         border-kraft-300 hover:border-kraft-500 hover:bg-kraft-100 transition-colors"
            >
              {uploadIcon.isPending ? (
                <Spinner size="sm" />
              ) : (
                <ImagePlus className="w-5 h-5 text-kraft-500" />
              )}
              <span className="text-sm text-kraft-600">
                {site.icon_url ? 'Replace with new photo…' : 'Upload a photo…'}
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handleFile(e)}
            />
          </div>

          {/* Preset icons */}
          <div>
            <p className="text-xs font-medium text-kraft-500 mb-2">Choose an icon</p>
            <div className="grid grid-cols-5 gap-2">
              {PRESETS.map(({ name, icon: Icon, label }) => {
                const active = site.icon_preset === name
                return (
                  <button
                    key={name}
                    onClick={() => void handlePreset(name)}
                    disabled={busy}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border-2 transition-colors
                      ${active
                        ? 'border-kraft-600 bg-kraft-200'
                        : 'border-kraft-200 hover:border-kraft-400 hover:bg-kraft-100'
                      }`}
                  >
                    {setPreset.isPending && active ? (
                      <Spinner size="sm" />
                    ) : (
                      <Icon className="w-6 h-6 text-kraft-700" />
                    )}
                    <span className="text-[9px] text-kraft-500 leading-none">{label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Remove */}
          {hasIcon && (
            <button
              onClick={() => void handleRemove()}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                         text-sm text-accent-rust hover:bg-accent-rust/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Remove icon
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SiteDetailPage() {
  const { siteId } = useParams({ strict: false }) as { siteId?: string }
  const navigate = useNavigate()
  const { data: site, isLoading } = useSite(siteId ?? null)
  const { data: reviewCount } = useReviewQueueCount(siteId ?? null)
  const deleteSite = useDeleteSite(siteId ?? '')
  const { clearActiveSite } = useSiteStore()
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  if (isLoading) {
    return (
      <AppShell showBack>
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      </AppShell>
    )
  }

  if (!site) return null

  const canEdit   = site.role === 'owner' || site.role === 'admin'
  const canDelete = site.role === 'owner'

  const handleDeleteSite = async () => {
    if (!siteId || !canDelete) return
    const confirmed = window.confirm(`Delete site "${site.name}"? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteSite.mutateAsync()
      clearActiveSite()
      toast.success('Site deleted')
      navigate({ to: '/sites' })
    } catch {
      toast.error('Failed to delete site')
    }
  }

  const actions = [
    {
      icon: Package,
      label: 'Inventory',
      description: `${site.item_count} items`,
      onClick: () => navigate({ to: `/sites/${siteId}/inventory` }),
    },
    {
      icon: Camera,
      label: 'Camera',
      description: reviewCount?.pending_count
        ? `Capture new items · ${reviewCount.pending_count} pending review`
        : 'Capture and review items',
      onClick: () => navigate({ to: `/sites/${siteId}/camera` }),
    },
    {
      icon: ClipboardCheck,
      label: 'Review Queue',
      description: reviewCount?.pending_count ? `${reviewCount.pending_count} pending` : 'All reviewed',
      badge: reviewCount?.pending_count,
      onClick: () => navigate({ to: `/sites/${siteId}/camera` }),
    },
    {
      icon: Map,
      label: 'Site Map',
      description: 'Locations & floor plan',
      onClick: () => navigate({ to: `/sites/${siteId}/map` }),
    },
    {
      icon: Users,
      label: 'Members',
      description: `${site.member_count} members`,
      onClick: () => {},
    },
  ]

  return (
    <AppShell showBack headerTitle={site.name}>
      <div className="px-4 pt-4 pb-8 max-w-lg mx-auto space-y-4">
        {/* Site header card */}
        <div className="card relative">
          {/* Trash — top-right corner, owner only */}
          {canDelete && (
            <button
              onClick={() => void handleDeleteSite()}
              disabled={deleteSite.isPending}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-kraft-400
                         hover:text-accent-rust hover:bg-accent-rust/10 transition-colors"
              aria-label="Delete site"
            >
              {deleteSite.isPending
                ? <Spinner size="sm" />
                : <Trash2 className="w-4 h-4" />}
            </button>
          )}

          <div className="flex items-center gap-3 pr-8">
            {/* Clickable icon */}
            <button
              onClick={() => canEdit && setIconPickerOpen(true)}
              className={`relative group flex-shrink-0 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
              aria-label="Change site icon"
            >
              <SiteIcon site={site} size="lg" />
              {canEdit && (
                <div className="absolute inset-0 rounded-xl bg-kraft-900/0 group-hover:bg-kraft-900/30
                                flex items-center justify-center transition-colors">
                  <ImagePlus className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-kraft-800">{site.name}</h1>
              {site.address && (
                <p className="text-xs text-kraft-400 truncate mt-0.5">{site.address}</p>
              )}
            </div>
          </div>

          {site.description && (
            <p className="mt-3 text-sm text-kraft-500">{site.description}</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="card p-0 overflow-hidden divide-y divide-kraft-200">
          {actions.map(({ icon: Icon, label, description, badge, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center gap-3 px-4 py-3.5
                         hover:bg-kraft-100 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-kraft-200 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-kraft-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-kraft-700">{label}</p>
                <p className="text-xs text-kraft-400">{description}</p>
              </div>
              {badge ? (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent-rust
                                 text-white text-xs font-bold flex items-center justify-center">
                  {badge}
                </span>
              ) : (
                <ChevronRight className="w-4 h-4 text-kraft-400 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {iconPickerOpen && site && (
        <IconPickerSheet site={site} onClose={() => setIconPickerOpen(false)} />
      )}
    </AppShell>
  )
}
