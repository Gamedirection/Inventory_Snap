import React from 'react'
import { animated } from '@react-spring/web'
import { Check, SkipForward } from 'lucide-react'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

interface SwipeCardProps {
  children: React.ReactNode
  onSwipeUp?: () => void    // approve
  onSwipeDown?: () => void  // skip / reject
  className?: string
  threshold?: number
}

export function SwipeCard({
  children,
  onSwipeUp,
  onSwipeDown,
  className = '',
  threshold = 100,
}: SwipeCardProps) {
  const { bind, springStyle, approveOpacity, skipOpacity } = useSwipeGesture({
    onSwipeUp,
    onSwipeDown,
    threshold,
  })

  return (
    <animated.div
      {...bind()}
      style={{
        y: springStyle.y,
        opacity: springStyle.opacity,
        touchAction: 'none',
      }}
      className={`relative select-none cursor-grab active:cursor-grabbing ${className}`}
    >
      {/* Approve indicator — top (swipe up) */}
      <animated.div
        style={{ opacity: approveOpacity }}
        className="absolute inset-0 z-10 rounded-xl bg-accent-sage/20 border-2 border-accent-sage
                   flex items-start justify-center pt-6 pointer-events-none"
      >
        <div className="flex items-center gap-2 bg-accent-sage text-white px-4 py-2 rounded-xl shadow-lg">
          <Check className="w-5 h-5" />
          <span className="font-semibold text-sm">Approve</span>
        </div>
      </animated.div>

      {/* Skip indicator — bottom (swipe down) */}
      <animated.div
        style={{ opacity: skipOpacity }}
        className="absolute inset-0 z-10 rounded-xl bg-kraft-400/20 border-2 border-kraft-400
                   flex items-end justify-center pb-6 pointer-events-none"
      >
        <div className="flex items-center gap-2 bg-kraft-600 text-white px-4 py-2 rounded-xl shadow-lg">
          <SkipForward className="w-5 h-5" />
          <span className="font-semibold text-sm">Skip</span>
        </div>
      </animated.div>

      {children}
    </animated.div>
  )
}
