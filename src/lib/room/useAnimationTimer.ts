import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Shared timer lifecycle for room animations (Monitor highlight/loading and
 * AnimatedSprite frame sequences). Manages the interval ref, tick state, and
 * unmount cleanup; callers supply a custom step function that advances the
 * tick each interval.
 */
export function useAnimationTimer(frameMs: number, reduce: boolean | null) {
  const [tick, setTick] = useState(0)
  const tickRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Store reduce in a ref so start/stop don't re-create when reduce
  // flips null→false during hydration — avoids racing hover callbacks.
  const reduceRef = useRef(reduce)
  reduceRef.current = reduce

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    clearTimer()
    tickRef.current = 0
    setTick(0)
  }, [clearTimer])

  const advanceTo = useCallback((n: number) => {
    tickRef.current = n
    setTick(n)
  }, [])

  /** Start stepping. `stepFn` runs every `frameMs`. */
  const start = useCallback(
    (stepFn: () => void) => {
      if (reduceRef.current) return
      clearTimer()
      advanceTo(0)
      timerRef.current = setInterval(stepFn, frameMs)
    },
    [frameMs, clearTimer, advanceTo],
  )

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  return { tick, tickRef, timerRef, advanceTo, clearTimer, start, stop } as const
}
