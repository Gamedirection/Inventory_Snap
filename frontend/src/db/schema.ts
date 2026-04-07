export interface DBPhoto {
  id: string                 // "tmp_<timestamp>" before upload, server UUID after
  siteId: string
  locationId: string | null
  blob: Blob
  thumbnailBlob: Blob | null
  capturedAt: string
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed'
  serverId: string | null
  retryCount: number
}

export interface DBItem {
  id: string
  siteId: string
  locationId: string | null
  data: unknown
  syncedAt: string
  isDirty: boolean
}

export interface DBLocation {
  id: string
  siteId: string
  data: unknown
  syncedAt: string
}

export interface DBOutboxOperation {
  id: string
  createdAt: string
  operation: 'CREATE' | 'UPDATE' | 'DELETE'
  resourceType: 'item' | 'movement' | 'photo'
  resourceId: string
  payload: unknown
  status: 'pending' | 'processing' | 'failed'
  retryCount: number
  lastError: string | null
}
