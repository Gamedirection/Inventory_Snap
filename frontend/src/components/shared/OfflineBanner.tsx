import { WifiOff } from 'lucide-react'
import { useOfflineStore } from '@/store/offlineStore'

export function OfflineBanner() {
  const isOnline = useOfflineStore((s) => s.isOnline)

  if (isOnline) return null

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 bg-kraft-200
                 border-b border-kraft-300 text-kraft-600 text-sm font-medium"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-4 h-4 flex-shrink-0 text-kraft-500" />
      <span>Offline — changes will sync when reconnected</span>
    </div>
  )
}
