/**
 * Sync Engine — orchestrates push and pull phases.
 *
 * Push phase: drain outbox (pending local operations → server)
 * Pull phase: delta sync of items and locations from server since lastSyncTimestamp
 *
 * Triggered by:
 *  - Coming online (navigator 'online' event / Capacitor Network plugin)
 *  - App foregrounding
 *  - Every 5 minutes while online
 */
import { db } from '../db'
import { apiClient } from '@/api/client'
import { useOfflineStore } from '@/store/offlineStore'
import { drainOutbox } from './outboxProcessor'
import { applyDelta } from './conflictResolver'

const SYNC_META_KEY = 'lastSync'

interface SyncMeta {
  key: string
  siteId: string
  lastSyncTimestamp: string
}

async function getLastSync(siteId: string): Promise<string | null> {
  const meta = await (db as any).syncMeta?.get(`${SYNC_META_KEY}:${siteId}`)
  return meta?.lastSyncTimestamp ?? null
}

async function setLastSync(siteId: string, timestamp: string): Promise<void> {
  await (db as any).syncMeta?.put({
    key: `${SYNC_META_KEY}:${siteId}`,
    siteId,
    lastSyncTimestamp: timestamp,
  })
}

async function pullItems(siteId: string): Promise<void> {
  const lastSync = await getLastSync(siteId)
  const params: Record<string, string> = { per_page: '200' }
  if (lastSync) params.updated_since = lastSync

  try {
    const res = await apiClient.get(`/api/v1/sites/${siteId}/items/`, { params })
    const { items } = res.data as { items: Record<string, unknown>[] }
    await applyDelta(siteId, items)
    await setLastSync(siteId, new Date().toISOString())
  } catch (error) {
    console.warn('[SyncEngine] pullItems failed:', error)
  }
}

async function pullLocations(siteId: string): Promise<void> {
  try {
    const res = await apiClient.get(`/api/v1/sites/${siteId}/locations/flat`)
    const locations = res.data as Record<string, unknown>[]
    for (const loc of locations) {
      await db.locations.put({
        id: loc.id as string,
        siteId,
        data: loc,
        syncedAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.warn('[SyncEngine] pullLocations failed:', error)
  }
}

let syncInProgress = false

export async function runSync(siteIds: string[]): Promise<void> {
  if (syncInProgress) return
  syncInProgress = true

  try {
    // Phase 1: Push outbox
    await drainOutbox()

    // Phase 2: Pull delta for each site
    for (const siteId of siteIds) {
      await Promise.all([pullItems(siteId), pullLocations(siteId)])
    }

    useOfflineStore.getState().setLastSyncAt(new Date().toISOString())
  } finally {
    syncInProgress = false
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null

export function startPeriodicSync(getSiteIds: () => string[], intervalMs = 5 * 60 * 1000): void {
  stopPeriodicSync()
  syncInterval = setInterval(() => {
    if (navigator.onLine) {
      runSync(getSiteIds()).catch(console.warn)
    }
  }, intervalMs)
}

export function stopPeriodicSync(): void {
  if (syncInterval !== null) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

// Wire up browser online/offline events
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().setOnline(true)
    // Trigger sync — caller must provide site IDs
    // The hook useOnlineStatus handles this
  })
  window.addEventListener('offline', () => {
    useOfflineStore.getState().setOnline(false)
  })
}
