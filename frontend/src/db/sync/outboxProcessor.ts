/**
 * Outbox processor — drains the outbox table by sending pending operations to the API.
 * Runs on reconnect and on a periodic timer while online.
 */
import { db } from '../db'
import { apiClient } from '@/api/client'
import { useOfflineStore } from '@/store/offlineStore'
import type { DBOutboxOperation } from '../schema'

const MAX_RETRIES = 5
const BASE_BACKOFF_MS = 2000

async function processOperation(op: DBOutboxOperation): Promise<void> {
  const { operation, resourceType, resourceId, payload } = op

  switch (resourceType) {
    case 'photo': {
      if (operation === 'CREATE') {
        // Photo blob lives in IndexedDB — upload as multipart FormData
        const photoRecord = await db.photos.get(resourceId)
        if (!photoRecord?.blob) {
          await db.photos.update(resourceId, { uploadStatus: 'failed' })
          return
        }
        await db.photos.update(resourceId, { uploadStatus: 'uploading' })
        const formData = new FormData()
        formData.append('file', photoRecord.blob, `photo_${resourceId}.jpg`)
        if (photoRecord.locationId) formData.append('location_id', photoRecord.locationId)
        const res = await apiClient.post(
          `/api/v1/sites/${photoRecord.siteId}/photos/upload`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        // Update local record with server ID
        await db.photos.update(resourceId, {
          uploadStatus: 'uploaded',
          serverId: res.data.photo_id,
          blob: photoRecord.blob, // keep for offline viewing
        })
      }
      break
    }

    case 'item': {
      const siteId = (payload as any).site_id
      if (operation === 'CREATE') {
        const res = await apiClient.post(`/api/v1/sites/${siteId}/items/`, payload)
        // Update local item with server-confirmed data
        await db.items.update(resourceId, {
          data: res.data,
          isDirty: false,
          syncedAt: new Date().toISOString(),
        })
      } else if (operation === 'UPDATE') {
        const res = await apiClient.patch(`/api/v1/sites/${siteId}/items/${resourceId}`, payload)
        await db.items.update(resourceId, {
          data: res.data,
          isDirty: false,
          syncedAt: new Date().toISOString(),
        })
      } else if (operation === 'DELETE') {
        await apiClient.delete(`/api/v1/sites/${siteId}/items/${resourceId}`)
        await db.items.delete(resourceId)
      }
      break
    }

    case 'movement': {
      const { site_id, item_id, ...body } = payload as any
      await apiClient.post(`/api/v1/sites/${site_id}/items/${item_id}/move`, body)
      break
    }

    default:
      throw new Error(`Unknown resource type: ${resourceType}`)
  }
}

export async function drainOutbox(): Promise<void> {
  const pendingOps = await db.outbox
    .where('status')
    .equals('pending')
    .sortBy('createdAt')

  if (pendingOps.length === 0) return

  let successCount = 0
  let failCount = 0

  for (const op of pendingOps) {
    // Skip if exceeded max retries
    if (op.retryCount >= MAX_RETRIES) {
      await db.outbox.update(op.id, { status: 'failed', lastError: 'Max retries exceeded' })
      failCount++
      continue
    }

    // Exponential backoff check
    if (op.retryCount > 0) {
      const createdAt = new Date(op.createdAt).getTime()
      const backoff = BASE_BACKOFF_MS * Math.pow(2, op.retryCount - 1)
      if (Date.now() - createdAt < backoff) continue
    }

    await db.outbox.update(op.id, { status: 'processing' })

    try {
      await processOperation(op)
      await db.outbox.delete(op.id)
      successCount++
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      await db.outbox.update(op.id, {
        status: 'pending',
        retryCount: op.retryCount + 1,
        lastError: errMsg,
        createdAt: new Date().toISOString(), // reset for backoff calculation
      })
      failCount++
    }
  }

  // Update pending count in store
  const remaining = await db.outbox.where('status').equals('pending').count()
  useOfflineStore.getState().setPendingCount(remaining)
}

export async function enqueueOperation(
  op: Omit<DBOutboxOperation, 'id' | 'createdAt' | 'status' | 'retryCount' | 'lastError'>
): Promise<void> {
  await db.outbox.add({
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    retryCount: 0,
    lastError: null,
    ...op,
  })
  const count = await db.outbox.where('status').equals('pending').count()
  useOfflineStore.getState().setPendingCount(count)
}
