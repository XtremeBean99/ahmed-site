/**
 * Procedural placeholder art for every UI sprite in ui-sprites.ts, at exactly
 * the manifest size. Same contract as pixel-art.ts: PixelBuffer with one image
 * pixel per logical pixel, alpha 0 for empty, warm room palette, 1 px dark
 * outline #1a1410, no anti-aliasing. The owner redraws these PNGs by hand;
 * this file only exists to render the templates and keep the tests honest.
 */

import type { Resource, Terrain } from '@/lib/games/catan/types'
import { createBuffer } from './pixel-art'
import type { PixelBuffer, RGB } from './pixel-art'
import { UI_SPRITES } from './ui-sprites'
import type { UiSpriteName } from './ui-sprites'

const OUTLINE: RGB = [26, 20, 16]
const INK: RGB = [42, 34, 32]
const CREAM: RGB = [243, 230, 196]
const PARCHMENT: RGB = [240, 224, 184]
const IVORY: RGB = [238, 226, 196]
const IVORY_SHADE: RGB = [212, 196, 160]
const PURPLE: RGB = [90, 61, 106]
const PURPLE_DARK: RGB = [58, 40, 72]
const AMBER: RGB = [224, 160, 64]
const AMBER_DARK: RGB = [168, 112, 40]
const RED: RGB = [192, 57, 43]
const RED_DARK: RGB = [128, 36, 30]
const BROWN: RGB = [128, 90, 54]
const BROWN_DARK: RGB = [84, 58, 34]
const STEEL: RGB = [168, 176, 190]
const STEEL_DARK: RGB = [96, 102, 116]
const SKIN: RGB = [224, 176, 140]

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

function setPixel(buffer: PixelBuffer, x: number, y: number, color: RGB, alpha = 255): void {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) return
  const i = (y * buffer.width + x) * 4
  buffer.data[i] = color[0]
  buffer.data[i + 1] = color[1]
  buffer.data[i + 2] = color[2]
  buffer.data[i + 3] = alpha
}

function fillRect(buffer: PixelBuffer, x0: number, y0: number, w: number, h: number, color: RGB): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPixel(buffer, x, y, color)
  }
}

function rectOutline(buffer: PixelBuffer, x0: number, y0: number, w: number, h: number, color: RGB): void {
  for (let x = x0; x < x0 + w; x++) {
    setPixel(buffer, x, y0, color)
    setPixel(buffer, x, y0 + h - 1, color)
  }
  for (let y = y0; y < y0 + h; y++) {
    setPixel(buffer, x0, y, color)
    setPixel(buffer, x0 + w - 1, y, color)
  }
}

function drawLine(buffer: PixelBuffer, x0: number, y0: number, x1: number, y1: number, color: RGB): void {
  let x = x0
  let y = y0
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    setPixel(buffer, x, y, color)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

function drawCircle(buffer: PixelBuffer, cx: number, cy: number, r: number, color: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r * r) setPixel(buffer, x, y, color)
    }
  }
}

function drawGrid(buffer: PixelBuffer, grid: string[], x0: number, y0: number, palette: Record<string, RGB>): void {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const ch = grid[y][x]
      if (ch === '.' || ch === ' ') continue
      const color = palette[ch]
      if (color) setPixel(buffer, x0 + x, y0 + y, color)
    }
  }
}

function drawRoadSegment(buffer: PixelBuffer, x0: number, y0: number, x1: number, y1: number): void {
  drawLine(buffer, x0, y0 - 1, x1, y1 - 1, OUTLINE)
  drawLine(buffer, x0, y0 + 1, x1, y1 + 1, OUTLINE)
  drawLine(buffer, x0, y0, x1, y1, BROWN)
}

function drawCardOutline(buffer: PixelBuffer, inner: RGB): void {
  rectOutline(buffer, 0, 0, 24, 34, OUTLINE)
  rectOutline(buffer, 1, 1, 22, 32, inner)
}

function drawResourceCardArt(buffer: PixelBuffer, resource: Resource): void {
  const base = TERRAIN_BASE[resource]
  const dark = TERRAIN_DARK[resource]
  if (resource === 'brick') {
    fillRect(buffer, 3, 3, 18, 20, base)
    for (let y = 3; y < 23; y += 4) fillRect(buffer, 3, y, 18, 1, dark)
    for (let course = 0; course < 5; course++) {
      const y = 3 + course * 4
      const offset = (course % 2) * 4
      for (let x = 3 + offset; x < 21; x += 8) {
        for (let yy = y + 1; yy < y + 4 && yy < 23; yy++) setPixel(buffer, x, yy, dark)
      }
    }
    return
  }
  if (resource === 'lumber') {
    const end: RGB = [136, 172, 96]
    fillRect(buffer, 3, 3, 18, 20, CREAM)
    for (let i = 0; i < 3; i++) {
      const y = 4 + i * 7
      fillRect(buffer, 4, y, 16, 5, dark)
      fillRect(buffer, 5, y + 1, 14, 3, base)
      fillRect(buffer, 5, y + 1, 2, 3, end)
      setPixel(buffer, 9, y + 2, dark)
      setPixel(buffer, 14, y + 2, dark)
    }
    return
  }
  if (resource === 'wool') {
    const woolCream: RGB = [232, 213, 176]
    fillRect(buffer, 3, 3, 18, 20, CREAM)
    drawCircle(buffer, 11, 11, 6, dark)
    drawCircle(buffer, 11, 11, 5, base)
    drawCircle(buffer, 6, 8, 4, dark)
    drawCircle(buffer, 6, 8, 3, base)
    drawCircle(buffer, 16, 8, 4, dark)
    drawCircle(buffer, 16, 8, 3, base)
    fillRect(buffer, 15, 14, 5, 4, dark)
    setPixel(buffer, 17, 15, woolCream)
    fillRect(buffer, 8, 17, 1, 4, dark)
    fillRect(buffer, 13, 17, 1, 4, dark)
    return
  }
  if (resource === 'grain') {
    fillRect(buffer, 3, 3, 18, 20, CREAM)
    drawLine(buffer, 12, 22, 12, 8, dark)
    drawLine(buffer, 8, 22, 9, 9, dark)
    drawLine(buffer, 16, 22, 15, 9, dark)
    for (const [x, y] of [[12, 6], [9, 7], [15, 7]] as const) {
      setPixel(buffer, x, y - 1, base)
      setPixel(buffer, x - 1, y, base)
      setPixel(buffer, x + 1, y, base)
      setPixel(buffer, x, y + 1, base)
    }
    setPixel(buffer, 10, 13, base)
    setPixel(buffer, 14, 13, base)
    setPixel(buffer, 11, 18, base)
    setPixel(buffer, 13, 18, base)
    return
  }
  const oreLight: RGB = [168, 171, 184]
  fillRect(buffer, 3, 3, 18, 20, CREAM)
  drawCircle(buffer, 9, 9, 4, dark)
  drawCircle(buffer, 9, 9, 3, base)
  setPixel(buffer, 8, 8, oreLight)
  drawCircle(buffer, 15, 13, 5, dark)
  drawCircle(buffer, 15, 13, 4, base)
  setPixel(buffer, 14, 12, oreLight)
  drawCircle(buffer, 8, 17, 4, dark)
  drawCircle(buffer, 8, 17, 3, base)
  setPixel(buffer, 7, 16, oreLight)
}

function renderResourceCard(buffer: PixelBuffer, resource: Resource): void {
  drawCardOutline(buffer, TERRAIN_DARK[resource])
  fillRect(buffer, 2, 2, 20, 30, CREAM)
  drawResourceCardArt(buffer, resource)
  fillRect(buffer, 2, 25, 20, 7, TERRAIN_BASE[resource])
  fillRect(buffer, 2, 24, 20, 1, TERRAIN_DARK[resource])
}

function drawKnightArt(buffer: PixelBuffer): void {
  fillRect(buffer, 9, 4, 6, 4, STEEL_DARK)
  fillRect(buffer, 10, 5, 4, 2, STEEL)
  setPixel(buffer, 11, 6, OUTLINE)
  setPixel(buffer, 11, 3, RED)
  fillRect(buffer, 10, 8, 4, 3, SKIN)
  setPixel(buffer, 11, 9, OUTLINE)
  fillRect(buffer, 9, 11, 6, 9, STEEL_DARK)
  fillRect(buffer, 9, 12, 4, 5, RED)
  drawLine(buffer, 17, 5, 10, 17, OUTLINE)
  drawLine(buffer, 16, 5, 9, 17, STEEL)
  fillRect(buffer, 9, 20, 6, 2, BROWN_DARK)
  fillRect(buffer, 7, 22, 10, 3, OUTLINE)
}

function drawRoadBuildingArt(buffer: PixelBuffer): void {
  drawRoadSegment(buffer, 5, 24, 11, 15)
  drawRoadSegment(buffer, 11, 15, 17, 24)
  drawRoadSegment(buffer, 6, 8, 12, 8)
}

function drawYearOfPlentyArt(buffer: PixelBuffer): void {
  drawCircle(buffer, 8, 16, 4, OUTLINE)
  drawCircle(buffer, 8, 16, 3, TERRAIN_BASE.grain)
  fillRect(buffer, 7, 12, 3, 2, TERRAIN_DARK.grain)
  drawCircle(buffer, 16, 16, 4, OUTLINE)
  drawCircle(buffer, 16, 16, 3, TERRAIN_BASE.brick)
  fillRect(buffer, 15, 12, 3, 2, TERRAIN_DARK.brick)
}

function drawMonopolyArt(buffer: PixelBuffer): void {
  fillRect(buffer, 8, 9, 2, 5, AMBER)
  fillRect(buffer, 11, 8, 2, 6, AMBER)
  fillRect(buffer, 14, 9, 2, 5, AMBER)
  fillRect(buffer, 7, 13, 10, 2, AMBER_DARK)
  fillRect(buffer, 7, 14, 10, 1, OUTLINE)
  setPixel(buffer, 9, 10, OUTLINE)
  setPixel(buffer, 15, 10, OUTLINE)
}

function drawVictoryPointArt(buffer: PixelBuffer): void {
  setPixel(buffer, 12, 6, AMBER)
  setPixel(buffer, 12, 8, AMBER)
  setPixel(buffer, 10, 7, AMBER)
  setPixel(buffer, 14, 7, AMBER)
  setPixel(buffer, 12, 7, CREAM)
  fillRect(buffer, 8, 13, 8, 12, BROWN_DARK)
  fillRect(buffer, 9, 14, 6, 11, BROWN)
  fillRect(buffer, 7, 12, 10, 2, RED_DARK)
  fillRect(buffer, 10, 18, 4, 7, OUTLINE)
  fillRect(buffer, 11, 19, 2, 5, AMBER)
}

function renderDevCard(buffer: PixelBuffer, kind: 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint'): void {
  rectOutline(buffer, 0, 0, 24, 34, OUTLINE)
  rectOutline(buffer, 1, 1, 22, 32, PURPLE)
  rectOutline(buffer, 2, 2, 20, 30, PURPLE_DARK)
  fillRect(buffer, 3, 3, 18, 28, PARCHMENT)
  if (kind === 'knight') drawKnightArt(buffer)
  else if (kind === 'roadBuilding') drawRoadBuildingArt(buffer)
  else if (kind === 'yearOfPlenty') drawYearOfPlentyArt(buffer)
  else if (kind === 'monopoly') drawMonopolyArt(buffer)
  else drawVictoryPointArt(buffer)
}

function drawLongestRoadArt(buffer: PixelBuffer): void {
  const segments: [number, number, number, number][] = [
    [5, 28, 9, 22],
    [9, 22, 6, 16],
    [6, 16, 12, 11],
    [12, 11, 16, 16],
    [16, 16, 13, 21],
    [13, 21, 18, 26],
  ]
  for (const [x0, y0, x1, y1] of segments) drawRoadSegment(buffer, x0, y0, x1, y1)
}

function drawLargestArmyArt(buffer: PixelBuffer): void {
  drawLine(buffer, 6, 9, 18, 23, OUTLINE)
  drawLine(buffer, 6, 9, 18, 23, STEEL)
  drawLine(buffer, 18, 9, 6, 23, OUTLINE)
  drawLine(buffer, 18, 9, 6, 23, STEEL)
  drawLine(buffer, 5, 7, 8, 10, BROWN_DARK)
  drawLine(buffer, 19, 7, 16, 10, BROWN_DARK)
  drawLine(buffer, 5, 25, 8, 22, BROWN_DARK)
  drawLine(buffer, 19, 25, 16, 22, BROWN_DARK)
}

function renderAwardCard(buffer: PixelBuffer, kind: 'longestRoad' | 'largestArmy'): void {
  const frame = kind === 'longestRoad' ? AMBER : RED
  drawCardOutline(buffer, frame)
  fillRect(buffer, 2, 2, 20, 30, CREAM)
  if (kind === 'longestRoad') drawLongestRoadArt(buffer)
  else drawLargestArmyArt(buffer)
}

function drawHexOutline(buffer: PixelBuffer, cx: number, cy: number, r: number, color: RGB): void {
  const points: [number, number][] = []
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30)
    points.push([Math.round(cx + Math.cos(angle) * r), Math.round(cy + Math.sin(angle) * r)])
  }
  for (let i = 0; i < 6; i++) {
    drawLine(buffer, points[i][0], points[i][1], points[(i + 1) % 6][0], points[(i + 1) % 6][1], color)
  }
}

function renderCardBackResource(buffer: PixelBuffer): void {
  rectOutline(buffer, 0, 0, 24, 34, OUTLINE)
  fillRect(buffer, 1, 1, 22, 32, BROWN)
  for (const cy of [7, 17, 27]) {
    for (const cx of [6, 12, 18]) {
      drawHexOutline(buffer, cx, cy, 4, BROWN_DARK)
      drawHexOutline(buffer, cx, cy, 2, [160, 118, 72])
    }
  }
}

function renderCardBackDevelopment(buffer: PixelBuffer): void {
  rectOutline(buffer, 0, 0, 24, 34, OUTLINE)
  fillRect(buffer, 1, 1, 22, 32, PURPLE_DARK)
  rectOutline(buffer, 4, 4, 16, 26, PURPLE)
  const star: string[] = [
    '...A...',
    '...A...',
    '.AA.AA.',
    '..AAA..',
    '.AA.AA.',
    '...A...',
    '.......',
  ]
  drawGrid(buffer, star, 8, 14, { A: AMBER })
}

const DIE_PIPS: Record<number, [number, number][]> = {
  1: [[7, 7]],
  2: [[3, 3], [11, 11]],
  3: [[3, 3], [7, 7], [11, 11]],
  4: [[3, 3], [11, 3], [3, 11], [11, 11]],
  5: [[3, 3], [11, 3], [7, 7], [3, 11], [11, 11]],
  6: [[3, 3], [3, 7], [3, 11], [11, 3], [11, 7], [11, 11]],
}

function renderDie(buffer: PixelBuffer, value: number): void {
  fillRect(buffer, 0, 0, 16, 16, IVORY)
  for (let i = 1; i < 15; i++) {
    setPixel(buffer, i, 14, IVORY_SHADE)
    setPixel(buffer, 14, i, IVORY_SHADE)
  }
  rectOutline(buffer, 0, 0, 16, 16, OUTLINE)
  setPixel(buffer, 0, 0, IVORY, 0)
  setPixel(buffer, 15, 0, IVORY, 0)
  setPixel(buffer, 0, 15, IVORY, 0)
  setPixel(buffer, 15, 15, IVORY, 0)
  for (const [px, py] of DIE_PIPS[value]) fillRect(buffer, px, py, 2, 2, INK)
}

const RESOURCE_ICON_GRIDS: Record<Resource, string[]> = {
  brick: [
    '........',
    '.BB.BB..',
    '.BB.BB..',
    '........',
    '.BB.BB..',
    '.BB.BB..',
    '........',
    '........',
  ],
  lumber: [
    '...BB...',
    '...BB...',
    '..BBBB..',
    '..BBBB..',
    '.BBBBBB.',
    '.BBDDBB.',
    '...DD...',
    '...DD...',
  ],
  wool: [
    '........',
    '..BBBB..',
    '.BBBBBB.',
    '.BBBBBB.',
    '..BBBB..',
    '...DD...',
    '...DD...',
    '........',
  ],
  grain: [
    '...BB...',
    '...BB...',
    '...BB...',
    '...BB...',
    '...BB...',
    '...BB...',
    '...BB...',
    '...DD...',
  ],
  ore: [
    '........',
    '.BBBBBB.',
    'BBBBBBBB',
    'BBBDBBBB',
    'BBBBBBBB',
    '.BBBBBB.',
    '........',
    '........',
  ],
}

const RESOURCE_ICON_COLORS: Record<Resource, { B: RGB; D: RGB }> = {
  brick: { B: [176, 88, 58], D: [138, 64, 40] },
  lumber: { B: [63, 107, 58], D: [44, 79, 41] },
  wool: { B: [143, 184, 90], D: [111, 154, 66] },
  grain: { B: [217, 180, 74], D: [176, 138, 46] },
  ore: { B: [124, 127, 138], D: [90, 93, 104] },
}

function renderResourceIcon(buffer: PixelBuffer, resource: Resource): void {
  const colors = RESOURCE_ICON_COLORS[resource]
  drawGrid(buffer, RESOURCE_ICON_GRIDS[resource], 0, 0, colors)
}

function renderVpIcon(buffer: PixelBuffer): void {
  const star: string[] = [
    '...A...',
    '..AAA..',
    '.AAAAA.',
    'AAAAAAA',
    '..AAA..',
    '.A...A.',
    '.......',
    '.......',
  ]
  drawGrid(buffer, star, 0, 0, { A: AMBER })
}

function renderKnightIcon(buffer: PixelBuffer): void {
  const helmet: string[] = [
    '........',
    '..SSSS..',
    '.SSSSSS.',
    '.SSSSSS.',
    '.S.OO.S.',
    '..SSSS..',
    '...SS...',
    '........',
  ]
  drawGrid(buffer, helmet, 0, 0, { S: STEEL, O: OUTLINE })
}

function renderRoadIcon(buffer: PixelBuffer): void {
  const road: string[] = [
    '........',
    '........',
    '......BB',
    '.....BB.',
    '...BB...',
    '..BB....',
    '.BB.....',
    'BB......',
  ]
  drawGrid(buffer, road, 0, 0, { B: BROWN })
}

function renderCardsIcon(buffer: PixelBuffer): void {
  fillRect(buffer, 0, 0, 5, 6, OUTLINE)
  fillRect(buffer, 1, 1, 4, 5, CREAM)
  fillRect(buffer, 3, 2, 5, 6, OUTLINE)
  fillRect(buffer, 4, 3, 3, 4, PARCHMENT)
}

function renderDevIcon(buffer: PixelBuffer): void {
  fillRect(buffer, 1, 1, 6, 6, OUTLINE)
  fillRect(buffer, 2, 2, 4, 4, PURPLE_DARK)
  fillRect(buffer, 3, 3, 2, 2, AMBER)
}

const uiCache = new Map<UiSpriteName, PixelBuffer>()

/** Renders one UI sprite at its exact manifest size. */
export function renderUiSprite(name: UiSpriteName): PixelBuffer {
  const cached = uiCache.get(name)
  if (cached) return cached
  const meta = UI_SPRITES[name]
  const buffer = createBuffer(meta.width, meta.height)

  if (name.startsWith('card-brick')) renderResourceCard(buffer, 'brick')
  else if (name.startsWith('card-lumber')) renderResourceCard(buffer, 'lumber')
  else if (name.startsWith('card-wool')) renderResourceCard(buffer, 'wool')
  else if (name.startsWith('card-grain')) renderResourceCard(buffer, 'grain')
  else if (name.startsWith('card-ore')) renderResourceCard(buffer, 'ore')
  else if (name === 'card-knight') renderDevCard(buffer, 'knight')
  else if (name === 'card-road-building') renderDevCard(buffer, 'roadBuilding')
  else if (name === 'card-year-of-plenty') renderDevCard(buffer, 'yearOfPlenty')
  else if (name === 'card-monopoly') renderDevCard(buffer, 'monopoly')
  else if (name === 'card-victory-point') renderDevCard(buffer, 'victoryPoint')
  else if (name === 'card-longest-road') renderAwardCard(buffer, 'longestRoad')
  else if (name === 'card-largest-army') renderAwardCard(buffer, 'largestArmy')
  else if (name === 'card-back-resource') renderCardBackResource(buffer)
  else if (name === 'card-back-development') renderCardBackDevelopment(buffer)
  else if (name.startsWith('die-')) renderDie(buffer, Number(name.slice('die-'.length)))
  else if (name === 'icon-brick') renderResourceIcon(buffer, 'brick')
  else if (name === 'icon-lumber') renderResourceIcon(buffer, 'lumber')
  else if (name === 'icon-wool') renderResourceIcon(buffer, 'wool')
  else if (name === 'icon-grain') renderResourceIcon(buffer, 'grain')
  else if (name === 'icon-ore') renderResourceIcon(buffer, 'ore')
  else if (name === 'icon-vp') renderVpIcon(buffer)
  else if (name === 'icon-knight') renderKnightIcon(buffer)
  else if (name === 'icon-road') renderRoadIcon(buffer)
  else if (name === 'icon-cards') renderCardsIcon(buffer)
  else if (name === 'icon-dev') renderDevIcon(buffer)
  else throw new Error(`unknown UI sprite ${name}`)

  uiCache.set(name, buffer)
  return buffer
}
