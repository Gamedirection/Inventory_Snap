import { useSpring } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'

interface SwipeGestureOptions {
  onSwipeUp?: () => void    // approve
  onSwipeDown?: () => void  // skip / reject
  threshold?: number
}

export function useSwipeGesture({
  onSwipeUp,
  onSwipeDown,
  threshold = 100,
}: SwipeGestureOptions) {
  const [{ y, opacity }, api] = useSpring(() => ({
    y: 0,
    opacity: 1,
    config: { tension: 300, friction: 30 },
  }))

  const [{ approveOpacity, skipOpacity }, indicatorApi] = useSpring(() => ({
    approveOpacity: 0,
    skipOpacity: 0,
  }))

  const bind = useDrag(
    ({ active, movement: [, my], velocity: [, vy] }) => {
      const trigger = Math.abs(my) > threshold || Math.abs(vy) > 0.5
      const goUp   = my < 0 && trigger   // swipe up   = approve
      const goDown = my > 0 && trigger   // swipe down = skip

      if (!active && goUp) {
        api.start({ y: -window.innerHeight * 1.5, opacity: 0 })
        onSwipeUp?.()
      } else if (!active && goDown) {
        api.start({ y: window.innerHeight * 1.5, opacity: 0 })
        onSwipeDown?.()
      } else if (!active) {
        // Snap back
        api.start({ y: 0, opacity: 1 })
        indicatorApi.start({ approveOpacity: 0, skipOpacity: 0 })
      } else {
        // Follow finger
        api.start({ y: my, opacity: 1, immediate: true })
        const pct = Math.min(Math.abs(my) / threshold, 1)
        indicatorApi.start({
          approveOpacity: my < -20 ? pct : 0,
          skipOpacity:    my > 20  ? pct : 0,
          immediate: true,
        })
      }
    },
    { filterTaps: true, axis: 'y' }
  )

  return { bind, springStyle: { y, opacity }, approveOpacity, skipOpacity }
}
