import { Building2, Users, Package, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { Site } from '@/lib/types'

const ROLE_COLORS: Record<string, 'sage' | 'kraft' | 'rust' | 'slate'> = {
  owner: 'rust',
  admin: 'sage',
  editor: 'kraft',
  viewer: 'slate',
}

interface SiteCardProps {
  site: Site & { role?: string }
  onClick?: () => void
  className?: string
}

export function SiteCard({ site, onClick, className }: SiteCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'card w-full text-left flex items-start gap-3 hover:border-kraft-400 transition-colors active:scale-[0.98]',
        className
      )}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-kraft-700 flex items-center justify-center">
        <Building2 size={18} className="text-kraft-100" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-kraft-800 truncate">{site.name}</h3>
          {site.role && (
            <Badge variant={ROLE_COLORS[site.role] ?? 'kraft'} className="flex-shrink-0 text-xs">
              {site.role}
            </Badge>
          )}
        </div>

        {site.description && (
          <p className="text-sm text-kraft-500 mt-0.5 line-clamp-1">{site.description}</p>
        )}

        {site.address && (
          <p className="text-xs text-kraft-400 mt-1 truncate">{site.address}</p>
        )}
      </div>

      <ChevronRight size={16} className="flex-shrink-0 text-kraft-400 mt-1" />
    </button>
  )
}
