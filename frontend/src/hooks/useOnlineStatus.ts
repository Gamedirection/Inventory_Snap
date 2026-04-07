import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { Network } from '@capacitor/network'
import { useOfflineStore } from '@/store/offlineStore'
import { runSync } from '@/db/sync/syncEngine'
import { useSiteStore } from '@/store/siteStore'

export function useOnlineStatus() {
  const { setOnline } = useOfflineStore()

  useEffect(() => {
    const triggerSync = () => {
      const activeSiteId = useSiteStore.getState().activeSiteId
      if (activeSiteId) {
        runSync([activeSiteId]).catch(console.warn)
      }
    }

    if (Capacitor.isNativePlatform()) {
      let listenerHandle: { remove: () => Promise<void> } | null = null

      Network.getStatus().then((status) => {
        setOnline(status.connected)
        if (status.connected) triggerSync()
      })

      Network.addListener('networkStatusChange', (status) => {
        setOnline(status.connected)
        if (status.connected) triggerSync()
      }).then((handle) => {
        listenerHandle = handle
      })

      return () => { listenerHandle?.remove() }
    } else {
      const handleOnline = () => {
        setOnline(true)
        triggerSync()
      }
      const handleOffline = () => setOnline(false)

      window.addEventListener('online',  handleOnline)
      window.addEventListener('offline', handleOffline)
      setOnline(navigator.onLine)

      return () => {
        window.removeEventListener('online',  handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [setOnline])
}
