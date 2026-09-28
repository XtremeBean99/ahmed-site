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

/**
 * Every grid cell on the straight line from (x0, y0) to (x1, y1), both ends
 * included (Bresenham), so a fast stroke between two pointer samples has no gaps.
 */
export function lineCells(x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    cells.push({ x, y })
    if (x === x1 && y === y1) return cells
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
}
