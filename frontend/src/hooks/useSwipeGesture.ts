import { useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'

export interface SwipeGestureOptions {
  /** Swipe up   — approve + advance */
  onSwipeUp?: () => void
  /** Swipe down — skip + advance */
  onSwipeDown?: () => void
  /** Swipe right — approve (same outcome as up) */
  onSwipeRight?: () => void
  /** Swipe left  — delete / hard-reject */
  onSwipeLeft?: () => void
  threshold?: number
}

export function useSwipeGesture({
  onSwipeUp,
  onSwipeDown,
  onSwipeRight,
  onSwipeLeft,
  threshold = 100,
}: SwipeGestureOptions) {
  const [{ x, y, rotate, opacity }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    opacity: 1,
    config: { tension: 300, friction: 30 },
  }))

  const [{ approveOpacity, skipOpacity, deleteOpacity }, indicatorApi] = useSpring(() => ({
    approveOpacity: 0,
    skipOpacity: 0,
    deleteOpacity: 0,
  }))

  const bind = useDrag(
    ({ active, movement: [mx, my], velocity: [vx, vy] }) => {
      const absMx = Math.abs(mx)
      const absMy = Math.abs(my)

      // Determine dominant axis
      const horizontal = absMx >= absMy

      const speedTrigger = horizontal ? Math.abs(vx) > 0.5 : Math.abs(vy) > 0.5
      const distTrigger  = horizontal ? absMx > threshold  : absMy > threshold
      const triggered    = speedTrigger || distTrigger

      const goRight = horizontal  && mx > 0  && triggered
      const goLeft  = horizontal  && mx < 0  && triggered
      const goUp    = !horizontal && my < 0  && triggered
      const goDown  = !horizontal && my > 0  && triggered

      if (!active) {
        if (goRight) {
          api.start({ x:  window.innerWidth  * 1.5, rotate:  15, opacity: 0 })
          onSwipeRight?.()
        } else if (goLeft) {
          api.start({ x: -window.innerWidth  * 1.5, rotate: -15, opacity: 0 })
          onSwipeLeft?.()
        } else if (goUp) {
          api.start({ y: -window.innerHeight * 1.5, opacity: 0 })
          onSwipeUp?.()
        } else if (goDown) {
          api.start({ y:  window.innerHeight * 1.5, opacity: 0 })
          onSwipeDown?.()
        } else {
          // snap back
          api.start({ x: 0, y: 0, rotate: 0, opacity: 1 })
          indicatorApi.start({ approveOpacity: 0, skipOpacity: 0, deleteOpacity: 0 })
        }
      } else {
        // follow finger
        const rot = horizontal ? mx / 20 : 0
        api.start({ x: mx, y: my, rotate: rot, opacity: 1, immediate: true })

        const dist = horizontal ? absMx : absMy
        const pct  = Math.min(dist / threshold, 1)

        const showApprove = (mx > 20 && horizontal) || (my < -20 && !horizontal)
        const showSkip    = my > 20 && !horizontal
        const showDelete  = mx < -20 && horizontal

        indicatorApi.start({
          approveOpacity: showApprove ? pct : 0,
          skipOpacity:    showSkip    ? pct : 0,
          deleteOpacity:  showDelete  ? pct : 0,
          immediate: true,
        })
      }
    },
    { filterTaps: true }   // free axis — direction determined by largest movement
  )

  return {
    bind,
    springStyle: { x, y, rotate, opacity },
    approveOpacity,
    skipOpacity,
    deleteOpacity,
  }
}
