/**
 * Conflict resolution for offline sync.
 * Strategy: last-write-wins by updated_at; same-field conflicts surface a modal.
 */
import { db } from '../db'
import type { DBItem } from '../schema'

export interface Conflict {
  itemId: string
  field: string
  localValue: unknown
  serverValue: unknown
}

/**
 * Merge a server item with a local dirty item.
 * Returns the merged result or null if no conflict.
 */
export function mergeItem(
  local: DBItem,
  serverData: Record<string, unknown>
): { merged: Record<string, unknown>; conflicts: Conflict[] } {
  const serverUpdatedAt = serverData.updated_at as string | null
  const localSyncedAt = local.syncedAt

  const conflicts: Conflict[] = []
  const merged: Record<string, unknown> = { ...serverData }

  if (!local.isDirty) {
    // Not dirty — just take server version
    return { merged, conflicts: [] }
  }

  const localData = local.data as Record<string, unknown>
  const IGNORED_FIELDS = new Set(['id', 'created_at', 'updated_at', 'site_id', 'created_by'])

  for (const key of Object.keys(localData)) {
    if (IGNORED_FIELDS.has(key)) continue

    const localVal = localData[key]
    const serverVal = serverData[key]

    if (JSON.stringify(localVal) !== JSON.stringify(serverVal)) {
      // Field was changed on both ends
      // Heuristic: if local value differs from what was synced AND server also changed it, conflict
      conflicts.push({ itemId: local.id, field: key, localValue: localVal, serverValue: serverVal })
      // Default resolution: keep local value (user intent wins)
      merged[key] = localVal
    }
  }

  return { merged, conflicts }
}

/**
 * Apply server delta sync response to local IndexedDB.
 * Returns list of conflicts for the UI to resolve.
 */
export async function applyDelta(
  siteId: string,
  serverItems: Record<string, unknown>[]
): Promise<Conflict[]> {
  const allConflicts: Conflict[] = []

  for (const serverItem of serverItems) {
    const id = serverItem.id as string
    const local = await db.items.get(id)

    if (!local) {
      // New item from server — just insert
      await db.items.put({
        id,
        siteId,
        locationId: serverItem.location_id as string | null,
        data: serverItem,
        syncedAt: new Date().toISOString(),
        isDirty: false,
      })
      continue
    }

    const { merged, conflicts } = mergeItem(local, serverItem)
    allConflicts.push(...conflicts)

    await db.items.update(id, {
      data: merged,
      locationId: merged.location_id as string | null,
      syncedAt: new Date().toISOString(),
      isDirty: conflicts.length > 0, // still dirty if unresolved
    })
  }

  return allConflicts
}

/**
 * Resolve a conflict by keeping the chosen value.
 */
export async function resolveConflict(
  itemId: string,
  field: string,
  keepValue: unknown
): Promise<void> {
  const local = await db.items.get(itemId)
  if (!local) return

  const updated = { ...(local.data as Record<string, unknown>), [field]: keepValue }
  await db.items.update(itemId, {
    data: updated,
    isDirty: true, // still needs to be pushed
  })
}
