import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/api/client'
import type { ReviewQueueResponse, ProposalOut } from '@/lib/types'

export const reviewKeys = {
  queue: (siteId: string) => ['review', siteId, 'queue'] as const,
  count: (siteId: string) => ['review', siteId, 'count'] as const,
  proposals: (siteId: string, photoId: string) =>
    ['review', siteId, 'proposals', photoId] as const,
}

export function useReviewQueue(siteId: string | null) {
  return useQuery({
    queryKey: reviewKeys.queue(siteId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ReviewQueueResponse>(
        `/api/v1/sites/${siteId}/review/queue`
      )
      return data
    },
    enabled: !!siteId,
  })
}

export function useReviewQueueCount(siteId: string | null) {
  return useQuery({
    queryKey: reviewKeys.count(siteId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<{ pending_count: number }>(
        `/api/v1/sites/${siteId}/review/queue/count`
      )
      return data
    },
    enabled: !!siteId,
    refetchInterval: 30_000,
  })
}

export function usePhotoProposals(siteId: string | null, photoId: string | null) {
  return useQuery({
    queryKey: reviewKeys.proposals(siteId ?? '', photoId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ProposalOut[]>(
        `/api/v1/sites/${siteId}/photos/${photoId}/proposals`
      )
      return data
    },
    enabled: !!siteId && !!photoId,
  })
}

export function useApproveProposal(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      proposalId,
      overrides,
    }: {
      proposalId: string
      overrides?: Record<string, unknown>
    }) => {
      const { data } = await apiClient.post(
        `/api/v1/sites/${siteId}/review/proposals/${proposalId}/approve`,
        overrides ?? {}
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.queue(siteId) })
      qc.invalidateQueries({ queryKey: reviewKeys.count(siteId) })
    },
  })
}

export function useRejectProposal(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      proposalId,
      reason,
    }: {
      proposalId: string
      reason?: string
    }) => {
      const { data } = await apiClient.post(
        `/api/v1/sites/${siteId}/review/proposals/${proposalId}/reject`,
        { reason }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.queue(siteId) })
      qc.invalidateQueries({ queryKey: reviewKeys.count(siteId) })
    },
  })
}

export function useMergeProposal(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      proposalId,
      targetItemId,
    }: {
      proposalId: string
      targetItemId: string
    }) => {
      const { data } = await apiClient.post(
        `/api/v1/sites/${siteId}/review/proposals/${proposalId}/merge`,
        { target_item_id: targetItemId }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.queue(siteId) })
    },
  })
}

export function useBulkReview(siteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (
      actions: Array<{ proposalId: string; action: 'approve' | 'reject' }>
    ) => {
      const { data } = await apiClient.post(
        `/api/v1/sites/${siteId}/review/bulk`,
        { actions }
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewKeys.queue(siteId) })
      qc.invalidateQueries({ queryKey: reviewKeys.count(siteId) })
    },
  })
}
