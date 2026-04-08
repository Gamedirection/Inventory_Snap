import { useState } from 'react'
import { Plus, Building2, Users, Package, ChevronRight } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useSites, useCreateSite } from '@/api/hooks/useSites'
import { AppShell } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useSiteStore } from '@/store/siteStore'
import type { SiteOut } from '@/lib/types'

const schema = z.object({
  name:        z.string().min(1, 'Name required').max(100),
  description: z.string().optional(),
  address:     z.string().optional(),
})
type FormValues = z.infer<typeof schema>

function SiteCard({ site }: { site: SiteOut }) {
  const navigate = useNavigate()
  const { setActiveSite } = useSiteStore()

  const handleClick = () => {
    setActiveSite(site.id, site.name)
    navigate({ to: `/sites/${site.id}` })
  }

  return (
    <Card onClick={handleClick} hoverable>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-kraft-200 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-kraft-600" />
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
        <ChevronRight className="w-4 h-4 text-kraft-400 flex-shrink-0" />
      </div>
    </Card>
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
          <Button
            type="button"
            variant="ghost"
            className="flex-1"
            onClick={onClose}
          >
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
