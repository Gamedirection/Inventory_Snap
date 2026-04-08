import { useNavigate } from '@tanstack/react-router'
import { CheckCircle2, MapPin, Package } from 'lucide-react'
import type { ItemOut } from '@/lib/types'
import { Badge } from '@/components/ui/Badge'
import { cn, withAuthToken } from '@/lib/utils'

const conditionColors: Record<string, 'sage' | 'kraft' | 'rust'> = {
  new:       'sage',
  excellent: 'sage',
  good:      'sage',
  fair:      'kraft',
  poor:      'rust',
  broken:    'rust',
  in_repair: 'kraft',
  lost:      'rust',
  misplaced: 'kraft',
  shared:    'kraft',
  stolen:    'rust',
  archived:  'kraft',
  damaged:   'rust',
  unknown:   'kraft',
}

interface ItemCardProps {
  item: ItemOut
  siteId: string
  selected?: boolean
  onSelect?: (id: string) => void
}

export function ItemCard({ item, siteId, selected, onSelect }: ItemCardProps) {
  const navigate = useNavigate()
  const isVerified = (item.verification_count ?? 0) >= 2
  const thumbUrl = withAuthToken(item.primary_photo_url)

  const handleClick = () => {
    if (onSelect) {
      onSelect(item.id)
    } else {
      navigate({ to: `/sites/${siteId}/inventory/${item.id}` })
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={cn(
        'flex items-center gap-3 bg-kraft-100 border rounded-xl p-3 cursor-pointer',
        'hover:border-kraft-300 hover:shadow-sm active:scale-[0.98] transition-all duration-150',
        selected ? 'border-kraft-500 ring-2 ring-kraft-400/30' : 'border-kraft-200'
      )}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-kraft-200 flex-shrink-0 relative">
        {thumbUrl ? (
          <img src={thumbUrl} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-6 h-6 text-kraft-400" />
          </div>
        )}
        {/* Selected overlay */}
        {selected && (
          <div className="absolute inset-0 bg-kraft-700/40 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-kraft-700 truncate">{item.name}</p>
          {isVerified && (
            <CheckCircle2 className="w-4 h-4 text-accent-sage flex-shrink-0 mt-0.5" />
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {item.category && (
            <span className="tag text-[10px] px-1.5">{item.category}</span>
          )}
          <Badge variant={conditionColors[item.condition] ?? 'kraft'}>
            {item.condition}
          </Badge>
          {item.quantity > 1 && (
            <Badge variant="slate">×{item.quantity}</Badge>
          )}
        </div>

        {item.location_path && (
          <div className="flex items-center gap-1 mt-1.5">
            <MapPin className="w-3 h-3 text-kraft-400 flex-shrink-0" />
            <p className="text-xs text-kraft-400 truncate">{item.location_path}</p>
          </div>
        )}
      </div>
    </div>
  )
}
