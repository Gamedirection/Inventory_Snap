import React from 'react'
import { useRouterState, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { SiteSelector } from './SiteSelector'

interface PageHeaderProps {
  title?: string
  showBack?: boolean
  actionSlot?: React.ReactNode
  showSiteSelector?: boolean
}

export function PageHeader({
  title,
  showBack,
  actionSlot,
  showSiteSelector = true,
}: PageHeaderProps) {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const path = routerState.location.pathname

  // Auto-detect if we're at a nested route that benefits from back button
  const isNested = showBack !== undefined
    ? showBack
    : path.split('/').length > 3

  return (
    <header className="sticky top-0 z-30 bg-kraft-50/95 backdrop-blur-sm
                       border-b border-kraft-200 safe-top">
      <div className="flex items-center gap-2 px-4 h-14 lg:max-w-[50%] lg:mx-auto">
        {isNested ? (
          <button
            onClick={() => navigate({ to: '..' })}
            className="p-2 -ml-2 rounded-xl text-kraft-500 hover:text-kraft-700
                       hover:bg-kraft-200 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : null}

        <div className="flex-1 min-w-0">
          {title ? (
            <h1 className="text-base font-semibold text-kraft-700 truncate">{title}</h1>
          ) : showSiteSelector ? (
            <SiteSelector />
          ) : null}
        </div>

        {actionSlot && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actionSlot}
          </div>
        )}
      </div>
    </header>
  )
}
