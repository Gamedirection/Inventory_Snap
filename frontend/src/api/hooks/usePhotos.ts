import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { PhotoOut, PhotoDetail, PhotoUploadResponse } from '@/lib/types'

export const photoKeys = {
  all: (siteId: string) => ['photos', siteId] as const,
  list: (siteId: string, filters: Record<string, string>) =>
    ['photos', siteId, 'list', filters] as const,
  detail: (siteId: string, photoId: string) =>
    ['photos', siteId, photoId] as const,
  detailFull: (siteId: string, photoId: string) =>
    ['photos', siteId, photoId, 'detail'] as const,
}

export function usePhotos(siteId: string | null, filters: Record<string, string> = {}) {
  return useQuery({
    queryKey: photoKeys.list(siteId ?? '', filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters)
      const { data } = await apiClient.get<PhotoOut[]>(
        `/api/v1/sites/${siteId}/photos?${params}`
      )
      return data
    },
    enabled: !!siteId,
  })
}

/**
 * Poll a single photo's AI status.
 * Automatically stops polling once ai_status is 'completed' or 'failed'.
 */
export function usePhotoAiStatus(siteId: string | null, photoId: string | null) {
  return useQuery({
    queryKey: photoKeys.detail(siteId ?? '', photoId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<PhotoOut>(
        `/api/v1/sites/${siteId}/photos/${photoId}`
      )
      return data
    },
    enabled: !!siteId && !!photoId,
    refetchInterval: (query) => {
      const status = query.state.data?.ai_status
      if (status === 'completed' || status === 'failed') return false
      return 3_000
    },
    staleTime: 0,
  })
}

export function useUploadPhoto(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      blob,
      locationId,
      capturedAt,
      gpsLatitude,
      gpsLongitude,
    }: {
      blob: Blob
      locationId?: string | null
      capturedAt?: string
      gpsLatitude?: number | null
      gpsLongitude?: number | null
    }) => {
      const form = new FormData()
      form.append('file', blob, 'photo.jpg')
      if (locationId) form.append('location_id', locationId)
      if (capturedAt) form.append('captured_at', capturedAt)
      if (gpsLatitude != null) form.append('gps_latitude', String(gpsLatitude))
      if (gpsLongitude != null) form.append('gps_longitude', String(gpsLongitude))

      const { data } = await apiClient.post<PhotoUploadResponse>(
        `/api/v1/sites/${siteId}/photos`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: photoKeys.all(siteId) }),
  })
}

export function useBatchUploadPhotos(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      items: Array<{
        blob: Blob
        locationId?: string | null
        capturedAt?: string
        gpsLatitude?: number | null
        gpsLongitude?: number | null
      }>
    ) => {
      const results = await Promise.allSettled(
        items.map(async ({ blob, locationId, capturedAt, gpsLatitude, gpsLongitude }) => {
          const form = new FormData()
          form.append('file', blob, 'photo.jpg')
          if (locationId) form.append('location_id', locationId)
          if (capturedAt) form.append('captured_at', capturedAt)
          if (gpsLatitude != null) form.append('gps_latitude', String(gpsLatitude))
          if (gpsLongitude != null) form.append('gps_longitude', String(gpsLongitude))
          const { data } = await apiClient.post<PhotoUploadResponse>(
            `/api/v1/sites/${siteId}/photos`,
            form,
            { headers: { 'Content-Type': 'multipart/form-data' } }
          )
          return data
        })
      )
      return results
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: photoKeys.all(siteId) }),
  })
}

// ── Photo gallery (for inventory Photos tab) ────────────────────────────────

export function usePhotoGallery(
  siteId: string | null,
  filters: Record<string, string> = {}
) {
  return useQuery({
    queryKey: photoKeys.list(siteId ?? '', filters),
    queryFn: async () => {
      const params = new URLSearchParams(filters)
      const { data } = await apiClient.get<PhotoOut[]>(
        `/api/v1/sites/${siteId}/photos?${params}&per_page=100`
      )
      return data
    },
    enabled: !!siteId,
  })
}

export function usePhotoDetail(siteId: string | null, photoId: string | null) {
  return useQuery({
    queryKey: photoKeys.detailFull(siteId ?? '', photoId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<PhotoDetail>(
        `/api/v1/sites/${siteId}/photos/${photoId}/detail`
      )
      return data
    },
    enabled: !!siteId && !!photoId,
  })
}

export function useUpdatePhotoLocation(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      photoId,
      locationId,
      archived,
    }: {
      photoId: string
      locationId?: string | null
      archived?: boolean
    }) => {
      const payload: Record<string, unknown> = {}
      if (locationId !== undefined) payload.location_id = locationId
      if (archived !== undefined) payload.archived = archived
      const { data } = await apiClient.patch<PhotoOut>(
        `/api/v1/sites/${siteId}/photos/${photoId}`,
        payload
      )
      return data
    },
    onSuccess: (_data, { photoId }) => {
      qc.invalidateQueries({ queryKey: photoKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: photoKeys.detailFull(siteId, photoId) })
    },
  })
}

export function useDeletePhoto(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (photoId: string) => {
      await apiClient.delete(`/api/v1/sites/${siteId}/photos/${photoId}`)
    },
    onSuccess: (_data, photoId) => {
      qc.invalidateQueries({ queryKey: photoKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: photoKeys.detailFull(siteId, photoId) })
    },
  })
}

export function usePinItem(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      photoId,
      itemId,
      annotationBbox,
      setAsPrimary,
    }: {
      photoId: string
      itemId: string
      annotationBbox?: { x: number; y: number; width: number; height: number } | null
      setAsPrimary?: boolean
    }) => {
      const { data } = await apiClient.post<PhotoDetail>(
        `/api/v1/sites/${siteId}/photos/${photoId}/pins`,
        {
          item_id: itemId,
          annotation_bbox: annotationBbox ?? null,
          set_as_primary: setAsPrimary ?? false,
        }
      )
      return data
    },
    onSuccess: (_data, { photoId }) => {
      qc.invalidateQueries({ queryKey: photoKeys.detailFull(siteId, photoId) })
      qc.invalidateQueries({ queryKey: ['items', siteId] })
    },
  })
}

export function useReprocessPhoto(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (photoId: string) => {
      const { data } = await apiClient.post(
        `/api/v1/sites/${siteId}/photos/${photoId}/reprocess`
      )
      return data
    },
    onSuccess: (_data, photoId) => {
      qc.invalidateQueries({ queryKey: photoKeys.detail(siteId, photoId) })
    },
  })
}

export function useUnpinItem(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      photoId,
      pinId,
    }: {
      photoId: string
      pinId: string
    }) => {
      await apiClient.delete(
        `/api/v1/sites/${siteId}/photos/${photoId}/pins/${pinId}`
      )
    },
    onSuccess: (_data, { photoId }) => {
      qc.invalidateQueries({ queryKey: photoKeys.detailFull(siteId, photoId) })
      qc.invalidateQueries({ queryKey: ['items', siteId] })
    },
  })
}
