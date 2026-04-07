import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'

interface SearchBarProps {
  placeholder?: string
  onSearch: (value: string) => void
  defaultValue?: string
  className?: string
  delay?: number
}

export function SearchBar({
  placeholder = 'Search…',
  onSearch,
  defaultValue = '',
  className,
  delay = 300,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue)
  const debounced = useDebounce(value, delay)

  useEffect(() => {
    onSearch(debounced)
  }, [debounced, onSearch])

  return (
    <div className={cn('relative', className)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-kraft-400 pointer-events-none"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 pr-9"
        autoComplete="off"
      />
      {value && (
        <button
          onClick={() => setValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full
                     text-kraft-400 hover:text-kraft-600 hover:bg-kraft-200 transition-colors"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
