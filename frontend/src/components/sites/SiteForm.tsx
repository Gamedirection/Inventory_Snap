import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { MapPin } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCreateSite, useUpdateSite } from '@/api/hooks/useSites'
import type { Site } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  address: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  timezone: z.string().default('UTC'),
})

type FormData = z.infer<typeof schema>

interface SiteFormProps {
  existing?: Site
  onSuccess?: (site: Site) => void
  onCancel?: () => void
}

export function SiteForm({ existing, onSuccess, onCancel }: SiteFormProps) {
  const createMutation = useCreateSite()
  const updateMutation = useUpdateSite(existing?.id ?? '')

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? '',
      description: existing?.description ?? '',
      address: existing?.address ?? '',
      latitude: existing?.latitude ?? null,
      longitude: existing?.longitude ?? null,
      timezone: existing?.timezone ?? 'UTC',
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const handleGeolocate = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      setValue('latitude', pos.coords.latitude)
      setValue('longitude', pos.coords.longitude)
    })
  }

  const onSubmit = async (data: FormData) => {
    try {
      const result = existing
        ? await updateMutation.mutateAsync(data)
        : await createMutation.mutateAsync(data)
      onSuccess?.(result)
    } catch {
      // toast shown in hook
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-kraft-600 mb-1">Site name *</label>
        <input {...register('name')} className="input" placeholder="e.g. Warehouse A, Home, Office" />
        {errors.name && <p className="text-xs text-accent-rust mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-kraft-600 mb-1">Description</label>
        <textarea
          {...register('description')}
          className="input resize-none"
          rows={2}
          placeholder="Optional notes about this site"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-kraft-600 mb-1">Address</label>
        <input {...register('address')} className="input" placeholder="123 Main St, City, Country" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Latitude</label>
          <input
            {...register('latitude')}
            type="number"
            step="any"
            className="input"
            placeholder="0.000000"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Longitude</label>
          <input
            {...register('longitude')}
            type="number"
            step="any"
            className="input"
            placeholder="0.000000"
          />
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleGeolocate}
        className="w-full text-kraft-500"
      >
        <MapPin size={14} />
        Use current location
      </Button>

      <div>
        <label className="block text-sm font-medium text-kraft-600 mb-1">Timezone</label>
        <input {...register('timezone')} className="input" placeholder="UTC" />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isPending} className="flex-1">
          {isPending ? <Spinner size="sm" /> : existing ? 'Save changes' : 'Create site'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </form>
  )
}
