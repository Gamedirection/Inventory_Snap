import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { PhotoOut, PhotoUploadResponse } from '@/lib/types'

export const photoKeys = {
  all: (siteId: string) => ['photos', siteId] as const,
  list: (siteId: string, filters: Record<string, string>) =>
    ['photos', siteId, 'list', filters] as const,
  detail: (siteId: string, photoId: string) =>
    ['photos', siteId, photoId] as const,
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
    }: {
      blob: Blob
      locationId?: string | null
      capturedAt?: string
    }) => {
      const form = new FormData()
      form.append('file', blob, 'photo.jpg')
      if (locationId) form.append('location_id', locationId)
      if (capturedAt) form.append('captured_at', capturedAt)

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
      items: Array<{ blob: Blob; locationId?: string | null; capturedAt?: string }>
    ) => {
      const results = await Promise.allSettled(
        items.map(async ({ blob, locationId, capturedAt }) => {
          const form = new FormData()
          form.append('file', blob, 'photo.jpg')
          if (locationId) form.append('location_id', locationId)
          if (capturedAt) form.append('captured_at', capturedAt)
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
