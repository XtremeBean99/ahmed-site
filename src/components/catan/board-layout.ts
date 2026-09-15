/**
 * Pure pixel-space layout for the Catan board. No DOM, no drawing: it turns
 * geometry.ts unit coordinates into integer logical pixel coordinates and
 * answers "which hex is under this pixel?" for the rasteriser.
 *
 * The lattice is integer-exact so every island hex rasterises to the same
 * pixel mask: centre (q, r) sits at (ORIGIN_X + 38q + 19r, ORIGIN_Y + 33r)
 * and the six corners are the fixed integer offsets below.
 */

import { HEXES, VERTICES, EDGES } from '@/lib/games/catan/geometry'

export interface Point {
  x: number
  y: number
}

/** Logical hex circumradius in pixels (kept for callers that scale by it). */
export const HEX_RADIUS = 22

/** Logical canvas size: island vertex span plus a 44 px sea border on all sides. */
export const BOARD_WIDTH = 279
export const BOARD_HEIGHT = 265

/** Pixel position of the axial origin (hex 0,0), the board centre. */
export const ORIGIN_X = 139
export const ORIGIN_Y = 132

/** Corner offsets from a hex centre, in geometry.ts corner order. */
export const CORNER_OFFSETS: readonly Point[] = [
  { x: 19, y: -11 },
  { x: 19, y: 11 },
  { x: 0, y: 22 },
  { x: -19, y: 11 },
  { x: -19, y: -11 },
  { x: 0, y: -22 },
]

const AXIAL_BY_ID = new Map<string, number>(HEXES.map((h) => [`${h.q},${h.r}`, h.id]))

export function hexCenter(hex: number): Point {
  const h = HEXES[hex]
  return { x: ORIGIN_X + 38 * h.q + 19 * h.r, y: ORIGIN_Y + 33 * h.r }
}

export function vertexPoint(vertex: number): Point {
  const v = VERTICES[vertex]
  const h = HEXES[v.hexes[0]]
  const corner = h.vertices.indexOf(vertex)
  const c = hexCenter(h.id)
  return { x: c.x + CORNER_OFFSETS[corner].x, y: c.y + CORNER_OFFSETS[corner].y }
}

export function edgeEndpoints(edge: number): [Point, Point] {
  const e = EDGES[edge]
  return [vertexPoint(e.vertices[0]), vertexPoint(e.vertices[1])]
}

/** Integer midpoint of an edge (the average rounded down), used for road sprites and markers. */
export function edgePoint(edge: number): Point {
  const e = EDGES[edge]
  const [a, b] = edgeEndpoints(e.id)
  return { x: Math.floor((a.x + b.x) / 2), y: Math.floor((a.y + b.y) / 2) }
}

function axialRound(q: number, r: number): { q: number; r: number } {
  const cx = q
  const cz = r
  const cy = -cx - cz
  let rx = Math.round(cx)
  let ry = Math.round(cy)
  let rz = Math.round(cz)
  const dx = Math.abs(rx - cx)
  const dy = Math.abs(ry - cy)
  const dz = Math.abs(rz - cz)
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy > dz) ry = -rx - rz
  else rz = -rx - ry
  return { q: rx, r: rz }
}

/**
 * Hex id under a logical pixel, or null for the sea. Finds the nearest lattice
 * centre by squared pixel distance; exact ties are broken by comparing the
 * pixel's offset relative to each candidate centre (translation-invariant),
 * so every island hex owns the identical pixel mask.
 */
export function hexAtPixel(px: number, py: number): number | null {
  const fr = (py - ORIGIN_Y) / 33
  const fq = (px - ORIGIN_X - 19 * fr) / 38
  const base = axialRound(fq, fr)
  let bestQ = 0
  let bestR = 0
  let bestDist = Infinity
  let bestDx = 0
  let bestDy = 0
  for (let dq = base.q - 2; dq <= base.q + 2; dq++) {
    for (let dr = base.r - 2; dr <= base.r + 2; dr++) {
      const cx = ORIGIN_X + 38 * dq + 19 * dr
      const cy = ORIGIN_Y + 33 * dr
      const dx = px - cx
      const dy = py - cy
      const dist = dx * dx + dy * dy
      if (dist < bestDist || (dist === bestDist && (dx < bestDx || (dx === bestDx && dy < bestDy)))) {
        bestDist = dist
        bestDx = dx
        bestDy = dy
        bestQ = dq
        bestR = dr
      }
    }
  }
  return AXIAL_BY_ID.get(`${bestQ},${bestR}`) ?? null
}

/** All logical points are inside the canvas. */
export function isInsideBoard(p: Point): boolean {
  return p.x >= 0 && p.x < BOARD_WIDTH && p.y >= 0 && p.y < BOARD_HEIGHT
}
