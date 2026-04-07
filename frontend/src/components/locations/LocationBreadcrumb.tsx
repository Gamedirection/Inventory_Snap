import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LocationBreadcrumbProps {
  path: string[]
  className?: string
}

export function LocationBreadcrumb({ path, className }: LocationBreadcrumbProps) {
  if (!path.length) return null

  return (
    <div className={cn('flex items-center gap-1 text-xs text-kraft-400 flex-wrap', className)}>
      {path.map((segment, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={10} className="opacity-60" />}
          <span className={i === path.length - 1 ? 'text-kraft-600 font-medium' : ''}>{segment}</span>
        </span>
      ))}
    </div>
  )
}
