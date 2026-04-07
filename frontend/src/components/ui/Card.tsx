import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  hoverable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  none: 'p-0',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-6',
}

export function Card({
  children,
  className,
  onClick,
  hoverable = false,
  padding = 'md',
}: CardProps) {
  const isInteractive = !!onClick || hoverable
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'bg-kraft-100 border border-kraft-200 rounded-xl shadow-sm',
        paddingClasses[padding],
        isInteractive &&
          'cursor-pointer hover:border-kraft-300 hover:shadow-md active:scale-[0.98] transition-all duration-150',
        className
      )}
    >
      {children}
    </div>
  )
}
