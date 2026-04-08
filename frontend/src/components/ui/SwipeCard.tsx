import React from 'react'
import { animated } from '@react-spring/web'
import { Check, SkipForward, Trash2 } from 'lucide-react'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

interface SwipeCardProps {
  children: React.ReactNode
  onSwipeUp?: () => void     // approve + advance
  onSwipeDown?: () => void   // skip + advance
  onSwipeRight?: () => void  // approve (same as up)
  onSwipeLeft?: () => void   // delete / hard-reject
  className?: string
  threshold?: number
}

export function SwipeCard({
  children,
  onSwipeUp,
  onSwipeDown,
  onSwipeRight,
  onSwipeLeft,
  className = '',
  threshold = 100,
}: SwipeCardProps) {
  const { bind, springStyle, approveOpacity, skipOpacity, deleteOpacity } = useSwipeGesture({
    onSwipeUp,
    onSwipeDown,
    onSwipeRight,
    onSwipeLeft,
    threshold,
  })

  return (
    <animated.div
      {...bind()}
      style={{
        x: springStyle.x,
        y: springStyle.y,
        rotate: springStyle.rotate,
        opacity: springStyle.opacity,
        touchAction: 'none',
      }}
      className={`relative select-none cursor-grab active:cursor-grabbing ${className}`}
    >
      {/* APPROVE — top (swipe up) */}
      <animated.div
        style={{ opacity: approveOpacity }}
        className="absolute inset-0 z-10 rounded-xl bg-accent-sage/20 border-2 border-accent-sage
                   flex items-start justify-center pt-5 pointer-events-none"
      >
        <div className="flex items-center gap-2 bg-accent-sage text-white px-4 py-2 rounded-xl shadow-lg">
          <Check className="w-5 h-5" />
          <span className="font-semibold text-sm">Added to inventory</span>
        </div>
      </animated.div>

      {/* APPROVE — right swipe */}
      <animated.div
        style={{ opacity: approveOpacity }}
        className="absolute inset-0 z-10 rounded-xl bg-accent-sage/20 border-2 border-accent-sage
                   flex items-center justify-start pl-5 pointer-events-none"
      >
        <div className="flex items-center gap-2 bg-accent-sage text-white px-4 py-2 rounded-xl shadow-lg">
          <Check className="w-5 h-5" />
          <span className="font-semibold text-sm">Approve</span>
        </div>
      </animated.div>

      {/* SKIP — bottom (swipe down) */}
      <animated.div
        style={{ opacity: skipOpacity }}
        className="absolute inset-0 z-10 rounded-xl bg-kraft-300/30 border-2 border-kraft-400
                   flex items-end justify-center pb-5 pointer-events-none"
      >
        <div className="flex items-center gap-2 bg-kraft-600 text-white px-4 py-2 rounded-xl shadow-lg">
          <SkipForward className="w-5 h-5" />
          <span className="font-semibold text-sm">Skip</span>
        </div>
      </animated.div>

      {/* DELETE — left swipe */}
      <animated.div
        style={{ opacity: deleteOpacity }}
        className="absolute inset-0 z-10 rounded-xl bg-accent-rust/20 border-2 border-accent-rust
                   flex items-center justify-end pr-5 pointer-events-none"
      >
        <div className="flex items-center gap-2 bg-accent-rust text-white px-4 py-2 rounded-xl shadow-lg">
          <span className="font-semibold text-sm">Delete</span>
          <Trash2 className="w-5 h-5" />
        </div>
      </animated.div>

      {children}
    </animated.div>
  )
}
