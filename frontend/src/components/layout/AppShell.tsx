import React from 'react'
import { PageHeader } from './PageHeader'
import { BottomNav } from './BottomNav'
import { OfflineBanner } from '@/components/shared/OfflineBanner'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface AppShellProps {
  children: React.ReactNode
  headerTitle?: string
  headerAction?: React.ReactNode
  showBack?: boolean
  showSiteSelector?: boolean
}

export function AppShell({
  children,
  headerTitle,
  headerAction,
  showBack,
  showSiteSelector = true,
}: AppShellProps) {
  // Mount the online watcher once at shell level
  useOnlineStatus()

  return (
    <div className="flex flex-col h-[100dvh] bg-kraft-50">
      <PageHeader
        title={headerTitle}
        showBack={showBack}
        actionSlot={headerAction}
        showSiteSelector={showSiteSelector}
      />
      <OfflineBanner />
      <main className="flex-1 overflow-y-auto overscroll-contain pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
