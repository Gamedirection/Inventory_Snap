import { useParams, useNavigate } from '@tanstack/react-router'
import {
  Building2, Package, Users, Map, Camera, ClipboardCheck, ChevronRight, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useDeleteSite, useSite } from '@/api/hooks/useSites'
import { useReviewQueueCount } from '@/api/hooks/useReview'
import { useSiteStore } from '@/store/siteStore'

export function SiteDetailPage() {
  const { siteId } = useParams({ strict: false }) as { siteId?: string }
  const navigate = useNavigate()
  const { data: site, isLoading } = useSite(siteId ?? null)
  const { data: reviewCount } = useReviewQueueCount(siteId ?? null)
  const deleteSite = useDeleteSite(siteId ?? '')
  const { clearActiveSite } = useSiteStore()

  if (isLoading) {
    return (
      <AppShell showBack>
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      </AppShell>
    )
  }

  if (!site) return null

  const canDeleteSite = site.role === 'owner'

  const handleDeleteSite = async () => {
    if (!siteId || !canDeleteSite) return
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
      description: 'Capture new items',
      onClick: () => navigate({ to: `/sites/${siteId}/camera` }),
    },
    {
      icon: ClipboardCheck,
      label: 'Review Queue',
      description: reviewCount?.pending_count
        ? `${reviewCount.pending_count} pending`
        : 'All reviewed',
      badge: reviewCount?.pending_count,
      onClick: () => navigate({ to: `/sites/${siteId}/review` }),
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
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-kraft-200 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-kraft-600" />
            </div>
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
          {canDeleteSite && (
            <div className="mt-4 pt-4 border-t border-kraft-200">
              <Button
                type="button"
                variant="rust"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={handleDeleteSite}
                loading={deleteSite.isPending}
              >
                Delete Site
              </Button>
            </div>
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
    </AppShell>
  )
}
