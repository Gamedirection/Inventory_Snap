import { useState } from 'react'
import type { ChangeEvent, ElementType } from 'react'
import {
  Settings, User, BookUser,
  LogOut, ChevronRight, Mail, Pencil, Plus, Trash2, Phone, Building2, Lock, ImagePlus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import { useChangePassword, useUpdateMe } from '@/api/hooks/useAuth'
import { cn } from '@/lib/utils'

type Tab = 'settings' | 'profile' | 'contacts'

// ── Contact book (local, persisted in localStorage) ──────────────────────────

interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  org?: string
}

const CONTACTS_KEY = 'inventory-snap-contacts'

function loadContacts(): Contact[] {
  try { return JSON.parse(localStorage.getItem(CONTACTS_KEY) ?? '[]') } catch { return [] }
}

function saveContacts(contacts: Contact[]) {
  localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts))
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

// ── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab() {
  const logout = useAuthStore((s) => s.logout)

  const handleLogout = () => {
    logout()
    window.location.href = '/login'
  }

  return (
    <div className="space-y-4">
      <div className="card divide-y divide-kraft-200 p-0 overflow-hidden">
        <SettingRow
          icon={Building2}
          label="App version"
          value="1.0.0"
        />
        <SettingRow
          icon={Settings}
          label="AI provider"
          value="Ollama (local)"
        />
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

// ── Contacts tab ─────────────────────────────────────────────────────────────

function ContactsTab() {
  const [contacts, setContacts]   = useState<Contact[]>(loadContacts)
  const [editContact, setEdit]    = useState<Contact | null>(null)
  const [addOpen, setAddOpen]     = useState(false)

  const persist = (next: Contact[]) => { setContacts(next); saveContacts(next) }

  const handleSave = (c: Contact) => {
    const existing = contacts.find((x) => x.id === c.id)
    if (existing) {
      persist(contacts.map((x) => (x.id === c.id ? c : x)))
      toast.success('Contact updated')
    } else {
      persist([...contacts, c])
      toast.success('Contact added')
    }
    setEdit(null)
    setAddOpen(false)
  }

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this contact?')) return
    persist(contacts.filter((c) => c.id !== id))
    toast.success('Contact removed')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-kraft-500 font-medium uppercase tracking-wide">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
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

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <BookUser className="w-10 h-10 text-kraft-300 mb-3" />
          <p className="text-sm text-kraft-500">No contacts yet.</p>
          <p className="text-xs text-kraft-400 mt-1">Add contacts to assign owners to items.</p>
        </div>
      ) : (
        <div className="card divide-y divide-kraft-200 p-0 overflow-hidden">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-kraft-700 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-kraft-100">
                  {c.name[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-kraft-700 truncate">{c.name}</p>
                <p className="text-xs text-kraft-400 truncate">
                  {[c.email, c.phone, c.org].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button
                onClick={() => setEdit(c)}
                className="p-1.5 rounded-lg text-kraft-400 hover:text-kraft-600 hover:bg-kraft-200 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="p-1.5 rounded-lg text-kraft-400 hover:text-accent-rust hover:bg-accent-rust/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
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
  const isNew = !loadContacts().find((c) => c.id === contact.id)
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
