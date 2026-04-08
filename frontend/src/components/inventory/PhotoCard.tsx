import { MapPin, Tag } from 'lucide-react'
import type { PhotoOut } from '@/lib/types'

interface PhotoCardProps {
  photo: PhotoOut
  onClick: (photo: PhotoOut) => void
}

export function PhotoCard({ photo, onClick }: PhotoCardProps) {
  const thumbUrl = photo.thumbnail_url ?? photo.url ?? photo.original_url

  return (
    <button
      onClick={() => onClick(photo)}
      className="relative aspect-square rounded-xl overflow-hidden bg-kraft-200
                 border border-kraft-200 hover:border-kraft-300 hover:shadow-md
                 active:scale-[0.97] transition-all duration-150 group"
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt="Photo"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-kraft-400">
          <Tag className="w-8 h-8" />
        </div>
      )}

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent
                      opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Bottom bar (always visible if data present) */}
      {photo.location_id && (
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 flex items-center gap-1
                        bg-gradient-to-t from-black/60 to-transparent">
          <MapPin className="w-3 h-3 text-white/80 flex-shrink-0" />
          <span className="text-[10px] text-white/90 truncate leading-tight">
            {/* location path shown in PhotoViewer; here we just show indicator */}
            Location
          </span>
        </div>
      )}

      {/* AI status badge */}
      {photo.ai_status === 'pending' || photo.ai_status === 'processing' ? (
        <div className="absolute top-1.5 right-1.5 bg-amber-500/90 text-white
                        text-[9px] font-bold px-1.5 py-0.5 rounded-full">
          AI
        </div>
      ) : null}
    </button>
  )
}
