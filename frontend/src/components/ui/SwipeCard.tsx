import React from 'react'
import { animated } from '@react-spring/web'
import { Check, X } from 'lucide-react'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

interface SwipeCardProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  className?: string
  threshold?: number
}

export function SwipeCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  className = '',
  threshold = 120,
}: SwipeCardProps) {
  const { bind, springStyle, approveOpacity, rejectOpacity } = useSwipeGesture({
    onSwipeLeft,
    onSwipeRight,
    threshold,
  })

  return (
    <animated.div
      {...bind()}
      style={{
        x: springStyle.x,
        rotate: springStyle.rotate,
        opacity: springStyle.opacity,
        touchAction: 'none',
      }}
      className={`relative select-none cursor-grab active:cursor-grabbing ${className}`}
    >
      {/* Approve indicator (right swipe) */}
      <animated.div
        style={{ opacity: approveOpacity }}
        className="absolute inset-0 z-10 rounded-xl bg-accent-sage/20 border-2 border-accent-sage
                   flex items-center justify-start pl-6 pointer-events-none"
      >
        <div className="flex items-center gap-2 bg-accent-sage text-white px-3 py-2 rounded-lg">
          <Check className="w-5 h-5" />
          <span className="font-semibold text-sm">Approve</span>
        </div>
      </animated.div>

      {/* Reject indicator (left swipe) */}
      <animated.div
        style={{ opacity: rejectOpacity }}
        className="absolute inset-0 z-10 rounded-xl bg-accent-rust/20 border-2 border-accent-rust
                   flex items-center justify-end pr-6 pointer-events-none"
      >
        <div className="flex items-center gap-2 bg-accent-rust text-white px-3 py-2 rounded-lg">
          <span className="font-semibold text-sm">Reject</span>
          <X className="w-5 h-5" />
        </div>
      </animated.div>

      {children}
    </animated.div>
  )
}
