import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { ItemOut, ItemMovement, PaginatedResponse, ItemFilters } from '@/lib/types'

export const itemKeys = {
  all: (siteId: string) => ['items', siteId] as const,
  list: (siteId: string, filters: ItemFilters) => ['items', siteId, 'list', filters] as const,
  detail: (siteId: string, itemId: string) => ['items', siteId, itemId] as const,
  movements: (siteId: string, itemId: string) => ['items', siteId, itemId, 'movements'] as const,
}

export function useItems(siteId: string | null, filters: ItemFilters = {}) {
  return useQuery({
    queryKey: itemKeys.list(siteId ?? '', filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => {
        if (v !== undefined && v !== '') params.set(k, String(v))
      })
      const { data } = await apiClient.get<PaginatedResponse<ItemOut>>(
        `/api/v1/sites/${siteId}/items?${params}`
      )
      return data
    },
    enabled: !!siteId,
    placeholderData: keepPreviousData,
  })
}

export function useItem(siteId: string | null, itemId: string | null) {
  return useQuery({
    queryKey: itemKeys.detail(siteId ?? '', itemId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ItemOut>(
        `/api/v1/sites/${siteId}/items/${itemId}`
      )
      return data
    },
    enabled: !!siteId && !!itemId,
  })
}

export function useCreateItem(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ItemOut>) => {
      const { data } = await apiClient.post<ItemOut>(
        `/api/v1/sites/${siteId}/items`,
        payload
      )
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: itemKeys.all(siteId) }),
  })
}

export function useUpdateItem(siteId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<ItemOut>) => {
      const { data } = await apiClient.patch<ItemOut>(
        `/api/v1/sites/${siteId}/items/${itemId}`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: itemKeys.detail(siteId, itemId) })
    },
  })
}

export function usePatchItem(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      itemId,
      payload,
    }: {
      itemId: string
      payload: Partial<ItemOut>
    }) => {
      const { data } = await apiClient.patch<ItemOut>(
        `/api/v1/sites/${siteId}/items/${itemId}`,
        payload
      )
      return data
    },
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: itemKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: itemKeys.detail(siteId, item.id) })
    },
  })
}

export function useMoveItem(siteId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { to_location_id: string | null; notes?: string }) => {
      const { data } = await apiClient.post<ItemMovement>(
        `/api/v1/sites/${siteId}/items/${itemId}/move`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.detail(siteId, itemId) })
      qc.invalidateQueries({ queryKey: itemKeys.movements(siteId, itemId) })
    },
  })
}

export function useDeleteItem(siteId: string, itemId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/api/v1/sites/${siteId}/items/${itemId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: itemKeys.detail(siteId, itemId) })
      qc.invalidateQueries({ queryKey: itemKeys.movements(siteId, itemId) })
    },
  })
}

export function useItemMovements(siteId: string | null, itemId: string | null) {
  return useQuery({
    queryKey: itemKeys.movements(siteId ?? '', itemId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ItemMovement[]>(
        `/api/v1/sites/${siteId}/items/${itemId}/movements`
      )
      return data
    },
    enabled: !!siteId && !!itemId,
  })
}

export interface LinkedPhoto {
  photo_id: string
  url: string
  thumbnail_url: string
  is_primary: boolean
  annotation_bbox: { x: number; y: number; width: number; height: number } | null
}

export function useItemPhotos(siteId: string | null, itemId: string | null) {
  return useQuery({
    queryKey: ['items', siteId ?? '', itemId ?? '', 'photos'],
    queryFn: async () => {
      const { data } = await apiClient.get<LinkedPhoto[]>(
        `/api/v1/sites/${siteId}/items/${itemId}/photos`
      )
      return data
    },
    enabled: !!siteId && !!itemId,
  })
}
