// Shared contact book — persisted in localStorage, read by ItemEditModal and SettingsPage.

export interface Contact {
  id: string
  name: string
  email?: string
  phone?: string
  org?: string
}

const KEY = 'inventory-snap-contacts'

export function loadContacts(): Contact[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function saveContacts(contacts: Contact[]): void {
  localStorage.setItem(KEY, JSON.stringify(contacts))
}

/**
 * Look up a contact by name (case-insensitive).
 * If it doesn't exist, create one and persist it.
 * Returns the existing or newly created contact.
 */
export function ensureContact(name: string, extra?: Partial<Omit<Contact, 'id' | 'name'>>): Contact {
  const all = loadContacts()
  const existing = all.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())
  if (existing) {
    // Optionally merge extra fields if provided
    if (extra) {
      const merged = { ...existing, ...Object.fromEntries(Object.entries(extra).filter(([, v]) => v != null)) }
      const next = all.map((c) => (c.id === existing.id ? merged : c))
      saveContacts(next)
      return merged
    }
    return existing
  }
  const contact: Contact = { id: crypto.randomUUID(), name: name.trim(), ...extra }
  saveContacts([...all, contact])
  return contact
}

/** Upsert a contact by id — creates if id is absent. */
export function upsertContact(contact: Contact): Contact {
  const all = loadContacts()
  const idx = all.findIndex((c) => c.id === contact.id)
  const next = idx >= 0 ? all.map((c) => (c.id === contact.id ? contact : c)) : [...all, contact]
  saveContacts(next)
  return contact
}

export function deleteContact(id: string): void {
  saveContacts(loadContacts().filter((c) => c.id !== id))
}
