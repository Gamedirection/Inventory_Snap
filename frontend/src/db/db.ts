import Dexie, { type Table } from 'dexie'
import type { DBPhoto, DBItem, DBLocation, DBOutboxOperation } from './schema'

interface DBSyncMeta {
  key: string
  siteId: string
  lastSyncTimestamp: string
}

class InventorySnapDB extends Dexie {
  photos!: Table<DBPhoto>
  items!: Table<DBItem>
  locations!: Table<DBLocation>
  outbox!: Table<DBOutboxOperation>
  syncMeta!: Table<DBSyncMeta>

  constructor() {
    super('InventorySnapDB')
    this.version(1).stores({
      photos:    '&id, siteId, locationId, uploadStatus',
      items:     '&id, siteId, locationId, isDirty',
      locations: '&id, siteId',
      outbox:    '&id, status, createdAt',
      syncMeta:  '&key, siteId',
    })
  }
}

export const db = new InventorySnapDB()
