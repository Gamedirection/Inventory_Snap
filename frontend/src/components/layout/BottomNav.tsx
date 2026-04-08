import type { ElementType } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { Building2, Map, Camera, ClipboardCheck, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSiteStore } from '@/store/siteStore'
import { useReviewQueueCount } from '@/api/hooks/useReview'

interface NavItem {
  label: string
  icon: ElementType
  to: string
  badge?: number
}

export function BottomNav() {
  const { activeSiteId } = useSiteStore()
  const { data: countData } = useReviewQueueCount(activeSiteId)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const validSiteId = activeSiteId && UUID_RE.test(activeSiteId) ? activeSiteId : null
  const siteBase = validSiteId ? `/sites/${validSiteId}` : null

  const navItems: NavItem[] = [
    { label: 'Sites',      icon: Building2,      to: '/sites' },
    { label: 'Map',        icon: Map,            to: siteBase ? `${siteBase}/map`       : '/sites' },
    { label: 'Camera',     icon: Camera,         to: siteBase ? `${siteBase}/camera`    : '/sites' },
    { label: 'Review',     icon: ClipboardCheck, to: siteBase ? `${siteBase}/review`    : '/sites',
      badge: countData?.pending_count ?? 0 },
    { label: 'Inventory',  icon: Package,        to: siteBase ? `${siteBase}/inventory` : '/sites' },
  ]

  const isActive = (to: string) => currentPath.startsWith(to) && to !== '/sites'
    ? true
    : currentPath === to

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-kraft-50 border-t border-kraft-200 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ label, icon: Icon, to, badge }) => {
          const active = isActive(to)
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl min-w-0',
                'text-xs font-medium transition-colors duration-150',
                active
                  ? 'text-kraft-700'
                  : 'text-kraft-400 hover:text-kraft-600'
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'w-5 h-5 transition-all duration-150',
                    active && 'scale-110'
                  )}
                  strokeWidth={active ? 2.5 : 1.8}
                />
                {!!badge && badge > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1
                                   bg-accent-rust text-white text-[10px] font-bold
                                   rounded-full flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={active ? 'text-kraft-700' : ''}>{label}</span>
              {active && (
                <div className="w-1 h-1 rounded-full bg-kraft-700 mt-0.5" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
