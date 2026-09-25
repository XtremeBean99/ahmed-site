/**
 * Pure nearest-target selection for touch: a logical board point maps to the
 * nearest legal vertex or edge within 14 logical px, or the hex under the
 * finger for robber moves, or null.
 */

import { edgeEndpoints, edgePoint, hexAtPixel, hexCenter, vertexPoint } from '../board-layout'

export type TargetKind = 'setupSettlement' | 'setupRoad' | 'settlement' | 'city' | 'road' | 'robber'

export interface TargetShapes {
  kind: TargetKind | null
  vertices: number[]
  edges: number[]
  hexes: number[]
}

export interface NearestTarget {
  kind: 'vertex' | 'edge' | 'hex'
  id: number
}

const TOUCH_RADIUS = 14

function distanceSqToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / lenSq, 0), 1)
  const qx = ax + t * dx - px
  const qy = ay + t * dy - py
  return qx * qx + qy * qy
}

export function nearestTargetAt(p: { x: number; y: number }, targets: TargetShapes): NearestTarget | null {
  if (targets.kind === null) return null
  if (targets.kind === 'robber') {
    const hex = hexAtPixel(p.x, p.y)
    if (hex !== null && targets.hexes.includes(hex)) return { kind: 'hex', id: hex }
    return null
  }

  let best: NearestTarget | null = null
  let bestDist = TOUCH_RADIUS * TOUCH_RADIUS

  for (const vertex of targets.vertices) {
    const vp = vertexPoint(vertex)
    const dist = (p.x - vp.x) ** 2 + (p.y - vp.y) ** 2
    if (dist <= bestDist) {
      best = { kind: 'vertex', id: vertex }
      bestDist = dist
    }
  }

  for (const edge of targets.edges) {
    const [a, b] = edgeEndpoints(edge)
    const dist = distanceSqToSegment(p.x, p.y, a.x, a.y, b.x, b.y)
    // Prefer the vertex on ties: edges only win when strictly closer.
    if (dist < bestDist || (best === null && dist <= TOUCH_RADIUS * TOUCH_RADIUS)) {
      best = { kind: 'edge', id: edge }
      bestDist = dist
    }
  }

  return best
}

/** Logical board point of a selected target, for floating touch buttons. */
export function targetPoint(selection: NearestTarget): { x: number; y: number } {
  if (selection.kind === 'vertex') return vertexPoint(selection.id)
  if (selection.kind === 'edge') return edgePoint(selection.id)
  return hexCenter(selection.id)
}
