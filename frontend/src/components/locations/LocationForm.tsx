import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCreateLocation, useUpdateLocation } from '@/api/hooks/useLocations'
import type { Location } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  level: z.enum(['floor', 'room', 'zone', 'shelf', 'container']),
  description: z.string().optional(),
  parent_id: z.string().optional().nullable(),
})

type FormData = z.infer<typeof schema>

const LEVEL_OPTIONS = [
  { value: 'floor', label: '🏢 Floor' },
  { value: 'room', label: '🚪 Room' },
  { value: 'zone', label: '📐 Zone / Sub-room' },
  { value: 'shelf', label: '📦 Shelf / Rail' },
  { value: 'container', label: '🗃️ Container / Bin' },
]

interface LocationFormProps {
  siteId: string
  parentId?: string | null
  defaultLevel?: string
  existing?: Location
  onSuccess?: (location: Location) => void
  onCancel?: () => void
}

export function LocationForm({
  siteId,
  parentId,
  defaultLevel = 'room',
  existing,
  onSuccess,
  onCancel,
}: LocationFormProps) {
  const createMutation = useCreateLocation(siteId)
  const updateMutation = useUpdateLocation(siteId)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? '',
      level: (existing?.level as FormData['level']) ?? (defaultLevel as FormData['level']),
      description: existing?.description ?? '',
      parent_id: parentId ?? existing?.parent_id ?? null,
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = async (data: FormData) => {
    try {
      let result: Location
      if (existing) {
        result = await updateMutation.mutateAsync({ locationId: existing.id, data })
      } else {
        result = await createMutation.mutateAsync({ ...data, parent_id: parentId ?? null })
      }
      onSuccess?.(result)
    } catch {
      // errors shown via react-hot-toast in mutation hooks
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-kraft-600 mb-1">Name *</label>
        <input {...register('name')} className="input" placeholder="e.g. Storage Room A" />
        {errors.name && <p className="text-xs text-accent-rust mt-1">{errors.name.message}</p>}
      </div>

      {!existing && (
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Level *</label>
          <select {...register('level')} className="input">
            {LEVEL_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-kraft-600 mb-1">Description</label>
        <textarea
          {...register('description')}
          className="input resize-none"
          rows={2}
          placeholder="Optional description"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isPending} className="flex-1">
          {isPending ? <Spinner size="sm" /> : existing ? 'Save changes' : 'Create location'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
