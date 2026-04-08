import { useRef, useState } from 'react'
import { Plus, Building2, Building, Users, Package, ChevronRight, Archive, MoreVertical, Pencil, Trash2, Warehouse, Home, Factory, Store, School, Hotel, Landmark } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useSites, useCreateSite, useDeleteSite, useUpdateSite, useUploadSiteIcon, useDeleteSiteIcon } from '@/api/hooks/useSites'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useSiteStore } from '@/store/siteStore'
import { withAuthToken } from '@/lib/utils'
import type { SiteOut } from '@/lib/types'

const PRESET_MAP: Record<string, LucideIcon> = {
  Building2, Building, Warehouse, Home, Factory, Store, School, Hotel, Landmark,
}

const schema = z.object({
  name:        z.string().min(1, 'Name required').max(100),
  description: z.string().optional(),
  address:     z.string().optional(),
})
type FormValues = z.infer<typeof schema>

function SiteCard({ site }: { site: SiteOut }) {
  const navigate = useNavigate()
  const { setActiveSite, activeSiteId } = useSiteStore()
  const archive = useDeleteSite(site.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const handleClick = () => {
    setActiveSite(site.id, site.name)
    navigate({ to: `/sites/${site.id}` })
  }

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    if (!window.confirm(`Archive "${site.name}"? It will be hidden and all data preserved.`)) return
    try {
      await archive.mutateAsync()
      if (activeSiteId === site.id) useSiteStore.getState().setActiveSite(null, null)
      toast.success(`"${site.name}" archived`)
    } catch {
      toast.error('Failed to archive site')
    }
  }

  const iconSrc = site.icon_url ? withAuthToken(site.icon_url) ?? site.icon_url : null
  const PresetIcon = site.icon_preset ? PRESET_MAP[site.icon_preset] : null

  return (
    <>
      <div className="relative">
        <Card onClick={handleClick} hoverable>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-kraft-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {iconSrc ? (
                <img src={iconSrc} alt={site.name} className="w-full h-full object-cover" />
              ) : PresetIcon ? (
                <PresetIcon className="w-6 h-6 text-kraft-600" />
              ) : (
                <Building2 className="w-6 h-6 text-kraft-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-kraft-700 truncate">{site.name}</h3>
              {site.description && (
                <p className="text-xs text-kraft-400 truncate mt-0.5">{site.description}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-xs text-kraft-400">
                  <Package className="w-3 h-3" />
                  {site.item_count} items
                </span>
                <span className="flex items-center gap-1 text-xs text-kraft-400">
                  <Users className="w-3 h-3" />
                  {site.member_count} members
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
                className="p-1.5 rounded-lg text-kraft-400 hover:text-kraft-600 hover:bg-kraft-200 transition-colors"
                aria-label="Site options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 text-kraft-400 flex-shrink-0" />
            </div>
          </div>
        </Card>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-2 top-12 z-50 bg-white border border-kraft-200 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setEditOpen(true) }}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-kraft-600
                           hover:bg-kraft-50 transition-colors text-left"
              >
                <Pencil className="w-4 h-4" />
                Edit site
              </button>
              <button
                onClick={handleArchive}
                disabled={archive.isPending}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-kraft-600
                           hover:bg-kraft-50 transition-colors text-left"
              >
                <Archive className="w-4 h-4" />
                Archive site
              </button>
            </div>
          </>
        )}
      </div>

      {editOpen && (
        <EditSiteModal site={site} onClose={() => setEditOpen(false)} />
      )}
    </>
  )
}

function EditSiteModal({ site, onClose }: { site: SiteOut; onClose: () => void }) {
  const updateSite = useUpdateSite(site.id)
  const uploadIcon = useUploadSiteIcon(site.id)
  const deleteIcon = useDeleteSiteIcon(site.id)
  const fileRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: site.name,
      description: site.description ?? '',
      address: site.address ?? '',
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await updateSite.mutateAsync(values)
      toast.success('Site updated')
      onClose()
    } catch {
      toast.error('Failed to update site')
    }
  }

  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadIcon.mutateAsync(file)
      toast.success('Icon updated')
    } catch {
      toast.error('Failed to upload icon')
    }
  }

  const handleRemoveIcon = async () => {
    try {
      await deleteIcon.mutateAsync()
      toast.success('Icon removed')
    } catch {
      toast.error('Failed to remove icon')
    }
  }

  const iconSrc = site.icon_url ? withAuthToken(site.icon_url) ?? site.icon_url : null
  const PresetIconEdit = site.icon_preset ? PRESET_MAP[site.icon_preset] : null
  const hasIcon = !!(iconSrc || site.icon_preset)

  return (
    <Modal open onClose={onClose} title="Edit Site" size="sm">
      <div className="px-5 pb-5 flex flex-col gap-4">
        {/* Icon picker */}
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl bg-kraft-200 flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer border-2 border-dashed border-kraft-300 hover:border-kraft-500 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            {uploadIcon.isPending ? (
              <Spinner size="sm" />
            ) : iconSrc ? (
              <img src={iconSrc} alt={site.name} className="w-full h-full object-cover" />
            ) : PresetIconEdit ? (
              <PresetIconEdit className="w-7 h-7 text-kraft-600" />
            ) : (
              <Building2 className="w-7 h-7 text-kraft-400" />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              loading={uploadIcon.isPending}
            >
              {hasIcon ? 'Change image' : 'Upload image'}
            </Button>
            {hasIcon && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void handleRemoveIcon()}
                loading={deleteIcon.isPending}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Remove
              </Button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleIconChange(e)}
          />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <div>
            <label className="label">Site name *</label>
            <input
              className={`input ${errors.name ? 'border-accent-rust' : ''}`}
              {...register('name')}
            />
            {errors.name && <p className="mt-1 text-xs text-accent-rust">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" {...register('description')} />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" {...register('address')} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting || updateSite.isPending}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

function CreateSiteModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const createSite = useCreateSite()
  const { setActiveSite } = useSiteStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    try {
      const site = await createSite.mutateAsync(values)
      toast.success(`"${site.name}" created`)
      setActiveSite(site.id, site.name)
      reset()
      onClose()
      navigate({ to: `/sites/${site.id}` })
    } catch {
      toast.error('Failed to create site')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Site" size="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="px-5 pb-5 flex flex-col gap-4">
        <div>
          <label className="label">Site name *</label>
          <input
            className={`input ${errors.name ? 'border-accent-rust' : ''}`}
            placeholder="e.g. Warehouse B, Floor 3"
            {...register('name')}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-accent-rust">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="label">Description</label>
          <input
            className="input"
            placeholder="Optional short description"
            {...register('description')}
          />
        </div>

        <div>
          <label className="label">Address</label>
          <input
            className="input"
            placeholder="123 Main St, Building A"
            {...register('address')}
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            loading={isSubmitting || createSite.isPending}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function SitesPage() {
  const { data: sites = [], isLoading } = useSites()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <AppShell headerTitle="My Sites" showSiteSelector={false}>
      <div className="px-4 pt-4 pb-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : sites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-kraft-200 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-kraft-400" />
            </div>
            <h2 className="text-base font-semibold text-kraft-600 mb-1">No sites yet</h2>
            <p className="text-sm text-kraft-400 mb-6 max-w-xs">
              Create your first inventory site to start capturing items.
            </p>
            <Button onClick={() => setCreateOpen(true)} leftIcon={<Plus className="w-4 h-4" />}>
              Create Site
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      {sites.length > 0 && (
        <button
          onClick={() => setCreateOpen(true)}
          className="fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full
                     bg-kraft-700 text-kraft-50 shadow-lg shadow-kraft-800/30
                     flex items-center justify-center
                     hover:bg-kraft-800 active:scale-95 transition-all"
          aria-label="New site"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      <CreateSiteModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </AppShell>
  )
}
