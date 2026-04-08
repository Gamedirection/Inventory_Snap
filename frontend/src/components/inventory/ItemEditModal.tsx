import { useState, useRef, useEffect } from 'react'
import { Pencil, X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useUpdateItem } from '@/api/hooks/useItems'
import type { ItemOut } from '@/lib/types'
import { loadContacts, ensureContact } from '@/lib/contacts'
import { CategoryCombobox } from './CategoryCombobox'
import toast from 'react-hot-toast'

const CONDITIONS = [
  'new', 'excellent', 'good', 'fair', 'poor',
  'broken', 'in_repair', 'lost', 'misplaced',
  'shared', 'stolen', 'archived', 'unknown',
]

const CONDITION_LABELS: Record<string, string> = {
  new: 'New', excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Poor',
  broken: 'Broken', in_repair: 'In Repair', lost: 'Lost', misplaced: 'Misplaced',
  shared: 'Shared / Lended', stolen: 'Stolen', archived: 'Archived', unknown: 'Unknown',
}

// ── Owner combobox ────────────────────────────────────────────────────────────

function OwnerCombobox({
  value,
  onChange,
}: {
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Read from shared contact book
  const allOwners = loadContacts().map((c) => c.name).sort()

  const filtered = input
    ? allOwners.filter((o) => o.toLowerCase().includes(input.toLowerCase()))
    : allOwners

  const showCreate =
    input.trim() &&
    !value.includes(input.trim()) &&
    !allOwners.some((o) => o.toLowerCase() === input.trim().toLowerCase())

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addOwner = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    // Auto-create contact if it doesn't exist yet
    ensureContact(trimmed)
    if (!value.includes(trimmed)) onChange([...value, trimmed])
    setInput('')
    setOpen(false)
  }

  const removeOwner = (name: string) => onChange(value.filter((o) => o !== name))

  return (
    <div ref={ref} className="relative">
      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {value.map((owner) => (
            <span
              key={owner}
              className="flex items-center gap-1 tag text-[10px] px-2 py-0.5"
            >
              {owner}
              <button
                type="button"
                onClick={() => removeOwner(owner)}
                className="hover:text-accent-rust"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input
          className="input pr-8 text-sm"
          placeholder="Add owner…"
          value={input}
          onChange={(e) => { setInput(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
              e.preventDefault()
              addOwner(input.trim())
            }
          }}
        />
        {input && (
          <button
            type="button"
            onClick={() => setInput('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 hover:text-kraft-600"
          >
            <X className="w-3.5 h-3.5 text-kraft-400" />
          </button>
        )}
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-kraft-200
                        rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-44 overflow-y-auto py-1">
            {filtered
              .filter((o) => !value.includes(o))
              .map((owner) => (
                <button
                  key={owner}
                  type="button"
                  onMouseDown={() => addOwner(owner)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-kraft-50 text-kraft-700"
                >
                  {owner}
                </button>
              ))}
            {showCreate && (
              <button
                type="button"
                onMouseDown={() => addOwner(input.trim())}
                className="w-full text-left px-3 py-2 text-sm text-kraft-500 hover:bg-kraft-50 flex items-center gap-2"
              >
                <span className="text-accent-sage font-medium">+ Add</span>
                <span className="truncate">"{input.trim()}"</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface ItemEditModalProps {
  open: boolean
  onClose: () => void
  siteId: string
  item: ItemOut
}

export function ItemEditModal({ open, onClose, siteId, item }: ItemEditModalProps) {
  const update = useUpdateItem(siteId, item.id)

  const [name, setName]           = useState(item.name ?? '')
  const [description, setDesc]    = useState(item.description ?? '')
  const [category, setCategory]   = useState(item.category ?? '')
  const [brand, setBrand]         = useState(item.brand ?? '')
  const [model, setModel]         = useState(item.model ?? '')
  const [condition, setCond]      = useState(item.condition ?? 'unknown')
  const [quantity, setQty]        = useState(String(item.quantity ?? 1))
  const [serialNums, setSerial]   = useState((item.serial_numbers ?? []).join(', '))
  const [purchaseDate, setPDate]  = useState(item.purchase_date ?? '')
  const [purchasePrice, setPPrice]= useState(
    item.purchase_price_cents != null ? String(item.purchase_price_cents / 100) : ''
  )
  const [purchaseLoc, setPLoc]    = useState(item.purchase_location ?? '')
  const [notes, setNotes]         = useState(item.notes ?? '')
  const [tags, setTags]           = useState((item.custom_tags ?? []).join(', '))
  const [owners, setOwners]       = useState<string[]>(
    item.owner_contact_name ? item.owner_contact_name.split(',').map((s) => s.trim()).filter(Boolean) : []
  )

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Name is required'); return }
    const priceVal = purchasePrice.trim()
    const priceCents = priceVal ? Math.round(parseFloat(priceVal) * 100) : undefined
    if (priceVal && isNaN(priceCents!)) { toast.error('Invalid price'); return }
    try {
      await update.mutateAsync({
        name:                  name.trim(),
        description:           description.trim()    || undefined,
        category:              category.trim()       || undefined,
        brand:                 brand.trim()          || undefined,
        model:                 model.trim()          || undefined,
        condition,
        quantity:              parseInt(quantity, 10) || 1,
        serial_numbers:        serialNums.split(',').map((s) => s.trim()).filter(Boolean),
        purchase_date:         purchaseDate          || undefined,
        purchase_price_cents:  priceCents,
        purchase_location:     purchaseLoc.trim()    || undefined,
        notes:                 notes.trim()          || undefined,
        custom_tags:           tags.split(',').map((t) => t.trim()).filter(Boolean),
        owner_contact_name:    owners.length > 0 ? owners.join(', ') : undefined,
      } as Partial<ItemOut>)
      toast.success('Item updated')
      onClose()
    } catch {
      toast.error('Failed to update item')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit Item" size="md">
      <div className="px-5 pb-6 space-y-3">

        <div>
          <label className="text-xs text-kraft-500 font-medium">Name *</label>
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-kraft-500 font-medium">Description</label>
          <textarea className="input mt-1 resize-none" rows={2}
            value={description} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-kraft-500 font-medium">Category</label>
            <div className="mt-1">
              <CategoryCombobox siteId={siteId} value={category} onChange={setCategory} />
            </div>
          </div>
          <div>
            <label className="text-xs text-kraft-500 font-medium">Condition</label>
            <select className="input mt-1" value={condition} onChange={(e) => setCond(e.target.value)}>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{CONDITION_LABELS[c] ?? c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-kraft-500 font-medium">Brand</label>
            <input className="input mt-1" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-kraft-500 font-medium">Model</label>
            <input className="input mt-1" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-kraft-500 font-medium">Quantity</label>
          <input className="input mt-1" type="number" min={1}
            value={quantity} onChange={(e) => setQty(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-kraft-500 font-medium">Serial number(s)</label>
          <input className="input mt-1" placeholder="Comma separated if multiple"
            value={serialNums} onChange={(e) => setSerial(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-kraft-500 font-medium">Date purchased</label>
            <input className="input mt-1" type="date"
              value={purchaseDate} onChange={(e) => setPDate(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-kraft-500 font-medium">Purchase price (USD)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kraft-400 text-sm">$</span>
              <input className="input pl-6" type="number" min={0} step="0.01" placeholder="0.00"
                value={purchasePrice} onChange={(e) => setPPrice(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs text-kraft-500 font-medium">Purchased from</label>
          <input className="input mt-1" placeholder="Store name, URL, or address"
            value={purchaseLoc} onChange={(e) => setPLoc(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-kraft-500 font-medium">Tags (comma separated)</label>
          <input className="input mt-1" placeholder="e.g. fragile, electronics"
            value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>

        <div>
          <label className="text-xs text-kraft-500 font-medium">Owner(s)</label>
          <div className="mt-1">
            <OwnerCombobox value={owners} onChange={setOwners} />
          </div>
        </div>

        <div>
          <label className="text-xs text-kraft-500 font-medium">Notes</label>
          <textarea className="input mt-1 resize-none" rows={3}
            value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button
            className="flex-1 bg-[#c8a97e] hover:bg-[#b8976a] text-white border-0"
            onClick={handleSave}
            loading={update.isPending}
            leftIcon={<Pencil className="w-4 h-4" />}
          >
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}
