import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { SiteOut, SiteMemberOut } from '@/lib/types'

// ── Query keys ───────────────────────────────────────────────────────────────
export const siteKeys = {
  all: ['sites'] as const,
  detail: (id: string) => ['sites', id] as const,
  members: (id: string) => ['sites', id, 'members'] as const,
}

// ── Hooks ────────────────────────────────────────────────────────────────────
export function useSites() {
  return useQuery({
    queryKey: siteKeys.all,
    queryFn: async () => {
      const { data } = await apiClient.get<SiteOut[]>('/api/v1/sites/')
      return data
    },
  })
}

export function useSite(siteId: string | null) {
  return useQuery({
    queryKey: siteKeys.detail(siteId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<SiteOut>(`/api/v1/sites/${siteId}`)
      return data
    },
    enabled: !!siteId,
  })
}

export function useCreateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; address?: string }) => {
      const { data } = await apiClient.post<SiteOut>('/api/v1/sites/', payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKeys.all }),
  })
}

export function useUpdateSite(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<{ name: string; description: string; address: string }>) => {
      const { data } = await apiClient.patch<SiteOut>(`/api/v1/sites/${siteId}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: siteKeys.all })
      qc.invalidateQueries({ queryKey: siteKeys.detail(siteId) })
    },
  })
}

export function useDeleteSite(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/api/v1/sites/${siteId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: siteKeys.all })
      qc.invalidateQueries({ queryKey: siteKeys.detail(siteId) })
      qc.invalidateQueries({ queryKey: siteKeys.members(siteId) })
    },
  })
}

export function useSiteMembers(siteId: string | null) {
  return useQuery({
    queryKey: siteKeys.members(siteId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<SiteMemberOut[]>(`/api/v1/sites/${siteId}/members`)
      return data
    },
    enabled: !!siteId,
  })
}

export function useInviteMember(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { email: string; role: string }) => {
      const { data } = await apiClient.post(`/api/v1/sites/${siteId}/invites`, payload)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: siteKeys.members(siteId) }),
  })
}
