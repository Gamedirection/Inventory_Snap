import { useState, useCallback } from 'react'
import { X, Pencil } from 'lucide-react'
import { SwipeCard } from '@/components/ui/SwipeCard'
import { ReviewCard } from './ReviewCard'
import type { ReviewQueueItem, ProposalOut } from '@/lib/types'
import { useApproveProposal, useRejectProposal } from '@/api/hooks/useReview'
import { useReprocessPhoto } from '@/api/hooks/usePhotos'
import { Button } from '@/components/ui/Button'
import { CategoryCombobox } from '@/components/inventory/CategoryCombobox'
import { useCameraStore } from '@/store/cameraStore'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface FlatCard {
  proposal: ProposalOut
  photoId: string
  photoUrl: string
  locationName: string | null
  photoIndex: number   // 1-based within its photo
  photoTotal: number   // total proposals in its photo
}

function flattenQueue(items: ReviewQueueItem[]): FlatCard[] {
  return items.flatMap((item) =>
    item.proposals.map((proposal, i) => ({
      proposal,
      photoId: item.photo.id,
      photoUrl: item.photo.url || item.photo.thumbnail_url || '',
      locationName: item.photo.location?.name ?? null,
      photoIndex: i + 1,
      photoTotal: item.proposals.length,
    }))
  )
}

// ── Quick-edit sheet for a proposal ──────────────────────────────────────────

const CONDITIONS = [
  'new', 'excellent', 'good', 'fair', 'poor',
  'broken', 'in_repair', 'lost', 'misplaced',
  'shared', 'stolen', 'archived', 'unknown',
]

const CONDITION_LABELS: Record<string, string> = {
  new: 'New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
  broken: 'Broken', in_repair: 'In Repair', lost: 'Lost', misplaced: 'Misplaced',
  shared: 'Shared / Lended', stolen: 'Stolen', archived: 'Archived', unknown: 'Unknown',
}

interface EditSheetProps {
  proposal: ProposalOut
  siteId: string
  onClose: () => void
  onApprove: (overrides: Record<string, unknown>) => Promise<void>
}

function ProposalEditSheet({ proposal, siteId, onClose, onApprove }: EditSheetProps) {
  const pf = proposal.proposed_fields ?? {}
  const [name, setName]         = useState(pf.name ?? proposal.ai_label ?? '')
  const [category, setCategory] = useState(pf.category ?? proposal.ai_category ?? '')
  const [brand, setBrand]       = useState(pf.brand ?? proposal.brand ?? '')
  const [model, setModel]       = useState(pf.model ?? proposal.model ?? '')
  const [condition, setCond]    = useState('good')
  const [notes, setNotes]       = useState('')
  const [saving, setSaving]     = useState(false)

  const handleApprove = async () => {
    setSaving(true)
    try {
      await onApprove({
        name:      name.trim() || undefined,
        category:  category.trim() || undefined,
        brand:     brand.trim() || undefined,
        model:     model.trim() || undefined,
        condition,
        notes:     notes.trim() || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-kraft-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-kraft-50 rounded-t-3xl shadow-2xl max-h-[80vh] overflow-y-auto pb-[max(env(safe-area-inset-bottom,0px),72px)]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-kraft-300" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-kraft-200">
          <h2 className="text-sm font-semibold text-kraft-700 flex items-center gap-1.5">
            <Pencil className="w-3.5 h-3.5 text-kraft-400" />
            Edit before approving
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-kraft-200 text-kraft-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-3">
          <div>
            <label className="text-xs text-kraft-500 font-medium">Name</label>
            <input className="input mt-1 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-kraft-500 font-medium">Category</label>
              <div className="mt-1">
                <CategoryCombobox siteId={siteId} value={category} onChange={setCategory} />
              </div>
            </div>
            <div>
              <label className="text-xs text-kraft-500 font-medium">Condition</label>
              <select className="input mt-1 text-sm" value={condition} onChange={(e) => setCond(e.target.value)}>
                {CONDITIONS.map((c) => (
                  <option key={c} value={c}>{CONDITION_LABELS[c] ?? c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-kraft-500 font-medium">Brand</label>
              <input className="input mt-1 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-kraft-500 font-medium">Model</label>
              <input className="input mt-1 text-sm" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-kraft-500 font-medium">Notes</label>
            <textarea className="input mt-1 text-sm resize-none" rows={2}
              value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button
              className="flex-1 bg-[#4a7c59] hover:bg-[#3d6849] text-white border-0"
              onClick={handleApprove}
              loading={saving}
            >
              Approve
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SwipeDeck ─────────────────────────────────────────────────────────────────

interface SwipeDeckProps {
  items: ReviewQueueItem[]
  siteId: string
}

export function SwipeDeck({ items, siteId }: SwipeDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [editOpen, setEditOpen]         = useState(false)

  const approve   = useApproveProposal(siteId)
  const reject    = useRejectProposal(siteId)
  const reprocess = useReprocessPhoto(siteId)
  const { addRescan } = useCameraStore()

  const flatCards = flattenQueue(items)
  const current   = flatCards[currentIndex]
  const next      = flatCards[currentIndex + 1]

  const advance = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, flatCards.length))
  }, [flatCards.length])

  // Swipe RIGHT → approve only, no rescan
  const handleApprove = useCallback(async (overrides?: Record<string, unknown>) => {
    if (!current) return
    try {
      await approve.mutateAsync({ proposalId: current.proposal.id, overrides })
      toast.success(`"${current.proposal.ai_label ?? 'Item'}" added to inventory`)
      advance()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to approve')
      toast.error(msg)
    }
  }, [current, approve, advance])

  // Swipe UP → approve + rescan, excluding the just-approved item label
  const handleApproveAndRescan = useCallback(async () => {
    if (!current) return
    const label = current.proposal.ai_label ?? ''
    try {
      await approve.mutateAsync({ proposalId: current.proposal.id })
      toast.success(`"${label || 'Item'}" added — rescanning for more`)
      addRescan({ photoId: current.photoId, siteId, label: label || 'Photo', aiStatus: 'pending' })
      reprocess.mutateAsync({
        photoId: current.photoId,
        excludeLabels: label ? [label] : [],
      }).catch(() => {/* silent */})
      advance()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to approve')
      toast.error(msg)
    }
  }, [current, siteId, approve, reprocess, addRescan, advance])

  // Swipe DOWN → skip + rescan, excluding ALL pending labels from this photo (avoid duplicates)
  const handleSkip = useCallback(async () => {
    if (!current) return
    const label = current.proposal.ai_label ?? ''
    // Collect labels of all pending proposals for this photo to exclude from rescan
    const photoLabels = flatCards
      .filter((c) => c.photoId === current.photoId)
      .map((c) => c.proposal.ai_label ?? '')
      .filter(Boolean)
    try {
      await reject.mutateAsync({ proposalId: current.proposal.id })
      toast('Skipped — rescanning for new items', { icon: '🔄' })
      addRescan({ photoId: current.photoId, siteId, label: label || 'Photo', aiStatus: 'pending' })
      reprocess.mutateAsync({
        photoId: current.photoId,
        excludeLabels: photoLabels,
      }).catch(() => {/* silent */})
      advance()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to skip')
      toast.error(msg)
    }
  }, [current, siteId, flatCards, reject, reprocess, addRescan, advance])

  // Swipe LEFT → hard reject, no rescan
  const handleDelete = useCallback(async () => {
    if (!current) return
    try {
      await reject.mutateAsync({ proposalId: current.proposal.id })
      toast('Rejected', { icon: '🗑' })
      advance()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (err instanceof Error ? err.message : 'Failed to delete')
      toast.error(msg)
    }
  }, [current, reject, advance])

  if (!current) return null

  return (
    <div className="relative w-full">
      {/* Ghost of next card peeking below */}
      {next && (
        <div
          className="absolute inset-x-4 top-2 z-0 opacity-50 scale-[0.97] origin-bottom pointer-events-none"
          aria-hidden
        >
          <div className="card p-0 overflow-hidden">
            <div className="aspect-[4/3] bg-kraft-200" />
            <div className="px-4 py-3 h-[72px] bg-kraft-100" />
          </div>
        </div>
      )}

      {/* Current card */}
      <div className="relative z-10">
        <SwipeCard
          onSwipeUp={handleApproveAndRescan}
          onSwipeRight={handleApprove}
          onSwipeDown={handleSkip}
          onSwipeLeft={handleDelete}
          threshold={90}
        >
          <ReviewCard
            proposal={current.proposal}
            photoUrl={current.photoUrl}
            locationName={current.locationName}
            photoIndex={current.photoIndex}
            photoTotal={current.photoTotal}
            onEdit={() => setEditOpen(true)}
          />
        </SwipeCard>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {flatCards.slice(0, Math.min(flatCards.length, 9)).map((_, i) => (
          <div
            key={i}
            className={cn('h-1.5 rounded-full transition-all duration-200', {
              'w-4 bg-kraft-600': i === currentIndex,
              'w-1.5 bg-kraft-300': i < currentIndex,
              'w-1.5 bg-kraft-200': i > currentIndex,
            })}
          />
        ))}
        {flatCards.length > 9 && (
          <span className="text-xs text-kraft-400 self-center">+{flatCards.length - 9}</span>
        )}
      </div>

      <p className="text-center text-xs text-kraft-400 mt-2">
        {Math.max(flatCards.length - currentIndex, 0)} item{flatCards.length - currentIndex !== 1 ? 's' : ''} remaining
      </p>

      {/* Tap-to-edit sheet */}
      {editOpen && (
        <ProposalEditSheet
          proposal={current.proposal}
          siteId={siteId}
          onClose={() => setEditOpen(false)}
          onApprove={(overrides) => handleApprove(overrides)}
        />
      )}
    </div>
  )
}
