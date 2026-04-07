import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { LocationOut } from '@/lib/types'

export const locationKeys = {
  all: (siteId: string) => ['locations', siteId] as const,
  tree: (siteId: string) => ['locations', siteId, 'tree'] as const,
}

function buildTree(flat: LocationOut[]): LocationOut[] {
  const map = new Map<string, LocationOut>()
  const roots: LocationOut[] = []

  flat.forEach((loc) => map.set(loc.id, { ...loc, children: [] }))

  flat.forEach((loc) => {
    const node = map.get(loc.id)!
    if (loc.parent_id && map.has(loc.parent_id)) {
      map.get(loc.parent_id)!.children!.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}

export function useLocationTree(siteId: string | null) {
  return useQuery({
    queryKey: locationKeys.tree(siteId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<LocationOut[]>(
        `/api/v1/sites/${siteId}/locations`
      )
      return buildTree(data)
    },
    enabled: !!siteId,
  })
}

export function useLocationFlat(siteId: string | null) {
  return useQuery({
    queryKey: locationKeys.all(siteId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<LocationOut[]>(
        `/api/v1/sites/${siteId}/locations`
      )
      return data
    },
    enabled: !!siteId,
  })
}

export function useCreateLocation(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      parent_id?: string | null
      description?: string
      floor_level?: number
    }) => {
      const { data } = await apiClient.post<LocationOut>(
        `/api/v1/sites/${siteId}/locations`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: locationKeys.tree(siteId) })
    },
  })
}

export function useUpdateLocation(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      locationId,
      ...payload
    }: {
      locationId: string
      name?: string
      description?: string
      floor_level?: number
    }) => {
      const { data } = await apiClient.patch<LocationOut>(
        `/api/v1/sites/${siteId}/locations/${locationId}`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: locationKeys.tree(siteId) })
    },
  })
}
