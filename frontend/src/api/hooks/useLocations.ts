import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { FloorMapOut, LocationOut } from '@/lib/types'

export const locationKeys = {
  all: (siteId: string) => ['locations', siteId] as const,
  tree: (siteId: string) => ['locations', siteId, 'tree'] as const,
  flat: (siteId: string) => ['locations', siteId, 'flat'] as const,
  floorMap: (siteId: string, locationId: string) => ['locations', siteId, locationId, 'floorMap'] as const,
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
      return data
    },
    enabled: !!siteId,
  })
}

export function useLocationFlat(siteId: string | null) {
  return useQuery({
    queryKey: locationKeys.flat(siteId ?? ''),
    queryFn: async () => {
      // Call the flat endpoint; fallback to tree endpoint
      try {
        const { data } = await apiClient.get<LocationOut[]>(
          `/api/v1/sites/${siteId}/locations/flat`
        )
        return data
      } catch {
        const { data } = await apiClient.get<LocationOut[]>(
          `/api/v1/sites/${siteId}/locations`
        )
        // Flatten the tree
        const flatten = (locs: LocationOut[]): LocationOut[] =>
          locs.flatMap((l) => [l, ...flatten(l.children ?? [])])
        return flatten(data)
      }
    },
    enabled: !!siteId,
  })
}

export function useCreateLocation(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      name: string
      level?: string
      parent_id?: string | null
      description?: string
      floor_plan_x?: number
      floor_plan_y?: number
      order_index?: number
    }) => {
      const { data } = await apiClient.post<LocationOut>(
        `/api/v1/sites/${siteId}/locations`,
        { level: 'room', ...payload }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: locationKeys.tree(siteId) })
      qc.invalidateQueries({ queryKey: locationKeys.flat(siteId) })
    },
  })
}

export function useUpdateLocation(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      locationId,
      data: payload,
      ...rest
    }: {
      locationId: string
      data?: {
        name?: string
        level?: string
        description?: string
        floor_plan_x?: number
        floor_plan_y?: number
        order_index?: number
      }
      name?: string
      description?: string
    }) => {
      const body = payload ?? rest
      const { data } = await apiClient.patch<LocationOut>(
        `/api/v1/sites/${siteId}/locations/${locationId}`,
        body
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: locationKeys.tree(siteId) })
      qc.invalidateQueries({ queryKey: locationKeys.flat(siteId) })
    },
  })
}

export function useDeleteLocation(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (locationId: string) => {
      await apiClient.delete(`/api/v1/sites/${siteId}/locations/${locationId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.all(siteId) })
      qc.invalidateQueries({ queryKey: locationKeys.tree(siteId) })
      qc.invalidateQueries({ queryKey: locationKeys.flat(siteId) })
    },
  })
}

export function useFloorMap(siteId: string | null, locationId: string | null) {
  return useQuery({
    queryKey: locationKeys.floorMap(siteId ?? '', locationId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<FloorMapOut>(
        `/api/v1/sites/${siteId}/locations/${locationId}/map`
      )
      return data
    },
    enabled: !!siteId && !!locationId,
    retry: false,
  })
}

export function useUploadFloorMapImage(siteId: string, locationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await apiClient.put<FloorMapOut>(
        `/api/v1/sites/${siteId}/locations/${locationId}/map/image`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.floorMap(siteId, locationId) })
    },
  })
}

export function useUpdateFloorMap(siteId: string, locationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      vector_data?: FloorMapOut['vector_data']
      width?: number
      height?: number
    }) => {
      const { data } = await apiClient.put<FloorMapOut>(
        `/api/v1/sites/${siteId}/locations/${locationId}/map/vector`,
        payload
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: locationKeys.floorMap(siteId, locationId) })
    },
  })
}
