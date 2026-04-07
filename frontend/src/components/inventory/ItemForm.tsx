import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { LocationPicker } from '@/components/locations/LocationPicker'
import { useCreateItem, useUpdateItem } from '@/api/hooks/useItems'
import type { ItemOut } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  condition: z.enum(['new', 'excellent', 'good', 'fair', 'poor', 'unknown']).default('unknown'),
  item_type: z.enum(['unique', 'bulk', 'grouped_set']).default('unique'),
  location_id: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  serial_numbers: z.string().optional(), // comma-separated
  barcodes: z.string().optional(),
  purchase_price_cents: z.coerce.number().optional().nullable(),
  estimated_value_cents: z.coerce.number().optional().nullable(),
  currency_code: z.string().default('USD'),
  notes: z.string().optional(),
  custom_tags: z.string().optional(), // comma-separated
  warranty_notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const CONDITIONS = ['new', 'excellent', 'good', 'fair', 'poor', 'unknown'] as const
const CATEGORIES = ['Electronics', 'Furniture', 'Tools', 'Clothing', 'Books', 'Appliances', 'Other']

interface ItemFormProps {
  siteId: string
  existing?: ItemOut
  defaultLocationId?: string | null
  onSuccess?: (item: ItemOut) => void
  onCancel?: () => void
}

export function ItemForm({ siteId, existing, defaultLocationId, onSuccess, onCancel }: ItemFormProps) {
  const createMutation = useCreateItem(siteId)
  const updateMutation = useUpdateItem(siteId, existing?.id ?? '')

  const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: existing?.name ?? '',
      description: existing?.description ?? '',
      category: existing?.category ?? '',
      brand: existing?.brand ?? '',
      model: existing?.model ?? '',
      condition: existing?.condition as FormData['condition'] ?? 'unknown',
      item_type: existing?.item_type as FormData['item_type'] ?? 'unique',
      location_id: existing?.location_id ?? defaultLocationId ?? null,
      quantity: existing?.quantity ?? 1,
      serial_numbers: existing?.serial_numbers?.join(', ') ?? '',
      barcodes: existing?.barcodes?.join(', ') ?? '',
      purchase_price_cents: existing?.purchase_price_cents
        ? existing.purchase_price_cents / 100
        : null,
      estimated_value_cents: existing?.estimated_value_cents
        ? existing.estimated_value_cents / 100
        : null,
      currency_code: existing?.currency_code ?? 'USD',
      notes: existing?.notes ?? '',
      custom_tags: existing?.custom_tags?.join(', ') ?? '',
      warranty_notes: existing?.warranty_notes ?? '',
    },
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      serial_numbers: data.serial_numbers
        ? data.serial_numbers.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
      barcodes: data.barcodes
        ? data.barcodes.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
      custom_tags: data.custom_tags
        ? data.custom_tags.split(',').map(s => s.trim()).filter(Boolean)
        : undefined,
      purchase_price_cents: data.purchase_price_cents
        ? Math.round(data.purchase_price_cents * 100)
        : null,
      estimated_value_cents: data.estimated_value_cents
        ? Math.round(data.estimated_value_cents * 100)
        : null,
    }

    try {
      const result = existing
        ? await updateMutation.mutateAsync(payload)
        : await createMutation.mutateAsync(payload)
      onSuccess?.(result)
    } catch {
      // toast in hook
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Identity */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-kraft-400 uppercase tracking-wider">Identity</h3>

        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Name *</label>
          <input {...register('name')} className="input" placeholder="Item name" />
          {errors.name && <p className="text-xs text-accent-rust mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Description</label>
          <textarea {...register('description')} className="input resize-none" rows={2} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Category</label>
            <select {...register('category')} className="input">
              <option value="">— Select —</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Condition</label>
            <select {...register('condition')} className="input">
              {CONDITIONS.map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Brand</label>
            <input {...register('brand')} className="input" placeholder="e.g. Apple" />
          </div>
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Model</label>
            <input {...register('model')} className="input" placeholder="e.g. MacBook Pro" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Type</label>
            <select {...register('item_type')} className="input">
              <option value="unique">Unique item</option>
              <option value="bulk">Bulk items</option>
              <option value="grouped_set">Grouped set</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Quantity</label>
            <input {...register('quantity')} type="number" min="1" className="input" />
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-kraft-400 uppercase tracking-wider">Location</h3>
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Location</label>
          <Controller
            name="location_id"
            control={control}
            render={({ field }) => (
              <LocationPicker
                siteId={siteId}
                value={field.value ?? null}
                onChange={(id) => field.onChange(id)}
              />
            )}
          />
        </div>
      </section>

      {/* Identification */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-kraft-400 uppercase tracking-wider">Identification</h3>
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Serial numbers</label>
          <input {...register('serial_numbers')} className="input" placeholder="SN001, SN002 (comma-separated)" />
        </div>
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Barcodes / QR codes</label>
          <input {...register('barcodes')} className="input" placeholder="123456789, ..." />
        </div>
      </section>

      {/* Value */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-kraft-400 uppercase tracking-wider">Value</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Purchase price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kraft-400 text-sm">$</span>
              <input
                {...register('purchase_price_cents')}
                type="number"
                step="0.01"
                min="0"
                className="input pl-7"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Est. value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kraft-400 text-sm">$</span>
              <input
                {...register('estimated_value_cents')}
                type="number"
                step="0.01"
                min="0"
                className="input pl-7"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Notes & Tags */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold text-kraft-400 uppercase tracking-wider">Notes</h3>
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Notes</label>
          <textarea {...register('notes')} className="input resize-none" rows={3} />
        </div>
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Tags</label>
          <input {...register('custom_tags')} className="input" placeholder="fragile, vintage, loaned (comma-separated)" />
        </div>
        <div>
          <label className="block text-sm font-medium text-kraft-600 mb-1">Warranty notes</label>
          <input {...register('warranty_notes')} className="input" placeholder="Expires Jan 2027, receipt in box..." />
        </div>
      </section>

      <div className="flex gap-2 pt-2">
        <Button type="submit" variant="primary" disabled={isPending} className="flex-1">
          {isPending ? <Spinner size="sm" /> : existing ? 'Save changes' : 'Add item'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
      </div>
    </form>
  )
}
