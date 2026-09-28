// src/lib/room/gestures.ts
/**
 * Pure pointer-gesture helpers for the room apps. No DOM, no React.
 * Screen coordinates: positive dy is down.
 */

export type SwipeDir = 'up' | 'down' | 'left' | 'right'

/**
 * The dominant axis wins. Null when the longer side is shorter than `minDist`,
 * or when both sides are exactly equal (no meaningful direction).
 */
export function swipeDirection(dx: number, dy: number, minDist = 24): SwipeDir | null {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax === ay) return null
  const longer = Math.max(ax, ay)
  if (longer < minDist) return null
  if (ax > ay) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}
