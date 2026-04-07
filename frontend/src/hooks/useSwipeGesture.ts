import { useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'

interface SwipeGestureOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 120,
}: SwipeGestureOptions) {
  const [{ x, rotate, opacity }, api] = useSpring(() => ({
    x: 0,
    rotate: 0,
    opacity: 1,
    config: { tension: 300, friction: 30 },
  }))

  // Direction indicator opacities
  const [{ approveOpacity, rejectOpacity }, indicatorApi] = useSpring(() => ({
    approveOpacity: 0,
    rejectOpacity: 0,
  }))

  const bind = useDrag(
    ({ active, movement: [mx], velocity: [vx], direction: [dx] }) => {
      const trigger = Math.abs(mx) > threshold || Math.abs(vx) > 0.5
      const goLeft  = mx < 0 && trigger
      const goRight = mx > 0 && trigger

      if (!active && goLeft) {
        api.start({ x: -window.innerWidth * 1.5, rotate: -20, opacity: 0 })
        onSwipeLeft?.()
      } else if (!active && goRight) {
        api.start({ x: window.innerWidth * 1.5, rotate: 20, opacity: 0 })
        onSwipeRight?.()
      } else if (!active) {
        // Snap back
        api.start({ x: 0, rotate: 0, opacity: 1 })
        indicatorApi.start({ approveOpacity: 0, rejectOpacity: 0 })
      } else {
        // Follow finger
        const rot = mx / 20
        api.start({ x: mx, rotate: rot, opacity: 1, immediate: true })
        const pct = Math.min(Math.abs(mx) / threshold, 1)
        indicatorApi.start({
          approveOpacity: mx > 20 ? pct : 0,
          rejectOpacity:  mx < -20 ? pct : 0,
          immediate: true,
        })
      }
    },
    { filterTaps: true, axis: 'x' }
  )

  return { bind, springStyle: { x, rotate, opacity }, approveOpacity, rejectOpacity }
}
