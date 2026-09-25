/**
 * Pure rasteriser for the Catan board. Everything draws into an
 * ImageData-like buffer ({ width, height, data: Uint8ClampedArray }) so the
 * whole board can be rendered and unit-tested without a DOM. All output is
 * deterministic: no randomness, no Date, only integer hashing.
 *
 * The board is composed from the sprite manifest (sprites.ts): each sprite is
 * rendered procedurally here (also used to export the PNG templates) and, when
 * a SpriteSet is provided, the same composition reads the sprite pixels from
 * the provided buffers instead.
 */

import { pips } from '@/lib/games/catan/constants'
import { COASTAL_EDGES, HEXES } from '@/lib/games/catan/geometry'
import type { GameState, PlayerColor, PortType, Resource, Terrain } from '@/lib/games/catan/types'
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  ORIGIN_X,
  ORIGIN_Y,
  edgeEndpoints,
  edgePoint,
  hexCenter,
  hexAtPixel,
  vertexPoint,
} from './board-layout'
import { SPRITES, TILE_SPRITES } from './sprites'
import type { SpriteMeta, SpriteName } from './sprites'

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

export type SpriteSet = Partial<Record<SpriteName, PixelBuffer>>

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
const SEA_LIGHT: RGB = [62, 118, 152]
const COAST: RGB = [26, 20, 16]
const FOAM: RGB = [207, 227, 234]

/** Player-colour key: base, highlight and shade are replaced at composition time. */
const RECOLOR_BASE: RGB = [255, 0, 255]
const RECOLOR_HIGHLIGHT: RGB = [255, 128, 255]
const RECOLOR_SHADE: RGB = [128, 0, 128]

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

const LUMBER_DEEP: RGB = [30, 62, 34]
const LUMBER_LIGHT: RGB = [96, 146, 76]
const TRUNK: RGB = [92, 60, 36]
const GRASS_TUFT: RGB = [178, 214, 120]
const SHEEP_CREAM: RGB = [238, 227, 207]
const SHEEP_HEAD: RGB = [58, 58, 66]
const GRAIN_FURROW: RGB = [176, 138, 46]
const GRAIN_HEADS: RGB = [240, 210, 122]
const BRICK_STRATA: RGB = [120, 54, 34]
const ORE_LIGHT: RGB = [168, 171, 184]
const ORE_SHADOW: RGB = [90, 93, 104]
const SNOW: RGB = [232, 236, 242]
const DUNE_CREST: RGB = [242, 224, 176]
const DUNE_TROUGH: RGB = [184, 156, 98]
const CACTUS: RGB = [56, 96, 52]

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

/** Seamless 32 px sea tile: waves are periodic in both axes, so edges wrap. */
function seaColor(x: number, y: number): RGB {
  const mx = ((x % 32) + 32) % 32
  const my = ((y % 32) + 32) % 32
  const h = hash3(mx, my, 99)
  if (h % 17 === 0) return SEA_DARK
  if (h % 23 === 0) return SEA_LIGHT
  if ((mx + my * 3) % 16 === 0) return SEA_DARK
  return SEA_BASE
}

/** The 15x15 box centred on the hex centre stays calm: the number token sits there. */
function inTokenBox(dx: number, dy: number): boolean {
  return Math.abs(dx) <= 7 && Math.abs(dy) <= 7
}

const PINE_ROWS = ['..G..', '.GLG.', '.GLG.', 'GLLLG', 'GLLLG', '.GGG.', '..T..']
const PINE_COLORS: Record<string, RGB> = { G: LUMBER_DEEP, L: LUMBER_LIGHT, T: TRUNK }
const PINE_CENTERS = [
  { x: -11, y: -12 },
  { x: 11, y: -12 },
  { x: -11, y: 12 },
  { x: 11, y: 12 },
]

function pineColor(dx: number, dy: number): RGB | null {
  for (const center of PINE_CENTERS) {
    const px = dx - (center.x - 2)
    const py = dy - (center.y - 3)
    if (px < 0 || py < 0 || px >= 5 || py >= PINE_ROWS.length) continue
    const ch = PINE_ROWS[py][px]
    if (ch !== '.') return PINE_COLORS[ch]
  }
  return null
}

const SHEEP_CENTERS = [
  { x: 0, y: -12 },
  { x: 0, y: 12 },
]

function sheepColor(dx: number, dy: number): RGB | null {
  for (const center of SHEEP_CENTERS) {
    const px = dx - center.x
    const py = dy - center.y
    if ((px === -3 || px === -2) && (py === -1 || py === 0)) return SHEEP_HEAD
    if ((px === -1 || px === 1) && py === 2) return SHEEP_HEAD
    if (Math.abs(px) <= 2 && Math.abs(py) <= 1) return SHEEP_CREAM
  }
  return null
}

function brickStackColor(dx: number, dy: number): RGB | null {
  const px = dx
  const py = dy + 14
  if (Math.abs(px) <= 3 && py >= -2 && py <= 2) {
    if (py === -2 || py === 2) return OUTLINE
    return ((px + py) & 1) === 0 ? TERRAIN_BASE.brick : TERRAIN_DARK.brick
  }
  return null
}

function orePeakColor(dx: number, dy: number, apexX: number, apexY: number, baseY: number, halfWidth: number): RGB | null {
  if (dy < apexY || dy > baseY) return null
  const half = Math.max(0, Math.round(((dy - apexY) / (baseY - apexY)) * halfWidth))
  if (Math.abs(dx - apexX) > half) return null
  return dx <= apexX ? ORE_LIGHT : ORE_SHADOW
}

function oreMountainColor(dx: number, dy: number): RGB | null {
  const left = orePeakColor(dx, dy, -6, -16, -9, 5)
  if (left) return left
  const right = orePeakColor(dx, dy, 6, -18, -9, 6)
  if (right) return right
  if ((dy === -18 || dy === -17) && Math.abs(dx - 6) <= 1) return SNOW
  return null
}

function cactusColor(dx: number, dy: number): RGB | null {
  const px = dx - 10
  const py = dy - 13
  if (px === 0 && py >= -2 && py <= 2) return CACTUS
  if (px === -1 && py === 0) return CACTUS
  if (px === 1 && py === -1) return CACTUS
  return null
}

function terrainColor(terrain: Terrain, dx: number, dy: number): RGB {
  if (inTokenBox(dx, dy)) return TERRAIN_BASE[terrain]
  const h = hash3(dx, dy, TERRAIN_SEED[terrain])
  switch (terrain) {
    case 'lumber': {
      const pine = pineColor(dx, dy)
      if (pine) return pine
      if (h % 5 === 0) return LUMBER_DEEP
      return TERRAIN_BASE.lumber
    }
    case 'wool': {
      const sheep = sheepColor(dx, dy)
      if (sheep) return sheep
      if (h % 7 === 0) return GRASS_TUFT
      return TERRAIN_BASE.wool
    }
    case 'grain': {
      const band = (((dx * 2 + dy) % 14) + 14) % 14
      if (band < 2) return GRAIN_FURROW
      if (band >= 5 && band < 7) return GRAIN_HEADS
      return TERRAIN_BASE.grain
    }
    case 'brick': {
      const stack = brickStackColor(dx, dy)
      if (stack) return stack
      const course = Math.floor(dy / 4)
      const row = dy - course * 4
      const offset = (course % 2) * 4
      if (row === 0) return BRICK_STRATA
      if ((((dx - offset) % 8) + 8) % 8 === 0) return TERRAIN_DARK.brick
      return TERRAIN_BASE.brick
    }
    case 'ore': {
      const mountain = oreMountainColor(dx, dy)
      if (mountain) return mountain
      if (h % 7 === 0 || (dx + 2 * dy) % 11 === 0) return ORE_SHADOW
      if (h % 23 === 0) return ORE_LIGHT
      return TERRAIN_BASE.ore
    }
    case 'desert': {
      const cactus = cactusColor(dx, dy)
      if (cactus) return cactus
      const band = (((dx * 2 + dy) % 16) + 16) % 16
      if (band < 2) return DUNE_CREST
      if (band >= 5 && band < 7) return DUNE_TROUGH
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

export const SETTLEMENT_SIZE = { w: 11, h: 11 } as const
export const CITY_SIZE = { w: 15, h: 13 } as const

const SETTLEMENT_SPRITE = [
  '.....O.....',
  '....OHO....',
  '...OHHHO...',
  '..ORRRRRO..',
  '..OPPPPPO..',
  '..OPWWPPO..',
  '..OPPWPPO..',
  '..OPPPPPO..',
  '..OPWPPPO..',
  '..OPPPPPO..',
  '..OOOOOOO..',
]

const CITY_SPRITE = [
  '.....OOO......',
  '....OHHHO.....',
  '....ORRRO.....',
  '...ORRRRO......',
  '...OPPPPO......',
  '...OPWPPO......',
  '...OPPPPO......',
  '..OPPPPPPPO.....',
  '..OPPPPPPPO.....',
  '..OPWWPPWPO.....',
  '..OPPPPPPPO.....',
  '..OPWWPPWPO.....',
  '..OOOOOOOOO.....',
]

const ROBBER_SPRITE = [
  '....O....',
  '...OGO...',
  '..OGGGO..',
  '..OGGGO..',
  '.OGGGGGO.',
  '.OGGGGGO.',
  '.OHGGGGO.',
  '.OGGGGGO.',
  '.OGGGGGO.',
  '.OGGEGGO.',
  '.OGGEGGO.',
  '..OGGGO..',
  '..OOOOO..',
]

const RECOLOR_PALETTE: Record<string, RGB> = {
  O: OUTLINE,
  P: RECOLOR_BASE,
  H: RECOLOR_HIGHLIGHT,
  R: RECOLOR_SHADE,
  W: TOKEN_CREAM,
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

// --- Canonical tile mask -----------------------------------------------------------

const CENTER_HEX_ID = HEXES.find((h) => h.q === 0 && h.r === 0)?.id
if (CENTER_HEX_ID === undefined) throw new Error('board has no centre hex')

export const TILE_MASK_OFFSETS: { x: number; y: number }[] = []
const TILE_MASK_SET = new Set<string>()

for (let dy = -30; dy <= 30; dy++) {
  for (let dx = -30; dx <= 30; dx++) {
    if (hexAtPixel(ORIGIN_X + dx, ORIGIN_Y + dy) === CENTER_HEX_ID) {
      TILE_MASK_OFFSETS.push({ x: dx, y: dy })
      TILE_MASK_SET.add(`${dx},${dy}`)
    }
  }
}

function isMaskEdge(dx: number, dy: number): boolean {
  return (
    !TILE_MASK_SET.has(`${dx + 1},${dy}`) ||
    !TILE_MASK_SET.has(`${dx - 1},${dy}`) ||
    !TILE_MASK_SET.has(`${dx},${dy + 1}`) ||
    !TILE_MASK_SET.has(`${dx},${dy - 1}`)
  )
}

// --- Sprite compositing -------------------------------------------------------------

function recolorKey(r: number, g: number, b: number, color: RGB): RGB | null {
  if (r === RECOLOR_BASE[0] && g === RECOLOR_BASE[1] && b === RECOLOR_BASE[2]) return color
  if (r === RECOLOR_HIGHLIGHT[0] && g === RECOLOR_HIGHLIGHT[1] && b === RECOLOR_HIGHLIGHT[2]) return mix(color, [255, 255, 255], 0.4)
  if (r === RECOLOR_SHADE[0] && g === RECOLOR_SHADE[1] && b === RECOLOR_SHADE[2]) return mix(color, [0, 0, 0], 0.55)
  return null
}

function compositeSprite(
  buffer: PixelBuffer,
  sprite: PixelBuffer,
  meta: SpriteMeta,
  target: { x: number; y: number },
  recolor?: RGB,
  dither = false,
): void {
  const x0 = target.x - meta.anchorX
  const y0 = target.y - meta.anchorY
  for (let sy = 0; sy < sprite.height; sy++) {
    for (let sx = 0; sx < sprite.width; sx++) {
      const si = (sy * sprite.width + sx) * 4
      const alpha = sprite.data[si + 3]
      if (alpha === 0) continue
      if (dither && ((sx + sy) & 1) !== 0) continue
      let color: RGB = [sprite.data[si], sprite.data[si + 1], sprite.data[si + 2]]
      if (recolor) {
        const mapped = recolorKey(color[0], color[1], color[2], recolor)
        if (mapped) color = mapped
      }
      setPixel(buffer, x0 + sx, y0 + sy, color, alpha)
    }
  }
}

/** Tile sprites only contribute their canonical mask pixels. */
function compositeTileSprite(buffer: PixelBuffer, sprite: PixelBuffer, meta: SpriteMeta, center: { x: number; y: number }): void {
  for (const off of TILE_MASK_OFFSETS) {
    const sx = meta.anchorX + off.x
    const sy = meta.anchorY + off.y
    if (sx < 0 || sy < 0 || sx >= sprite.width || sy >= sprite.height) continue
    const si = (sy * sprite.width + sx) * 4
    const alpha = sprite.data[si + 3]
    if (alpha === 0) continue
    setPixel(buffer, center.x + off.x, center.y + off.y, [sprite.data[si], sprite.data[si + 1], sprite.data[si + 2]], alpha)
  }
}

function getSprite(name: SpriteName, sprites?: SpriteSet): PixelBuffer {
  return sprites?.[name] ?? renderProceduralSprite(name)
}

// --- Piece geometry ------------------------------------------------------------------

type EdgeOrientation = 'vertical' | 'rising' | 'falling'

function edgeOrientation(edge: number): EdgeOrientation {
  const [a, b] = edgeEndpoints(edge)
  let dx = b.x - a.x
  let dy = b.y - a.y
  if (dx < 0) {
    dx = -dx
    dy = -dy
  }
  if (dx === 0) return 'vertical'
  return dy < 0 ? 'rising' : 'falling'
}

function drawRoadShape(buffer: PixelBuffer, edge: number, base: RGB): void {
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
  drawLine(buffer, p1, p2, base, 1)
}

function pierGeometry(edge: number): { p1: { x: number; y: number }; p2: { x: number; y: number }; target: { x: number; y: number } } {
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
  const p1 = { x: Math.round(a.x + dx * 2), y: Math.round(a.y + dy * 2) }
  const p2 = { x: Math.round(b.x + dx * 2), y: Math.round(b.y + dy * 2) }
  return {
    p1,
    p2,
    target: { x: Math.floor((p1.x + p2.x) / 2), y: Math.floor((p1.y + p2.y) / 2) },
  }
}

function drawPierShape(buffer: PixelBuffer, edge: number): void {
  const { p1, p2 } = pierGeometry(edge)
  drawLine(buffer, p1, p2, PIER_DARK, 1)
  drawLine(buffer, p1, p2, PIER, 0)
}

/** Pixel rect of a pier sprite in logical board coordinates. */
export function pierSpriteRect(edge: number): Rect {
  const target = pierGeometry(edge).target
  const meta = SPRITES[`pier-${edgeOrientation(edge)}`]
  return { x: target.x - meta.anchorX, y: target.y - meta.anchorY, width: meta.width, height: meta.height }
}

function drawNumberTokenAt(buffer: PixelBuffer, center: { x: number; y: number }, number: number): void {
  const x0 = center.x - 6
  const y0 = center.y - 6
  for (let y = 0; y < 13; y++) {
    for (let x = 0; x < 13; x++) {
      const dist = Math.hypot(x - 6, y - 6)
      if (dist <= 5) setPixel(buffer, x0 + x, y0 + y, TOKEN_CREAM)
      else if (dist <= 6) setPixel(buffer, x0 + x, y0 + y, INK)
    }
  }
  const text = String(number)
  const color = number === 6 || number === 8 ? TOKEN_RED : INK
  drawText(buffer, center.x - Math.floor(textWidth(text) / 2), center.y - 2, text, color)
  const dots = pips(number)
  if (dots > 0) {
    const rowW = dots * 2 - 1
    const startX = center.x - Math.floor(rowW / 2)
    for (let i = 0; i < dots; i++) setPixel(buffer, startX + i * 2, center.y + 4, INK)
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Plates start this far out along the edge normal and move out further only to clear pieces. */
const HARBOR_LABEL_OFFSET = 22
const HARBOR_LABEL_MAX_OFFSET = 32
const HARBOR_LABEL_HEIGHT = 11

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/** The largest piece (a city) standing on each of the edge's two corners, with a 1 px gap. */
function portPieceRects(edge: number): Rect[] {
  const city = SPRITES.city
  return edgeEndpoints(edge).map((p) => ({
    x: p.x - city.anchorX - 1,
    y: p.y - city.anchorY - 1,
    width: city.width + 2,
    height: city.height + 2,
  }))
}

/**
 * Pixel rect of a harbour label plate, placed seaward along the edge normal: as close to the coast
 * as it can be without touching a city on either of the harbour's corners.
 */
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
  const pieces = portPieceRects(edge)
  let rect: Rect = { x: 0, y: 0, width, height: HARBOR_LABEL_HEIGHT }
  for (let offset = HARBOR_LABEL_OFFSET; offset <= HARBOR_LABEL_MAX_OFFSET; offset++) {
    const x = clamp(Math.round(mx + dx * offset - width / 2), 1, BOARD_WIDTH - width - 1)
    const y = clamp(Math.round(my + dy * offset - HARBOR_LABEL_HEIGHT / 2), 1, BOARD_HEIGHT - HARBOR_LABEL_HEIGHT - 1)
    rect = { x, y, width, height: HARBOR_LABEL_HEIGHT }
    if (!pieces.some((piece) => rectsOverlap(rect, piece))) break
  }
  return rect
}

function drawHarborPlateShape(buffer: PixelBuffer, plate: Rect, type: PortType): void {
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

// --- Procedural sprite rendering -----------------------------------------------------

function cropBuffer(source: PixelBuffer, anchorX: number, anchorY: number): { buffer: PixelBuffer; anchorX: number; anchorY: number } {
  let minX = source.width
  let maxX = -1
  let minY = source.height
  let maxY = -1
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (source.data[(y * source.width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX) return { buffer: createBuffer(0, 0), anchorX: 0, anchorY: 0 }
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const out = createBuffer(width, height)
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const si = (y * source.width + x) * 4
      if (source.data[si + 3] === 0) continue
      const di = ((y - minY) * width + (x - minX)) * 4
      out.data[di] = source.data[si]
      out.data[di + 1] = source.data[si + 1]
      out.data[di + 2] = source.data[si + 2]
      out.data[di + 3] = source.data[si + 3]
    }
  }
  return { buffer: out, anchorX: anchorX - minX, anchorY: anchorY - minY }
}

function renderCroppedLineSprite(orientation: EdgeOrientation, kind: 'road' | 'pier'): PixelBuffer {
  const name = (kind === 'road' ? `road-${orientation}` : `pier-${orientation}`) as SpriteName
  const meta = SPRITES[name]
  const edge =
    kind === 'road'
      ? HEXES[0].edges.find((id) => edgeOrientation(id) === orientation)
      : COASTAL_EDGES.find((id) => edgeOrientation(id) === orientation)
  if (edge === undefined) throw new Error(`no ${orientation} edge for ${name}`)
  const temp = createBuffer(BOARD_WIDTH, BOARD_HEIGHT)
  const target = kind === 'road' ? edgePoint(edge) : pierGeometry(edge).target
  if (kind === 'road') drawRoadShape(temp, edge, RECOLOR_BASE)
  else drawPierShape(temp, edge)
  const cropped = cropBuffer(temp, target.x, target.y)
  if (cropped.buffer.width !== meta.width || cropped.buffer.height !== meta.height || cropped.anchorX !== meta.anchorX || cropped.anchorY !== meta.anchorY) {
    throw new Error(`sprite ${name} crop mismatch: got ${cropped.buffer.width}x${cropped.buffer.height} anchor ${cropped.anchorX},${cropped.anchorY}`)
  }
  return cropped.buffer
}

const proceduralCache = new Map<SpriteName, PixelBuffer>()

/** Renders one manifest sprite at its exact manifest size (recolor sprites use the key colours). */
export function renderProceduralSprite(name: SpriteName): PixelBuffer {
  const cached = proceduralCache.get(name)
  if (cached) return cached
  const meta = SPRITES[name]
  const buffer = createBuffer(meta.width, meta.height)

  if (name === 'sea') {
    for (let y = 0; y < buffer.height; y++) {
      for (let x = 0; x < buffer.width; x++) setPixel(buffer, x, y, seaColor(x, y))
    }
    proceduralCache.set(name, buffer)
    return buffer
  }

  if (name.startsWith('tile-')) {
    const terrain = name.slice('tile-'.length) as Terrain
    for (const off of TILE_MASK_OFFSETS) {
      const sx = meta.anchorX + off.x
      const sy = meta.anchorY + off.y
      const color = isMaskEdge(off.x, off.y) ? TERRAIN_DARK[terrain] : terrainColor(terrain, off.x, off.y)
      setPixel(buffer, sx, sy, color)
    }
    proceduralCache.set(name, buffer)
    return buffer
  }

  if (name.startsWith('token-')) {
    const number = Number(name.slice('token-'.length))
    drawNumberTokenAt(buffer, { x: meta.anchorX, y: meta.anchorY }, number)
    proceduralCache.set(name, buffer)
    return buffer
  }

  if (name === 'robber') {
    drawSprite(buffer, ROBBER_SPRITE, { x: meta.anchorX, y: meta.anchorY }, ROBBER_PALETTE)
    proceduralCache.set(name, buffer)
    return buffer
  }

  if (name === 'settlement') {
    drawSprite(buffer, SETTLEMENT_SPRITE, { x: meta.anchorX, y: meta.anchorY }, RECOLOR_PALETTE)
    proceduralCache.set(name, buffer)
    return buffer
  }

  if (name === 'city') {
    drawSprite(buffer, CITY_SPRITE, { x: meta.anchorX, y: meta.anchorY }, RECOLOR_PALETTE)
    proceduralCache.set(name, buffer)
    return buffer
  }

  if (name.startsWith('road-')) {
    const orientation = name.slice('road-'.length) as EdgeOrientation
    const sprite = renderCroppedLineSprite(orientation, 'road')
    proceduralCache.set(name, sprite)
    return sprite
  }

  if (name.startsWith('pier-')) {
    const orientation = name.slice('pier-'.length) as EdgeOrientation
    const sprite = renderCroppedLineSprite(orientation, 'pier')
    proceduralCache.set(name, sprite)
    return sprite
  }

  if (name.startsWith('harbor-')) {
    const type = name === 'harbor-any' ? 'any' : (name.slice('harbor-'.length) as Resource)
    drawHarborPlateShape(buffer, { x: 0, y: 0, width: meta.width, height: meta.height }, type)
    proceduralCache.set(name, buffer)
    return buffer
  }

  throw new Error(`unknown sprite ${name}`)
}

// --- Layers --------------------------------------------------------------------------

/** Pixel mask of the island (1 = land), precomputed once. */
const ISLAND_MASK = new Uint8Array(BOARD_WIDTH * BOARD_HEIGHT)
for (let y = 0; y < BOARD_HEIGHT; y++) {
  for (let x = 0; x < BOARD_WIDTH; x++) {
    if (hexAtPixel(x, y) !== null) ISLAND_MASK[y * BOARD_WIDTH + x] = 1
  }
}

/**
 * Procedural shoreline around the island's outer edge: 1 px dark just outside
 * the land, then 1 px of foam outside that. It is an effect, not a sprite.
 */
function drawShoreline(buffer: PixelBuffer): void {
  const dark = new Uint8Array(BOARD_WIDTH * BOARD_HEIGHT)
  const landAt = (x: number, y: number) => x >= 0 && y >= 0 && x < BOARD_WIDTH && y < BOARD_HEIGHT && ISLAND_MASK[y * BOARD_WIDTH + x] === 1
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const i = y * BOARD_WIDTH + x
      if (ISLAND_MASK[i] === 1) continue
      if (landAt(x - 1, y) || landAt(x + 1, y) || landAt(x, y - 1) || landAt(x, y + 1)) {
        dark[i] = 1
        setPixel(buffer, x, y, COAST)
      }
    }
  }
  for (let y = 0; y < BOARD_HEIGHT; y++) {
    for (let x = 0; x < BOARD_WIDTH; x++) {
      const i = y * BOARD_WIDTH + x
      if (ISLAND_MASK[i] === 1 || dark[i] === 1) continue
      const darkAt = (dx: number, dy: number) => dx >= 0 && dy >= 0 && dx < BOARD_WIDTH && dy < BOARD_HEIGHT && dark[dy * BOARD_WIDTH + dx] === 1
      if (darkAt(x - 1, y) || darkAt(x + 1, y) || darkAt(x, y - 1) || darkAt(x, y + 1)) setPixel(buffer, x, y, FOAM)
    }
  }
}

/** Static layer: shoreline, tiles, number tokens, harbour plates and piers. */
export function drawStaticLayer(buffer: PixelBuffer, state: GameState, sprites?: SpriteSet): void {
  drawShoreline(buffer)

  for (let h = 0; h < HEXES.length; h++) {
    const name = TILE_SPRITES[state.tiles[h].terrain]
    compositeTileSprite(buffer, getSprite(name, sprites), SPRITES[name], hexCenter(h))
  }

  for (let h = 0; h < HEXES.length; h++) {
    const number = state.tiles[h].number
    if (number === null) continue
    const name = `token-${number}` as SpriteName
    compositeSprite(buffer, getSprite(name, sprites), SPRITES[name], hexCenter(h))
  }

  for (const port of state.ports) {
    const type = port.type
    const name = type === 'any' ? 'harbor-any' : (`harbor-${type}` as SpriteName)
    const plate = harborPlateRect(port.edge, type)
    compositeSprite(buffer, getSprite(name, sprites), SPRITES[name], { x: plate.x, y: plate.y })
  }

  for (const port of state.ports) {
    const name = `pier-${edgeOrientation(port.edge)}` as SpriteName
    compositeSprite(buffer, getSprite(name, sprites), SPRITES[name], pierGeometry(port.edge).target)
  }
}

export interface PieceOverrides {
  /** Where to draw the robber (undefined = state.robber, null = hidden). */
  robberHex?: number | null
  /** Pieces not drawn yet, so a placement animation can pop them in. */
  hiddenPieces?: { vertices: number[]; edges: number[] }
}

/** Pieces layer: roads, buildings and the robber. */
export function drawPiecesLayer(buffer: PixelBuffer, state: GameState, opts: PieceOverrides = {}, sprites?: SpriteSet): void {
  const hiddenVertices = new Set(opts.hiddenPieces?.vertices ?? [])
  const hiddenEdges = new Set(opts.hiddenPieces?.edges ?? [])

  for (let e = 0; e < state.roads.length; e++) {
    const owner = state.roads[e]
    if (owner === null || hiddenEdges.has(e)) continue
    const name = `road-${edgeOrientation(e)}` as SpriteName
    const color = PLAYER_COLORS[state.players[owner].color]
    compositeSprite(buffer, getSprite(name, sprites), SPRITES[name], edgePoint(e), color)
  }

  for (let v = 0; v < state.buildings.length; v++) {
    const building = state.buildings[v]
    if (building === null || hiddenVertices.has(v)) continue
    const name = building.kind === 'city' ? 'city' : 'settlement'
    const color = PLAYER_COLORS[state.players[building.owner].color]
    compositeSprite(buffer, getSprite(name, sprites), SPRITES[name], vertexPoint(v), color)
  }

  const robberHex = opts.robberHex === undefined ? state.robber : opts.robberHex
  if (robberHex !== null) {
    compositeSprite(buffer, getSprite('robber', sprites), SPRITES.robber, hexCenter(robberHex))
  }
}

/** Whole-board composition (static + pieces), kept for the composing tests. */
export function drawBoard(buffer: PixelBuffer, state: GameState, sprites?: SpriteSet): void {
  drawStaticLayer(buffer, state, sprites)
  drawPiecesLayer(buffer, state, {}, sprites)
}

/** Key for the static layer; it only changes with tiles, ports or loaded sprites. */
export function staticLayerKey(state: GameState, sprites: SpriteSet): string {
  return JSON.stringify({
    tiles: state.tiles,
    ports: state.ports,
    sprites: Object.keys(sprites).sort(),
  })
}

/** Key for the pieces layer; it only changes with pieces or piece overrides. */
export function piecesLayerKey(state: GameState, opts: PieceOverrides = {}): string {
  return JSON.stringify({
    buildings: state.buildings,
    roads: state.roads,
    robberHex: opts.robberHex === undefined ? state.robber : opts.robberHex,
    hidden: opts.hiddenPieces ?? null,
    colors: state.players.map((player) => player.color),
  })
}

export interface TouchSelection {
  kind: 'vertex' | 'edge' | 'hex'
  id: number
}

function drawTouchSelectionShape(buffer: PixelBuffer, selection: TouchSelection): void {
  const color: RGB = [240, 224, 184]
  if (selection.kind === 'vertex') {
    drawSquareOutline(buffer, vertexPoint(selection.id), 9, color)
  } else if (selection.kind === 'edge') {
    const [a, b] = edgeEndpoints(selection.id)
    drawLine(buffer, a, b, color, 0)
  } else {
    const vertices = HEXES[selection.id].vertices
    for (let i = 0; i < 6; i++) {
      drawLine(buffer, vertexPoint(vertices[i]), vertexPoint(vertices[(i + 1) % 6]), color, 0)
    }
  }
}

export interface OverlayOpts {
  targets: TargetShapes
  ghost: GhostPiece | null
  highlightHexes: number[]
  highlightBright: boolean
  lastPlaced: { kind: 'vertex' | 'edge'; id: number } | null
  touchSelection: TouchSelection | null
}

const AMBER_DIM: RGB = [148, 104, 38]

/** Overlay layer: targets, highlight pulses, ghost, last-placed blink, touch selection. */
export function drawOverlayLayer(buffer: PixelBuffer, opts: OverlayOpts, sprites?: SpriteSet): void {
  drawTargets(buffer, opts.targets)
  for (const hex of opts.highlightHexes) {
    const color = opts.highlightBright ? AMBER : AMBER_DIM
    const vertices = HEXES[hex].vertices
    for (let i = 0; i < 6; i++) {
      drawLine(buffer, vertexPoint(vertices[i]), vertexPoint(vertices[(i + 1) % 6]), color, 2)
    }
  }
  if (opts.ghost) drawGhost(buffer, opts.ghost, sprites)
  if (opts.lastPlaced) drawLastPlaced(buffer, opts.lastPlaced)
  if (opts.touchSelection) drawTouchSelectionShape(buffer, opts.touchSelection)
}

/** A solid 5x5 amber square with a dark rim: readable at every scale, including phones. */
function drawTargetDot(buffer: PixelBuffer, center: { x: number; y: number }): void {
  drawRectFill(buffer, center.x - 3, center.y - 3, 7, 7, OUTLINE)
  drawRectFill(buffer, center.x - 2, center.y - 2, 5, 5, AMBER)
}

export function drawTargets(buffer: PixelBuffer, targets: TargetShapes): void {
  for (const vertex of targets.vertices) drawTargetDot(buffer, vertexPoint(vertex))
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
    drawTargetDot(buffer, edgePoint(edge))
  }
  for (const hex of targets.hexes) {
    const vertices = HEXES[hex].vertices
    for (let i = 0; i < 6; i++) {
      drawLine(buffer, vertexPoint(vertices[i]), vertexPoint(vertices[(i + 1) % 6]), AMBER, 0)
    }
  }
}

export function drawLastPlaced(buffer: PixelBuffer, lastPlaced: { kind: 'vertex' | 'edge'; id: number }): void {
  if (lastPlaced.kind === 'vertex') {
    const size = SETTLEMENT_SIZE
    const center = vertexPoint(lastPlaced.id)
    const x0 = Math.round(center.x - (size.w - 1) / 2) - 1
    const y0 = Math.round(center.y - (size.h - 1) / 2) - 1
    drawRectOutline(buffer, x0, y0, size.w + 2, size.h + 2, AMBER)
    return
  }
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
}

export function drawGhost(buffer: PixelBuffer, ghost: GhostPiece, sprites?: SpriteSet): void {
  const color = PLAYER_COLORS[ghost.color]
  if (ghost.kind === 'settlement' && ghost.vertex !== undefined) {
    compositeSprite(buffer, getSprite('settlement', sprites), SPRITES.settlement, vertexPoint(ghost.vertex), color, true)
  } else if (ghost.kind === 'city' && ghost.vertex !== undefined) {
    compositeSprite(buffer, getSprite('city', sprites), SPRITES.city, vertexPoint(ghost.vertex), color, true)
  } else if (ghost.kind === 'road' && ghost.edge !== undefined) {
    const name = `road-${edgeOrientation(ghost.edge)}` as SpriteName
    compositeSprite(buffer, getSprite(name, sprites), SPRITES[name], edgePoint(ghost.edge), color, true)
  } else if (ghost.kind === 'robber' && ghost.hex !== undefined) {
    compositeSprite(buffer, getSprite('robber', sprites), SPRITES.robber, hexCenter(ghost.hex), undefined, true)
  }
}
