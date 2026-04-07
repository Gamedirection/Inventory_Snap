import React from 'react'
import { cn } from '@/lib/utils'

type BadgeVariant = 'sage' | 'rust' | 'kraft' | 'slate'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
  dot?: boolean
}

const variantClasses: Record<BadgeVariant, string> = {
  sage:  'bg-accent-sage/15 text-accent-sage border-accent-sage/30',
  rust:  'bg-accent-rust/15 text-accent-rust border-accent-rust/30',
  kraft: 'bg-kraft-200 text-kraft-600 border-kraft-300',
  slate: 'bg-accent-slate/10 text-accent-slate border-accent-slate/20',
}

const dotClasses: Record<BadgeVariant, string> = {
  sage:  'bg-accent-sage',
  rust:  'bg-accent-rust',
  kraft: 'bg-kraft-400',
  slate: 'bg-accent-slate',
}

export function Badge({ variant = 'kraft', children, className, dot }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
        variantClasses[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', dotClasses[variant])} />
      )}
      {children}
    </span>
  )
}
