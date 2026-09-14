/**
 * Pure pixel-space layout for the Catan board. No DOM, no drawing: it turns
 * geometry.ts unit coordinates into integer logical pixel coordinates and
 * answers "which hex is under this pixel?" for the rasteriser.
 *
 * The board is pointy-top, centred on 0,0 in hex-size units. We scale by the
 * hex circumradius in pixels and place the island in the middle of a canvas
 * with a sea border of about one full hex (2R) on every side so harbours fit.
 */

import { HEXES, VERTICES, EDGES } from '@/lib/games/catan/geometry'

export interface Point {
  x: number
  y: number
}

/** Logical hex circumradius in pixels. */
export const HEX_RADIUS = 22

/** Logical canvas size: island vertex span (191 x 176 px) plus a 2R sea border. */
export const BOARD_WIDTH = 280
export const BOARD_HEIGHT = 265

/**
 * Pixel position of the unit origin (the board centre). X is half-way between
 * pixel columns so the island is horizontally symmetric; Y is the exact centre
 * column.
 */
export const ORIGIN_X = (BOARD_WIDTH - 1) / 2
export const ORIGIN_Y = (BOARD_HEIGHT - 1) / 2

const SQRT3 = Math.sqrt(3)
const AXIAL_BY_ID = new Map<string, number>(HEXES.map((h) => [`${h.q},${h.r}`, h.id]))

function unitToPixelX(x: number): number {
  return Math.round(ORIGIN_X + x * HEX_RADIUS)
}

function unitToPixelY(y: number): number {
  return Math.round(ORIGIN_Y + y * HEX_RADIUS)
}

function pixelToUnitX(px: number): number {
  return (px - ORIGIN_X) / HEX_RADIUS
}

function pixelToUnitY(py: number): number {
  return (py - ORIGIN_Y) / HEX_RADIUS
}

export function hexCenter(hex: number): Point {
  const h = HEXES[hex]
  return { x: unitToPixelX(h.x), y: unitToPixelY(h.y) }
}

export function vertexPoint(vertex: number): Point {
  const v = VERTICES[vertex]
  return { x: unitToPixelX(v.x), y: unitToPixelY(v.y) }
}

export function edgeEndpoints(edge: number): [Point, Point] {
  const e = EDGES[edge]
  return [vertexPoint(e.vertices[0]), vertexPoint(e.vertices[1])]
}

/** Integer midpoint of an edge, used for edge markers. */
export function edgePoint(edge: number): Point {
  const e = EDGES[edge]
  return { x: unitToPixelX(e.x), y: unitToPixelY(e.y) }
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
 * Hex id under a logical pixel, or null for the sea. Uses axial hex rounding,
 * so every pixel belongs to exactly one hex of the infinite grid; pixels whose
 * rounded hex is not one of the 19 island hexes are sea.
 */
export function hexAtPixel(px: number, py: number): number | null {
  const x = pixelToUnitX(px)
  const y = pixelToUnitY(py)
  // Pointy-top axial conversion (x = sqrt3*(q + r/2), y = 3/2*r).
  const q = (SQRT3 / 3) * x - (1 / 3) * y
  const r = (2 / 3) * y
  const rounded = axialRound(q, r)
  return AXIAL_BY_ID.get(`${rounded.q},${rounded.r}`) ?? null
}

/** All logical points are inside the canvas. */
export function isInsideBoard(p: Point): boolean {
  return p.x >= 0 && p.x < BOARD_WIDTH && p.y >= 0 && p.y < BOARD_HEIGHT
}
