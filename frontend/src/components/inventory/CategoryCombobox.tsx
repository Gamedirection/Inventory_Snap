import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { useItems } from '@/api/hooks/useItems'
import { cn } from '@/lib/utils'

export function CategoryCombobox({
  siteId,
  value,
  onChange,
}: {
  siteId: string
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useItems(siteId, { size: 200 })
  const allCategories = Array.from(
    new Set((data?.items ?? []).map((i) => i.category).filter(Boolean) as string[])
  ).sort()

  const filtered = input
    ? allCategories.filter((c) => c.toLowerCase().includes(input.toLowerCase()))
    : allCategories

  const showCreate = input.trim() && !allCategories.some(
    (c) => c.toLowerCase() === input.trim().toLowerCase()
  )

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (cat: string) => {
    setInput(cat)
    onChange(cat)
    setOpen(false)
  }

  const clear = () => {
    setInput('')
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <input
          className="input pr-16 text-sm"
          placeholder="e.g. Electronics"
          value={input}
          onChange={(e) => { setInput(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {input && (
            <button type="button" onClick={clear} className="p-0.5 hover:text-kraft-600">
              <X className="w-3.5 h-3.5 text-kraft-400" />
            </button>
          )}
          <ChevronDown
            className={cn('w-4 h-4 text-kraft-400 transition-transform', open && 'rotate-180')}
          />
        </div>
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white border border-kraft-200
                        rounded-xl shadow-xl overflow-hidden">
          <div className="max-h-44 overflow-y-auto py-1">
            {filtered.map((cat) => (
              <button
                key={cat}
                type="button"
                onMouseDown={() => select(cat)}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  cat === value
                    ? 'bg-accent-sage/10 text-accent-sage font-medium'
                    : 'hover:bg-kraft-50 text-kraft-700'
                )}
              >
                {cat}
              </button>
            ))}
            {showCreate && (
              <button
                type="button"
                onMouseDown={() => select(input.trim())}
                className="w-full text-left px-3 py-2 text-sm text-kraft-500 hover:bg-kraft-50 flex items-center gap-2"
              >
                <span className="text-accent-sage font-medium">+ Create</span>
                <span className="truncate">"{input.trim()}"</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
