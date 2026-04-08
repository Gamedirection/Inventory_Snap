import { useState } from 'react'
import type { ChangeEvent, ElementType } from 'react'
import {
  Settings, User, BookUser,
  LogOut, ChevronRight, Mail, Pencil, Plus, Trash2, Phone, Building2, Lock, ImagePlus,
  Download, Loader2, Package, ChevronDown,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import { useChangePassword, useUpdateMe } from '@/api/hooks/useAuth'
import { useSites, useSiteMembers } from '@/api/hooks/useSites'
import { useItems } from '@/api/hooks/useItems'
import { useCreateExport, useExportJob } from '@/api/hooks/usePhotos'
import { useSiteStore } from '@/store/siteStore'
import { cn } from '@/lib/utils'
import {
  loadContacts, saveContacts, upsertContact, deleteContact as removeContact,
} from '@/lib/contacts'
import type { Contact } from '@/lib/contacts'

type Tab = 'settings' | 'profile' | 'contacts'

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

// ── Backup row ────────────────────────────────────────────────────────────────

function BackupRow({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [jobId, setJobId] = useState<string | null>(null)
  const createExport = useCreateExport(siteId)
  const { data: job } = useExportJob(siteId, jobId)

  // Auto-download when job completes
  const status = job?.status
  if (status === 'completed' && job?.download_url && jobId) {
    // Use the backend /download redirect endpoint instead of presigned URL
    const backendUrl = `/api/v1/sites/${siteId}/export/${jobId}/download`
    const a = document.createElement('a')
    a.href = backendUrl
    a.download = `${siteName}-backup.xlsx`
    a.click()
    setJobId(null)
  }

  const handleDownload = async () => {
    try {
      const newJob = await createExport.mutateAsync()
      setJobId(newJob.id)
      toast('Generating backup…', { icon: '📦' })
    } catch {
      toast.error('Failed to start backup')
    }
  }

  const isPending = createExport.isPending || (!!jobId && status !== 'completed' && status !== 'failed')

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="w-8 h-8 rounded-lg bg-kraft-200 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-4 h-4 text-kraft-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-kraft-700 truncate">{siteName}</p>
        {status === 'failed' && (
          <p className="text-xs text-accent-rust">Export failed — try again</p>
        )}
        {isPending && (
          <p className="text-xs text-kraft-400">Generating XLSX…</p>
        )}
      </div>
      <button
        onClick={handleDownload}
        disabled={isPending}
        className="flex items-center gap-1.5 text-xs font-medium text-kraft-600
                   hover:text-kraft-800 transition-colors disabled:opacity-40"
      >
        {isPending
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Download className="w-4 h-4" />
        }
        {isPending ? 'Generating…' : 'Download'}
      </button>
    </div>
  )
}

// ── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const logout = useAuthStore((s) => s.logout)
  const { data: sites = [] } = useSites()

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <div className="space-y-4">
      <div className="card divide-y divide-kraft-200 p-0 overflow-hidden">
        <SettingRow icon={Building2} label="App version" value="1.0.0" />
        <SettingRow icon={Settings}  label="AI provider"  value="Ollama (local)" />
      </div>

      {/* Backup / Download */}
      <div>
        <p className="section-title mb-2">Backup &amp; Export</p>
        <div className="card divide-y divide-kraft-200 p-0 overflow-hidden">
          {sites.length === 0 ? (
            <p className="px-4 py-3 text-xs text-kraft-400">No sites yet.</p>
          ) : (
            sites.map((site) => (
              <BackupRow key={site.id} siteId={site.id} siteName={site.name} />
            ))
          )}
        </div>
        <p className="mt-1.5 text-xs text-kraft-400">
          Downloads a full XLSX spreadsheet with all items, locations, photos, and movements.
        </p>
      </div>

      <div className="card divide-y divide-kraft-200 p-0 overflow-hidden">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3.5 w-full hover:bg-kraft-100 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-accent-rust/10 flex items-center justify-center flex-shrink-0">
            <LogOut className="w-4 h-4 text-accent-rust" />
          </div>
          <span className="text-sm font-medium text-accent-rust">Log out</span>
        </button>
      </div>
    </div>
  )
}

function SettingRow({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: ElementType
  label: string
  value?: string
  onClick?: () => void
}) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3.5 w-full text-left',
        onClick && 'hover:bg-kraft-100 transition-colors'
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-kraft-200 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-kraft-600" />
      </div>
      <span className="flex-1 text-sm font-medium text-kraft-700">{label}</span>
      {value && <span className="text-xs text-kraft-400">{value}</span>}
      {onClick && <ChevronRight className="w-4 h-4 text-kraft-300 flex-shrink-0" />}
    </Wrapper>
  )
}

// ── Profile tab ──────────────────────────────────────────────────────────────

function ProfileTab() {
  const user = useAuthStore((s) => s.user)
  const updateMe = useUpdateMe()
  const changePassword = useChangePassword()
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const initials = (displayName || user?.email || '?').trim()[0]?.toUpperCase() ?? '?'

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file')
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await updateMe.mutateAsync({ avatar_url: dataUrl })
      setAvatarUrl(dataUrl)
      toast.success('Profile image updated')
    } catch {
      toast.error('Failed to update profile image')
    } finally {
      event.target.value = ''
    }
  }

  const handleProfileSave = async () => {
    const nextName = displayName.trim()
    const nextEmail = email.trim().toLowerCase()
    if (!nextEmail) {
      toast.error('Email is required')
      return
    }
    try {
      const updated = await updateMe.mutateAsync({
        display_name: nextName || null,
        email: nextEmail,
        avatar_url: avatarUrl || null,
      })
      setDisplayName(updated.display_name ?? '')
      setEmail(updated.email)
      setAvatarUrl(updated.avatar_url ?? '')
      toast.success('Profile updated')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? 'Failed to update profile')
    }
  }

  const handlePasswordSave = async () => {
    if (!currentPassword || !newPassword) {
      toast.error('Enter your current and new password')
      return
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Password confirmation does not match')
      return
    }
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated')
    } catch (error: any) {
      toast.error(error?.response?.data?.detail ?? 'Failed to update password')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-kraft-700 overflow-hidden flex items-center justify-center border-4 border-kraft-100 shadow-md">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-kraft-100">{initials}</span>
            )}
          </div>
          <label className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-kraft-50 border border-kraft-200 shadow-sm flex items-center justify-center cursor-pointer hover:bg-kraft-100 transition-colors">
            <ImagePlus className="w-4 h-4 text-kraft-600" />
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleAvatarChange}
            />
          </label>
        </div>
        <div className="text-center">
          <p className="font-semibold text-kraft-700">{displayName || 'No name set'}</p>
          <p className="text-sm text-kraft-400">{email || user?.email}</p>
        </div>
      </div>

      <div className="card space-y-3">
        <p className="section-title">Profile</p>
        <div>
          <label className="text-xs text-kraft-500 font-medium">Name</label>
          <div className="relative mt-1">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kraft-400" />
            <input
              className="input pl-8"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-kraft-500 font-medium">Email</label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kraft-400" />
            <input
              className="input pl-8"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </div>
        <Button
          type="button"
          className="w-full"
          onClick={handleProfileSave}
          loading={updateMe.isPending}
        >
          Save profile
        </Button>
      </div>

      <div className="card space-y-3">
        <p className="section-title">Password</p>
        <div>
          <label className="text-xs text-kraft-500 font-medium">Current password</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kraft-400" />
            <input
              className="input pl-8"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-kraft-500 font-medium">New password</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kraft-400" />
            <input
              className="input pl-8"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-kraft-500 font-medium">Confirm new password</label>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kraft-400" />
            <input
              className="input pl-8"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handlePasswordSave}
          loading={changePassword.isPending}
        >
          Update password
        </Button>
      </div>
    </div>
  )
}

// ── Contact card with owned items ─────────────────────────────────────────────

function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: Contact
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const { activeSiteId } = useSiteStore()
  const { data } = useItems(expanded ? activeSiteId : null, { size: 200 })

  const ownedItems = (data?.items ?? []).filter((item) => {
    if (!item.owner_contact_name) return false
    return item.owner_contact_name.split(',').map((s) => s.trim()).some(
      (o) => o.toLowerCase() === contact.name.toLowerCase()
    )
  })

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-kraft-700 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-kraft-100">
            {contact.name[0].toUpperCase()}
          </span>
        </div>
        <button
          className="flex-1 min-w-0 text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <p className="text-sm font-medium text-kraft-700 truncate">{contact.name}</p>
          <p className="text-xs text-kraft-400 truncate">
            {[contact.email, contact.phone, contact.org].filter(Boolean).join(' · ')}
          </p>
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="p-1.5 rounded-lg text-kraft-400 hover:text-kraft-600 hover:bg-kraft-200 transition-colors"
          title="Show owned items"
        >
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-kraft-400 hover:text-kraft-600 hover:bg-kraft-200 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-kraft-400 hover:text-accent-rust hover:bg-accent-rust/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="px-4 pb-3 bg-kraft-50 border-t border-kraft-100">
          {!activeSiteId ? (
            <p className="text-xs text-kraft-400 py-2">Select an active site to see owned items.</p>
          ) : ownedItems.length === 0 ? (
            <p className="text-xs text-kraft-400 py-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" /> No items owned in this site.
            </p>
          ) : (
            <div className="space-y-1 pt-2">
              <p className="text-[10px] text-kraft-400 uppercase tracking-wide font-medium mb-1.5">
                Owns {ownedItems.length} item{ownedItems.length !== 1 ? 's' : ''}
              </p>
              {ownedItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs text-kraft-600 py-1">
                  <Package className="w-3 h-3 flex-shrink-0 text-kraft-400" />
                  <span className="truncate">{item.name}</span>
                  {item.category && (
                    <span className="ml-auto text-kraft-400 truncate">{item.category}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Contacts tab ─────────────────────────────────────────────────────────────

function ContactsTab() {
  const [contacts, setContacts]   = useState<Contact[]>(loadContacts)
  const [editContact, setEdit]    = useState<Contact | null>(null)
  const [addOpen, setAddOpen]     = useState(false)

  // Also surface site members as contacts
  const { activeSiteId } = useSiteStore()
  const { data: members = [] } = useSiteMembers(activeSiteId)

  // Merge members into contacts: add any member not already present by name
  const memberNames = new Set(contacts.map((c) => c.name.toLowerCase()))
  const membersAsContacts: Contact[] = members
    .filter((m) => {
      const name = m.user_display_name || m.user_email || ''
      return name && !memberNames.has(name.toLowerCase())
    })
    .map((m) => ({
      id: `member-${m.user_id}`,
      name: m.user_display_name ?? m.user_email ?? 'Unknown',
      email: m.user_email ?? undefined,
    }))

  const allContacts = [...contacts, ...membersAsContacts]

  const persist = (next: Contact[]) => { setContacts(next); saveContacts(next) }

  const handleSave = (c: Contact) => {
    upsertContact(c)
    setContacts(loadContacts())
    toast.success(contacts.find((x) => x.id === c.id) ? 'Contact updated' : 'Contact added')
    setEdit(null)
    setAddOpen(false)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this contact?')) return
    // Don't allow deleting member-derived contacts
    if (id.startsWith('member-')) { toast.error("Can't remove a site member here"); return }
    removeContact(id)
    persist(loadContacts())
    toast.success('Contact removed')
  }

  // Save a member-derived contact permanently
  const handleSaveMember = (c: Contact) => {
    const realContact: Contact = { ...c, id: crypto.randomUUID() }
    upsertContact(realContact)
    setContacts(loadContacts())
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-kraft-500 font-medium uppercase tracking-wide">
          {allContacts.length} contact{allContacts.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-kraft-600
                     hover:text-kraft-800 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add contact
        </button>
      </div>

      {allContacts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BookUser className="w-10 h-10 text-kraft-300 mb-3" />
          <p className="text-sm text-kraft-500">No contacts yet.</p>
          <p className="text-xs text-kraft-400 mt-1">Add contacts to assign owners to items.</p>
        </div>
      ) : (
        <div className="card divide-y divide-kraft-200 p-0 overflow-hidden">
          {allContacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onEdit={() => {
                if (c.id.startsWith('member-')) {
                  handleSaveMember(c)
                  toast('Member saved as contact — you can now edit them.')
                } else {
                  setEdit(c)
                }
              }}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}

      {activeSiteId && membersAsContacts.length > 0 && (
        <p className="text-xs text-kraft-400">
          Site members shown above are automatically available as owners. Save them to edit details.
        </p>
      )}

      {(addOpen || editContact) && (
        <ContactFormModal
          contact={editContact ?? { id: crypto.randomUUID(), name: '' }}
          onSave={handleSave}
          onClose={() => { setEdit(null); setAddOpen(false) }}
        />
      )}
    </div>
  )
}

function ContactFormModal({
  contact,
  onSave,
  onClose,
}: {
  contact: Contact
  onSave: (c: Contact) => void
  onClose: () => void
}) {
  const isNew = !loadContacts().find((c) => c.id === contact.id && !contact.id.startsWith('member-'))
  const [name,  setName]  = useState(contact.name)
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [org,   setOrg]   = useState(contact.org ?? '')

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    onSave({
      id:    contact.id,
      name:  name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      org:   org.trim()   || undefined,
    })
  }

  return (
    <Modal open onClose={onClose} title={isNew ? 'Add contact' : 'Edit contact'} size="sm">
      <div className="px-5 pb-6 space-y-3">
        <div>
          <label className="text-xs text-kraft-500 font-medium">Name *</label>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-kraft-500 font-medium">Email</label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kraft-400" />
            <input className="input pl-8" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-kraft-500 font-medium">Phone</label>
          <div className="relative mt-1">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-kraft-400" />
            <input className="input pl-8" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-kraft-500 font-medium">Organization</label>
          <input className="input mt-1" value={org} onChange={(e) => setOrg(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-[#c8a97e] hover:bg-[#b8976a] text-white border-0"
            onClick={handleSave}
          >
            {isNew ? 'Add' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: ElementType }[] = [
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'profile',  label: 'Profile',  icon: User },
  { id: 'contacts', label: 'Contacts', icon: BookUser },
]

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>('settings')

  return (
    <AppShell headerTitle="Settings" showSiteSelector={false}>
      {/* Tab bar */}
      <div className="sticky top-0 z-20 bg-kraft-50 border-b border-kraft-200 px-4">
        <div className="flex max-w-lg mx-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors flex-1 justify-center',
                tab === id
                  ? 'border-kraft-700 text-kraft-700'
                  : 'border-transparent text-kraft-400 hover:text-kraft-600'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 pb-8 max-w-lg mx-auto">
        {tab === 'settings' && <SettingsTab />}
        {tab === 'profile'  && <ProfileTab />}
        {tab === 'contacts' && <ContactsTab />}
      </div>
    </AppShell>
  )
}
