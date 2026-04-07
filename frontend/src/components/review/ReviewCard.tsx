import { useState, useRef } from 'react'
import { Check, X, GitMerge, Edit3, AlertTriangle } from 'lucide-react'
import type { ReviewQueueItem, ProposalOut } from '@/lib/types'
import { BoundingBoxOverlay } from './BoundingBoxOverlay'
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useApproveProposal, useRejectProposal } from '@/api/hooks/useReview'
import { MINIO_PUBLIC_URL } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface ReviewCardProps {
  item: ReviewQueueItem
  siteId: string
  onDone?: () => void
}

function ProposalRow({
  proposal,
  siteId,
  onDone,
}: {
  proposal: ProposalOut
  siteId: string
  onDone?: () => void
}) {
  const approve = useApproveProposal(siteId)
  const reject  = useRejectProposal(siteId)

  const handleApprove = async () => {
    await approve.mutateAsync({ proposalId: proposal.id })
    onDone?.()
  }

  const handleReject = async () => {
    await reject.mutateAsync({ proposalId: proposal.id })
    onDone?.()
  }

  return (
    <div className="py-3 border-b border-kraft-200 last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-kraft-700">
              {proposal.proposed_fields?.name ?? proposal.ai_label}
            </span>
            {proposal.ai_category && (
              <span className="tag">{proposal.ai_category}</span>
            )}
            <ConfidenceBadge score={proposal.ai_confidence} />
          </div>

          {proposal.duplicate_of_id && (
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
              <AlertTriangle className="w-3 h-3" />
              <span>Possible duplicate</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={handleApprove}
            disabled={approve.isPending}
            className="w-8 h-8 rounded-lg bg-accent-sage/10 text-accent-sage
                       hover:bg-accent-sage/20 transition-colors flex items-center justify-center
                       disabled:opacity-50"
            aria-label="Approve"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={handleReject}
            disabled={reject.isPending}
            className="w-8 h-8 rounded-lg bg-accent-rust/10 text-accent-rust
                       hover:bg-accent-rust/20 transition-colors flex items-center justify-center
                       disabled:opacity-50"
            aria-label="Reject"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReviewCard({ item, siteId, onDone }: ReviewCardProps) {
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 })
  const imgRef = useRef<HTMLImageElement>(null)

  const allObjects = item.proposals.flatMap((p) => p.detected_objects ?? [])

  const handleImgLoad = () => {
    if (imgRef.current) {
      setImgSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight })
    }
  }

  const photoUrl = item.photo.url.startsWith('http')
    ? item.photo.url
    : `${MINIO_PUBLIC_URL}${item.photo.url}`

  return (
    <div className="card p-0 overflow-hidden">
      {/* Photo with bounding boxes */}
      <div className="relative bg-kraft-800 aspect-[4/3]">
        <img
          ref={imgRef}
          src={photoUrl}
          alt="Review photo"
          onLoad={handleImgLoad}
          className="w-full h-full object-contain"
        />
        {allObjects.length > 0 && (
          <BoundingBoxOverlay
            objects={allObjects}
            imageWidth={imgSize.w}
            imageHeight={imgSize.h}
          />
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <Badge variant="rust" dot>{item.pending_count} pending</Badge>
        </div>

        {/* Location tag */}
        {item.photo.location && (
          <div className="absolute bottom-2 left-2">
            <span className="tag bg-kraft-900/70 text-kraft-100 border-kraft-700">
              {item.photo.location.name}
            </span>
          </div>
        )}
      </div>

      {/* Proposals */}
      <div className="px-4">
        <p className="section-title mt-3">Detected Items ({item.proposals.length})</p>
        {item.proposals.map((proposal) => (
          <ProposalRow
            key={proposal.id}
            proposal={proposal}
            siteId={siteId}
            onDone={onDone}
          />
        ))}
      </div>

      {/* Swipe hint */}
      <div className="flex items-center justify-between px-4 py-3 text-xs text-kraft-400">
        <span className="flex items-center gap-1">
          <X className="w-3 h-3 text-accent-rust" />
          Swipe left to reject all
        </span>
        <span className="flex items-center gap-1">
          Swipe right to approve all
          <Check className="w-3 h-3 text-accent-sage" />
        </span>
      </div>
    </div>
  )
}
