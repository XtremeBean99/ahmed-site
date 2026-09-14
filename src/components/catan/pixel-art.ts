/**
 * Pure rasteriser for the Catan board. Everything draws into an
 * ImageData-like buffer ({ width, height, data: Uint8ClampedArray }) so the
 * whole board can be rendered and unit-tested without a DOM. All output is
 * deterministic: no randomness, no Date, only integer hashing.
 */

import { pips } from '@/lib/games/catan/constants'
import { HEXES } from '@/lib/games/catan/geometry'
import type { GameState, PlayerColor, PortType, Resource, Terrain } from '@/lib/games/catan/types'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  edgeEndpoints,
  hexCenter,
  hexAtPixel,
  vertexPoint,
} from './board-layout'

export type RGB = readonly [number, number, number]

export interface PixelBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface TargetShapes {
  vertices: number[]
  edges: number[]
  hexes: number[]
}

export interface GhostPiece {
  kind: 'settlement' | 'city' | 'road' | 'robber'
  vertex?: number
  edge?: number
  hex?: number
  color: PlayerColor
}

export const PLAYER_COLORS: Record<PlayerColor, RGB> = {
  red: [192, 57, 43],
  blue: [46, 111, 183],
  white: [232, 224, 208],
  orange: [224, 123, 42],
}

const OUTLINE: RGB = [26, 20, 16]
const INK: RGB = [42, 34, 32]
const AMBER: RGB = [224, 160, 64]
const TOKEN_CREAM: RGB = [243, 230, 196]
const TOKEN_RED: RGB = [176, 48, 42]
const PIER: RGB = [128, 90, 54]
const PIER_DARK: RGB = [84, 58, 34]
const SEA_BASE: RGB = [47, 93, 124]
const SEA_DARK: RGB = [36, 74, 99]
const COAST: RGB = [26, 20, 16]

const TERRAIN_BASE: Record<Terrain, RGB> = {
  lumber: [63, 107, 58],
  wool: [143, 184, 90],
  grain: [217, 180, 74],
  brick: [176, 88, 58],
  ore: [124, 127, 138],
  desert: [216, 192, 138],
}

const TERRAIN_DARK: Record<Terrain, RGB> = {
  lumber: [44, 79, 41],
  wool: [111, 154, 66],
  grain: [176, 138, 46],
  brick: [138, 64, 40],
  ore: [90, 93, 104],
  desert: [184, 156, 98],
}

const TERRAIN_SEED: Record<Terrain, number> = {
  lumber: 1,
  wool: 2,
  grain: 3,
  brick: 4,
  ore: 5,
  desert: 6,
}

export function createBuffer(width: number, height: number): PixelBuffer {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) }
}

export function clearBuffer(buffer: PixelBuffer): void {
  buffer.data.fill(0)
}

function hash3(x: number, y: number, seed: number): number {
  let h = seed | 0
  h = Math.imul(h ^ x, 2654435761)
  h = Math.imul(h ^ y, 1597334677)
  h = (h ^ (h >>> 13)) >>> 0
  return h
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

function setPixel(buffer: PixelBuffer, x: number, y: number, color: RGB, alpha = 255): void {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return
  const i = (y * buffer.width + x) * 4
  buffer.data[i] = color[0]
  buffer.data[i + 1] = color[1]
  buffer.data[i + 2] = color[2]
  buffer.data[i + 3] = alpha
}

// --- Small deterministic textures -------------------------------------------------

function seaColor(x: number, y: number): RGB {
  return hash3(x, y, 99) % 11 === 0 ? SEA_DARK : SEA_BASE
}

function terrainColor(terrain: Terrain, x: number, y: number): RGB {
  const h = hash3(x, y, TERRAIN_SEED[terrain])
  switch (terrain) {
    case 'lumber': {
      // Scattered 2x3 dark tree marks on a 6x7 anchor grid.
      const cellX = Math.floor(x / 6)
      const cellY = Math.floor(y / 7)
      const lx = x - cellX * 6
      const ly = y - cellY * 7
      if (hash3(cellX, cellY, 71) % 3 === 0 && lx < 2 && ly < 3) return TERRAIN_DARK.lumber
      return TERRAIN_BASE.lumber
    }
    case 'wool': {
      if (h % 13 === 0) return TERRAIN_DARK.wool
      if (h % 29 === 0) return mix(TERRAIN_BASE.wool, [232, 213, 176], 0.5)
      return TERRAIN_BASE.wool
    }
    case 'grain': {
      if ((x + y) % 8 < 2 || h % 17 === 0) return TERRAIN_DARK.grain
      return TERRAIN_BASE.grain
    }
    case 'brick': {
      const course = Math.floor(y / 4)
      const row = y - course * 4
      const offset = (course % 2) * 4
      if (row === 0) return TERRAIN_DARK.brick
      if (((x - offset) % 8 + 8) % 8 === 0) return TERRAIN_DARK.brick
      if (h % 19 === 0) return TERRAIN_DARK.brick
      return TERRAIN_BASE.brick
    }
    case 'ore': {
      if (h % 7 === 0 || (x + 2 * y) % 11 === 0) return TERRAIN_DARK.ore
      if (h % 23 === 0) return mix(TERRAIN_BASE.ore, [168, 171, 184], 0.4)
      return TERRAIN_BASE.ore
    }
    case 'desert': {
      if (h % 7 === 0) return TERRAIN_DARK.desert
      if (h % 17 === 0) return mix(TERRAIN_BASE.desert, [242, 224, 176], 0.5)
      return TERRAIN_BASE.desert
    }
  }
}

// --- Raster primitives ------------------------------------------------------------

function brush(buffer: PixelBuffer, x: number, y: number, radius: number, color: RGB): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) setPixel(buffer, x + dx, y + dy, color)
  }
}

function drawLine(buffer: PixelBuffer, a: { x: number; y: number }, b: { x: number; y: number }, color: RGB, radius: number): void {
  let x0 = Math.round(a.x)
  let y0 = Math.round(a.y)
  const x1 = Math.round(b.x)
  const y1 = Math.round(b.y)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    brush(buffer, x0, y0, radius, color)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}

/** Bresenham line whose 1px brush is only placed on every other step (ghost road). */
function drawDitheredLine(buffer: PixelBuffer, a: { x: number; y: number }, b: { x: number; y: number }, color: RGB): void {
  let x0 = Math.round(a.x)
  let y0 = Math.round(a.y)
  const x1 = Math.round(b.x)
  const y1 = Math.round(b.y)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    if (((x0 + y0) & 1) === 0) setPixel(buffer, x0, y0, color)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}

function drawRectFill(buffer: PixelBuffer, x0: number, y0: number, w: number, h: number, color: RGB): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPixel(buffer, x, y, color)
  }
}

function drawRectOutline(buffer: PixelBuffer, x0: number, y0: number, w: number, h: number, color: RGB): void {
  for (let x = x0; x < x0 + w; x++) {
    setPixel(buffer, x, y0, color)
    setPixel(buffer, x, y0 + h - 1, color)
  }
  for (let y = y0; y < y0 + h; y++) {
    setPixel(buffer, x0, y, color)
    setPixel(buffer, x0 + w - 1, y, color)
  }
}

function drawSquareOutline(buffer: PixelBuffer, center: { x: number; y: number }, size: number, color: RGB): void {
  const half = Math.floor(size / 2)
  for (let i = -half; i <= half; i++) {
    setPixel(buffer, center.x + i, center.y - half, color)
    setPixel(buffer, center.x + i, center.y + half, color)
    setPixel(buffer, center.x - half, center.y + i, color)
    setPixel(buffer, center.x + half, center.y + i, color)
  }
}

// --- 3x5 pixel font ---------------------------------------------------------------

const FONT_3X5: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ':': ['000', '010', '000', '010', '000'],
}

function textWidth(text: string): number {
  return text.length * 4 - 1
}

function drawText(buffer: PixelBuffer, x: number, y: number, text: string, color: RGB): void {
  let cursor = x
  for (const ch of text) {
    const glyph = FONT_3X5[ch]
    if (glyph) {
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 3; gx++) {
          if (glyph[gy][gx] === '1') setPixel(buffer, cursor + gx, y + gy, color)
        }
      }
    }
    cursor += 4
  }
}

// --- Sprites -----------------------------------------------------------------------

export const SETTLEMENT_SIZE = { w: 9, h: 9 } as const
export const CITY_SIZE = { w: 13, h: 11 } as const

const SETTLEMENT_SPRITE = [
  '..OOOOO..',
  '.OHHHHHO.',
  'OHPPPPPHO',
  'OHPPWPPHO',
  'OPPPPPPPO',
  'OPPWPWPPO',
  'OPPWPWPPO',
  'OPPPPPPPO',
  '.OOOOOOO.',
]

const CITY_SPRITE = [
  '....OOOOO....',
  '...OHHHHHO...',
  '..OHPPPPPHO..',
  '..OPPPPPPPO..',
  '.OPWWPPPWWPO.',
  '.OPPPPPPPPPO.',
  '.OPWWPPPWWPO.',
  '.OPPPPPPPPPO.',
  '.OPWWPPPWWPO.',
  '.OPPPPPPPPPO.',
  '..OOOOOOOOO..',
]

const ROBBER_SPRITE = [
  '..OOO..',
  '.OGGGO.',
  'OGGGGGO',
  'OGHGGGO',
  'OGGGGGO',
  'OGGEGGO',
  'OGGEGGO',
  '.OGGGO.',
  '.OGGGO.',
  '.OOOOO.',
]

function playerPalette(color: RGB): Record<string, RGB> {
  return {
    O: OUTLINE,
    P: color,
    H: mix(color, [255, 255, 255], 0.4),
    R: mix(color, [0, 0, 0], 0.55),
    W: TOKEN_CREAM,
  }
}

const ROBBER_PALETTE: Record<string, RGB> = {
  O: OUTLINE,
  G: [58, 58, 66],
  H: [138, 138, 148],
  E: [192, 80, 58],
}

function drawSprite(
  buffer: PixelBuffer,
  sprite: string[],
  center: { x: number; y: number },
  palette: Record<string, RGB>,
  dither = false,
): void {
  const h = sprite.length
  const w = sprite[0].length
  const x0 = Math.round(center.x - (w - 1) / 2)
  const y0 = Math.round(center.y - (h - 1) / 2)
  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const ch = sprite[sy][sx]
      if (ch === '.' || ch === ' ') continue
      if (dither && ((sx + sy) & 1) !== 0) continue
      const color = palette[ch]
      if (color) setPixel(buffer, x0 + sx, y0 + sy, color)
    }
  }
}

// --- Board pieces -------------------------------------------------------------------

function drawRoad(buffer: PixelBuffer, edge: number, color: RGB): void {
  const [a, b] = edgeEndpoints(edge)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  const p1 = { x: Math.round(a.x + ux * 3), y: Math.round(a.y + uy * 3) }
  const p2 = { x: Math.round(b.x - ux * 3), y: Math.round(b.y - uy * 3) }
  drawLine(buffer, p1, p2, OUTLINE, 2)
  drawLine(buffer, p1, p2, color, 1)
}

function drawSettlement(buffer: PixelBuffer, vertex: number, color: RGB): void {
  drawSprite(buffer, SETTLEMENT_SPRITE, vertexPoint(vertex), playerPalette(color))
}

function drawCity(buffer: PixelBuffer, vertex: number, color: RGB): void {
  drawSprite(buffer, CITY_SPRITE, vertexPoint(vertex), playerPalette(color))
}

function drawRobber(buffer: PixelBuffer, hex: number): void {
  drawSprite(buffer, ROBBER_SPRITE, hexCenter(hex), ROBBER_PALETTE)
}

function drawNumberToken(buffer: PixelBuffer, hex: number, number: number): void {
  const c = hexCenter(hex)
  const x0 = c.x - 5
  const y0 = c.y - 5
  for (let y = 0; y < 11; y++) {
    for (let x = 0; x < 11; x++) {
      const dist = Math.hypot(x - 5, y - 5)
      if (dist <= 5) setPixel(buffer, x0 + x, y0 + y, TOKEN_CREAM)
      else if (dist <= 6) setPixel(buffer, x0 + x, y0 + y, INK)
    }
  }
  const text = String(number)
  const color = number === 6 || number === 8 ? TOKEN_RED : INK
  drawText(buffer, c.x - Math.floor(textWidth(text) / 2), c.y - 3, text, color)
  const dots = pips(number)
  if (dots > 0) {
    const rowW = dots * 2 - 1
    const startX = c.x - Math.floor(rowW / 2)
    for (let i = 0; i < dots; i++) setPixel(buffer, startX + i * 2, c.y + 3, INK)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

const HARBOR_LABEL_OFFSET = 28
const HARBOR_LABEL_HEIGHT = 11

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Pixel rect of a harbour label plate, placed seaward along the edge normal. */
export function harborPlateRect(edge: number, type: PortType): Rect {
  const [a, b] = edgeEndpoints(edge)
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const cx = (BOARD_WIDTH - 1) / 2
  const cy = (BOARD_HEIGHT - 1) / 2
  let dx = mx - cx
  let dy = my - cy
  const len = Math.hypot(dx, dy)
  if (len < 1) {
    dx = 0
    dy = -1
  } else {
    dx /= len
    dy /= len
  }

  const isAny = type === 'any'
  const text = isAny ? '3:1' : '2:1'
  const swatchW = isAny ? 0 : 5
  const gap = isAny ? 0 : 2
  const width = 2 + textWidth(text) + gap + swatchW + 2
  const x = clamp(Math.round(mx + dx * HARBOR_LABEL_OFFSET - width / 2), 1, BOARD_WIDTH - width - 1)
  const y = clamp(Math.round(my + dy * HARBOR_LABEL_OFFSET - HARBOR_LABEL_HEIGHT / 2), 1, BOARD_HEIGHT - HARBOR_LABEL_HEIGHT - 1)
  return { x, y, width, height: HARBOR_LABEL_HEIGHT }
}

function drawHarbor(buffer: PixelBuffer, edge: number, type: PortType): void {
  const [a, b] = edgeEndpoints(edge)
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const cx = (BOARD_WIDTH - 1) / 2
  const cy = (BOARD_HEIGHT - 1) / 2
  let dx = mx - cx
  let dy = my - cy
  const len = Math.hypot(dx, dy)
  if (len < 1) {
    dx = 0
    dy = -1
  } else {
    dx /= len
    dy /= len
  }

  // Pier: a plank line along the coastal edge, pushed just out to sea.
  const p1 = { x: Math.round(a.x + dx * 2), y: Math.round(a.y + dy * 2) }
  const p2 = { x: Math.round(b.x + dx * 2), y: Math.round(b.y + dy * 2) }
  drawLine(buffer, p1, p2, PIER_DARK, 1)
  drawLine(buffer, p1, p2, PIER, 0)

  // Label plate, placed further out to sea so it never covers corner pieces.
  const plate = harborPlateRect(edge, type)
  const isAny = type === 'any'
  const text = isAny ? '3:1' : '2:1'
  drawRectFill(buffer, plate.x, plate.y, plate.width, plate.height, INK)
  drawRectOutline(buffer, plate.x, plate.y, plate.width, plate.height, OUTLINE)
  drawText(buffer, plate.x + 2, plate.y + Math.floor((plate.height - 5) / 2), text, TOKEN_CREAM)
  if (!isAny) {
    const resource = type as Resource
    const swatchSize = 5
    const swatch: RGB = TERRAIN_BASE[resource]
    const sx = plate.x + 2 + textWidth(text) + 2
    const sy = plate.y + Math.floor((plate.height - swatchSize) / 2)
    for (let y = 0; y < swatchSize; y++) {
      for (let x = 0; x < swatchSize; x++) setPixel(buffer, sx + x, sy + y, swatch)
    }
    drawRectOutline(buffer, sx, sy, swatchSize, swatchSize, OUTLINE)
    setPixel(buffer, sx + 1, sy + 1, TERRAIN_DARK[resource])
    setPixel(buffer, sx + 3, sy + 3, TERRAIN_DARK[resource])
  }
}

// --- Terrain pass -------------------------------------------------------------------

function drawTerrain(buffer: PixelBuffer, state: GameState): void {
  const { width, height } = buffer
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hex = hexAtPixel(x, y)
      if (hex === null) {
        setPixel(buffer, x, y, seaColor(x, y))
        continue
      }
      const terrain = state.tiles[hex].terrain
      setPixel(buffer, x, y, terrainColor(terrain, x, y))
      const right = x + 1 < width ? hexAtPixel(x + 1, y) : null
      const down = y + 1 < height ? hexAtPixel(x, y + 1) : null
      const left = x > 0 ? hexAtPixel(x - 1, y) : null
      const up = y > 0 ? hexAtPixel(x, y - 1) : null
      if (right === null || down === null || left === null || up === null) {
        setPixel(buffer, x, y, COAST)
      } else if (right !== hex || down !== hex) {
        setPixel(buffer, x, y, TERRAIN_DARK[terrain])
      }
    }
  }
}

// --- Public drawing functions --------------------------------------------------------

export function drawBoard(buffer: PixelBuffer, state: GameState): void {
  drawTerrain(buffer, state)
  for (let h = 0; h < HEXES.length; h++) {
    const number = state.tiles[h].number
    if (number !== null) drawNumberToken(buffer, h, number)
  }
  for (const port of state.ports) drawHarbor(buffer, port.edge, port.type)
  for (let e = 0; e < state.roads.length; e++) {
    const owner = state.roads[e]
    if (owner !== null) drawRoad(buffer, e, PLAYER_COLORS[state.players[owner].color])
  }
  for (let v = 0; v < state.buildings.length; v++) {
    const building = state.buildings[v]
    if (building === null) continue
    const color = PLAYER_COLORS[state.players[building.owner].color]
    if (building.kind === 'city') drawCity(buffer, v, color)
    else drawSettlement(buffer, v, color)
  }
  drawRobber(buffer, state.robber)
}

export function drawTargets(buffer: PixelBuffer, targets: TargetShapes): void {
  for (const vertex of targets.vertices) drawSquareOutline(buffer, vertexPoint(vertex), 5, AMBER)
  for (const edge of targets.edges) {
    const [a, b] = edgeEndpoints(edge)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 1) continue
    const ux = dx / len
    const uy = dy / len
    const p1 = { x: Math.round(a.x + ux * 4), y: Math.round(a.y + uy * 4) }
    const p2 = { x: Math.round(b.x - ux * 4), y: Math.round(b.y - uy * 4) }
    drawLine(buffer, p1, p2, AMBER, 0)
  }
  for (const hex of targets.hexes) {
    const vertices = HEXES[hex].vertices
    for (let i = 0; i < 6; i++) {
      drawLine(buffer, vertexPoint(vertices[i]), vertexPoint(vertices[(i + 1) % 6]), AMBER, 0)
    }
  }
}

export function drawLastPlaced(buffer: PixelBuffer, state: GameState, lastPlaced: { kind: 'vertex' | 'edge'; id: number }): void {
  if (lastPlaced.kind === 'vertex') {
    const building = state.buildings[lastPlaced.id]
    if (building === null) return
    const center = vertexPoint(lastPlaced.id)
    const size = building.kind === 'city' ? CITY_SIZE : SETTLEMENT_SIZE
    const x0 = Math.round(center.x - (size.w - 1) / 2) - 1
    const y0 = Math.round(center.y - (size.h - 1) / 2) - 1
    drawRectOutline(buffer, x0, y0, size.w + 2, size.h + 2, AMBER)
    return
  }
  const owner = state.roads[lastPlaced.id]
  if (owner === null) return
  const [a, b] = edgeEndpoints(lastPlaced.id)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  const p1 = { x: Math.round(a.x + ux * 3), y: Math.round(a.y + uy * 3) }
  const p2 = { x: Math.round(b.x - ux * 3), y: Math.round(b.y - uy * 3) }
  drawLine(buffer, p1, p2, AMBER, 2)
  drawLine(buffer, p1, p2, PLAYER_COLORS[state.players[owner].color], 1)
}

export function drawGhost(buffer: PixelBuffer, ghost: GhostPiece): void {
  const color = PLAYER_COLORS[ghost.color]
  if (ghost.kind === 'settlement' && ghost.vertex !== undefined) {
    drawSprite(buffer, SETTLEMENT_SPRITE, vertexPoint(ghost.vertex), playerPalette(color), true)
  } else if (ghost.kind === 'city' && ghost.vertex !== undefined) {
    drawSprite(buffer, CITY_SPRITE, vertexPoint(ghost.vertex), playerPalette(color), true)
  } else if (ghost.kind === 'road' && ghost.edge !== undefined) {
    const [a, b] = edgeEndpoints(ghost.edge)
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 1) return
    const ux = dx / len
    const uy = dy / len
    const p1 = { x: Math.round(a.x + ux * 3), y: Math.round(a.y + uy * 3) }
    const p2 = { x: Math.round(b.x - ux * 3), y: Math.round(b.y - uy * 3) }
    drawDitheredLine(buffer, p1, p2, color)
  } else if (ghost.kind === 'robber' && ghost.hex !== undefined) {
    drawSprite(buffer, ROBBER_SPRITE, hexCenter(ghost.hex), ROBBER_PALETTE, true)
  }
}
