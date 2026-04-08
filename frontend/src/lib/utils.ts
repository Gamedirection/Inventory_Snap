// Simple className merger — avoids adding clsx/tailwind-merge as deps
export function cn(...inputs: Array<string | undefined | null | false>): string {
  return inputs.filter(Boolean).join(' ')
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return formatDate(iso)
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function generateTempId(): string {
  return `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function blobToUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

/**
 * Append the JWT access token to API image paths so <img src> requests pass auth.
 * Non-API URLs (external http/blob) are returned unchanged.
 */
export function withAuthToken(url: string | null | undefined): string | null {
  if (!url) return null
  if (!url.startsWith('/api/')) return url
  // Read token directly from persisted zustand store (avoids hook rules)
  try {
    const raw = localStorage.getItem('inventory-snap-auth')
    const token = raw ? (JSON.parse(raw) as { state?: { accessToken?: string } }).state?.accessToken : null
    if (!token) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}token=${encodeURIComponent(token)}`
  } catch {
    return url
  }
}
