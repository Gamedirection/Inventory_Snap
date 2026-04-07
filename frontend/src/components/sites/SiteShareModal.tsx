import { useState } from 'react'
import { UserPlus, Copy, Check, Users, Shield } from 'lucide-react'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { useSiteMembers, useInviteMember } from '@/api/hooks/useSites'
import type { Member } from '@/lib/types'

const ROLE_COLORS: Record<string, 'sage' | 'kraft' | 'rust' | 'slate'> = {
  owner: 'rust',
  admin: 'sage',
  editor: 'kraft',
  viewer: 'slate',
}

interface SiteShareModalProps {
  siteId: string
  open: boolean
  onClose: () => void
}

export function SiteShareModal({ siteId, open, onClose }: SiteShareModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('editor')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const { data: members = [], isLoading } = useSiteMembers(siteId)
  const inviteMutation = useInviteMember(siteId)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    try {
      const result = await inviteMutation.mutateAsync({ email: email.trim(), role })
      if (result.invite_token) {
        const link = `${window.location.origin}/invite?token=${result.invite_token}`
        await navigator.clipboard.writeText(link)
        setCopiedToken(result.invite_token)
        setTimeout(() => setCopiedToken(null), 3000)
        toast.success('Invite link copied to clipboard')
      }
      setEmail('')
    } catch {
      // error shown in hook
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Share Site">
      <div className="space-y-5">
        {/* Invite form */}
        <form onSubmit={handleInvite} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Invite by email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="colleague@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-kraft-600 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className="input"
            >
              <option value="admin">Admin — manage members, edit everything</option>
              <option value="editor">Editor — add and edit items</option>
              <option value="viewer">Viewer — read only</option>
            </select>
          </div>
          <Button type="submit" variant="primary" disabled={inviteMutation.isPending} className="w-full">
            {inviteMutation.isPending ? <Spinner size="sm" /> : (
              <><UserPlus size={14} /> Generate invite link</>
            )}
          </Button>
        </form>

        {/* Members list */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-kraft-400" />
            <span className="text-sm font-medium text-kraft-600">Current members</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : (
            <div className="space-y-2">
              {members.map((member: Member) => (
                <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-kraft-50">
                  <div className="w-8 h-8 rounded-full bg-kraft-300 flex items-center justify-center text-xs font-bold text-kraft-700">
                    {(member.user_display_name ?? member.user_email ?? '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-kraft-700 truncate">
                      {member.user_display_name ?? member.user_email ?? 'Pending'}
                    </p>
                    {member.user_email && member.user_display_name && (
                      <p className="text-xs text-kraft-400 truncate">{member.user_email}</p>
                    )}
                    {!member.accepted_at && (
                      <p className="text-xs text-accent-rust">Invite pending</p>
                    )}
                  </div>
                  <Badge variant={ROLE_COLORS[member.role] ?? 'kraft'}>
                    <Shield size={10} /> {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
