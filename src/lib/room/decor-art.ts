// src/lib/room/decor-art.ts
//
// The seasonal decorations as pixel art, drawn into RGBA buffers one pixel per
// stage pixel (like calendar-art.ts). Lit parts (the jack-o'-lantern's face, the
// fairy lights) are emissive: they go on after the lighting grade, so night
// never dims them. No DOM here: RoomDecor.tsx puts the buffers on canvases.

import type { LightingState } from './lighting'
import { Layer, dim, grade, hex, outline, type RGB } from './pixel-buffer'
import {
  COBWEB_CORNER,
  COBWEB_RECT,
  GARLAND_RECT,
  PUMPKIN_BASE,
  PUMPKIN_RECT,
  SHELF_PINS,
  garlandPoint,
} from './seasonal'

const C = {
  ink: hex('#000000'),
  shadow: hex('#28141a'),
  pumpkinDark: hex('#963c12'),
  pumpkin: hex('#d2621b'),
  pumpkinLight: hex('#ec8a2c'),
  pumpkinShine: hex('#f7b257'),
  stem: hex('#5b6a2c'),
  stemDark: hex('#3b4a1e'),
  hollow: hex('#3a1608'),
  web: hex('#d9d2cc'),
  wire: hex('#1f3a24'),
  pin: hex('#8c8682'),
  socket: hex('#2f4a2a'),
  ribbon: hex('#b8324a'),
  heart: hex('#d9456a'),
  heartLight: hex('#f08aa4'),
  heartDark: hex('#9c2444'),
}

/** The candle's two flicker states, inner and outer flame colour. */
const FLAME: [RGB, RGB][] = [
  [hex('#fff3a8'), hex('#f5b23a')],
  [hex('#ffe27a'), hex('#e8962a')],
  [hex('#fff9cf'), hex('#f7c04e')],
]

// ── Jack-o'-lantern ─────────────────────────────────────────────────────────

const BODY = { w: 34, h: 25 } // ellipse, its base on PUMPKIN_BASE
const LOBES = [3, 10, 17, 24, 31] // lobe centres across the body; seams fall between

// Face cut-outs, local to the body's top-left. '#' is cut through.
const EYE = ['....#', '...##', '.####', '#####']
const NOSE = ['.#.', '###']
const MOUTH = [
  '#...................#',
  '##..###..###..###..##',
  '.###################.',
  '..#################..',
  '....###..###..###....',
]

export interface PumpkinArtOptions {
  /** The candle inside: a lit face glows; out, it is a dark hollow. */
  lit?: boolean
  /** Flicker state, any integer. */
  frame?: number
  highlight?: 0 | 1 | 2
  light?: LightingState
  /** The desk lamp is off: the body dims like the sprites; the flame does not. */
  lampOff?: boolean
}

export function drawPumpkin({ lit = true, frame = 0, highlight = 0, light = 'dusk', lampOff = false }: PumpkinArtOptions = {}): Uint8ClampedArray<ArrayBuffer> {
  const { w: W, h: H } = PUMPKIN_RECT
  const left = PUMPKIN_BASE.x - Math.floor(BODY.w / 2) - PUMPKIN_RECT.x
  const top = PUMPKIN_BASE.y - BODY.h - PUMPKIN_RECT.y
  const L = new Layer(W, H, left, top)
  const rx = BODY.w / 2, ry = BODY.h / 2
  const inside = (x: number, y: number) => ((x + 0.5 - rx) / rx) ** 2 + ((y + 0.5 - ry) / ry) ** 2 <= 1

  for (let y = 0; y < BODY.h; y++) {
    for (let x = 0; x < BODY.w; x++) {
      if (!inside(x, y)) continue
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      if (edge) { L.set(x, y, C.ink); continue }
      // Distance to the nearest lobe centre: seams dark, lobe middles light, and
      // the lamp (left of the room) lights the left side.
      const d = Math.min(...LOBES.map((c) => Math.abs(x - c)))
      const lampSide = x < rx && y < ry
      let c = d >= 3 ? C.pumpkinDark : d === 2 ? C.pumpkin : lampSide ? C.pumpkinLight : C.pumpkin
      if (y >= BODY.h - 4 && d >= 2) c = C.pumpkinDark
      L.set(x, y, c)
    }
  }
  // A glossy glint on the left lobe.
  for (const [x, y] of [[5, 5], [6, 5], [5, 6], [4, 7], [4, 8]]) L.set(x, y, C.pumpkinShine)

  // Stem, curling right.
  const stem: [number, number, RGB][] = [
    [16, 0, C.stemDark], [17, 0, C.stem], [16, -1, C.stemDark], [17, -1, C.stem], [16, -2, C.stemDark], [17, -2, C.stem],
    [17, -3, C.stem], [18, -3, C.stem], [18, -4, C.stem], [19, -4, C.stemDark],
  ]
  for (const [x, y, c] of stem) L.set(x, y, c)
  for (const [x, y] of [[15, 0], [15, -1], [15, -2], [16, -3], [17, -4], [18, -5], [19, -5], [20, -4], [19, -3], [18, -2], [18, -1], [18, 0]]) {
    if (!L.get(x, y)?.[3]) L.set(x, y, C.ink)
  }

  // Shadow on the sill, down and right of the body (the lamp is left).
  for (let y = BODY.h - 3; y <= BODY.h + 1; y++) {
    for (let x = 1; x < BODY.w + 4; x++) {
      const ex = (x + 0.5 - rx - 2) / (rx + 1), ey = (y + 0.5 - BODY.h) / 2.2
      if (ex * ex + ey * ey > 1 || L.get(x, y)?.[3]) continue
      L.set(x, y, C.shadow, 90)
    }
  }

  // The face, cut through: stamped as a dark hollow now, lit after the grade.
  const cuts: [number, number][] = []
  const cut = (rows: string[], ox: number, oy: number, mirror = false) => {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '#') cuts.push([ox + (mirror ? row.length - 1 - i : i), oy + j])
    }))
  }
  cut(EYE, 7, 7)
  cut(EYE, 22, 7, true)
  cut(NOSE, 15, 12)
  cut(MOUTH, 6, 15)
  for (const [x, y] of cuts) L.set(x, y, C.hollow)

  if (highlight) outline(L.data, W, H, highlight)
  grade(L.data, light)
  if (lampOff) dim(L.data)

  if (lit) {
    const [inner, outer] = FLAME[((frame % FLAME.length) + FLAME.length) % FLAME.length]
    const cutSet = new Set(cuts.map(([x, y]) => `${x},${y}`))
    for (const [x, y] of cuts) {
      // Edges of each hole catch less of the flame.
      const rim = ['-1,0', '1,0', '0,-1', '0,1'].some((o) => {
        const [dx, dy] = o.split(',').map(Number)
        return !cutSet.has(`${x + dx},${y + dy}`)
      })
      L.set(x, y, rim ? outer : inner)
    }
  }
  return L.data
}

// ── Cobweb ──────────────────────────────────────────────────────────────────

/** A web spun across the shelf's inside top-right corner. Static; graded. */
export function drawCobweb({ light = 'dusk', lampOff = false }: { light?: LightingState; lampOff?: boolean } = {}): Uint8ClampedArray<ArrayBuffer> {
  const { w: W, h: H } = COBWEB_RECT
  const L = new Layer(W, H)
  const cx = COBWEB_CORNER.x - COBWEB_RECT.x, cy = COBWEB_CORNER.y - COBWEB_RECT.y
  const R = 22
  // Radial threads from the corner, fanning across the quarter below-left.
  const angles = [0.08, 0.5, 0.95, 1.4].map((a) => Math.PI / 2 + a) // pointing left and down
  const ends = angles.map((a) => ({ x: Math.cos(a), y: Math.sin(a) }))
  const line = (x0: number, y0: number, x1: number, y1: number, alpha: number) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let i = 0; i <= n; i++) L.set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), C.web, alpha)
  }
  // The threads sag a little: each spiral strand between neighbours bows toward the corner.
  for (const r of [7, 13, 19]) {
    for (let k = 0; k < ends.length - 1; k++) {
      const a = ends[k], b = ends[k + 1]
      const steps = 8
      let px = cx + a.x * r, py = cy + a.y * r
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const sag = 1 - 0.18 * Math.sin(Math.PI * t)
        const x = cx + (a.x + (b.x - a.x) * t) * r * sag
        const y = cy + (a.y + (b.y - a.y) * t) * r * sag
        line(Math.round(px), Math.round(py), Math.round(x), Math.round(y), 150)
        px = x; py = y
      }
    }
  }
  for (const e of ends) line(cx, cy, Math.round(cx + e.x * R), Math.round(cy + e.y * R), 190)
  grade(L.data, light)
  if (lampOff) dim(L.data)
  return L.data
}

// ── Garlands on the shelf ───────────────────────────────────────────────────

const BULB_COLOURS: RGB[] = [hex('#ff4a3d'), hex('#ffd23f'), hex('#3fd16a'), hex('#4aa8ff'), hex('#ff8a2a')]
/** Bulbs per span between two pins. */
const BULBS_PER_SPAN = 5

export interface Bulb { x: number; y: number; colour: RGB }

/** Every fairy-light bulb, left to right: where it hangs and its colour. */
export function fairyBulbs(): Bulb[] {
  const bulbs: Bulb[] = []
  for (let s = 0; s < SHELF_PINS.length - 1; s++) {
    for (let k = 0; k < BULBS_PER_SPAN; k++) {
      const p = garlandPoint(SHELF_PINS[s], SHELF_PINS[s + 1], (k + 0.5) / BULBS_PER_SPAN)
      bulbs.push({ x: Math.round(p.x), y: Math.round(p.y) + 2, colour: BULB_COLOURS[bulbs.length % BULB_COLOURS.length] })
    }
  }
  return bulbs
}

/** Is bulb i on in twinkle frame f? Mostly on; a few rest each frame, never neighbours. */
export function bulbOn(i: number, frame: number): boolean {
  let h = (i * 374761393 + frame * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return (h ^ (h >>> 16)) % 5 !== 0
}

function drawWire(L: Layer) {
  for (let s = 0; s < SHELF_PINS.length - 1; s++) {
    const a = SHELF_PINS[s], b = SHELF_PINS[s + 1]
    for (let x = a; x <= b; x++) {
      const p = garlandPoint(a, b, (x - a) / (b - a))
      L.set(x, Math.round(p.y), C.wire)
    }
  }
  for (const x of SHELF_PINS) {
    const p = garlandPoint(x, x + 1, 0)
    L.set(x, Math.round(p.y) - 1, C.pin)
    L.set(x, Math.round(p.y), C.pin)
  }
}

export interface LightsArtOptions {
  /** Twinkle frame; null holds every bulb on (reduced motion). */
  frame?: number | null
  light?: LightingState
  lampOff?: boolean
}

/** Christmas fairy lights strung along the shelf's front. */
export function drawFairyLights({ frame = null, light = 'dusk', lampOff = false }: LightsArtOptions = {}): Uint8ClampedArray<ArrayBuffer> {
  const L = new Layer(GARLAND_RECT.w, GARLAND_RECT.h, -GARLAND_RECT.x, -GARLAND_RECT.y)
  drawWire(L)
  const bulbs = fairyBulbs()
  for (const b of bulbs) { L.set(b.x, b.y - 1, C.socket); L.set(b.x + 1, b.y - 1, C.socket) }
  grade(L.data, light)
  if (lampOff) dim(L.data)

  // Emissive: the bulbs, and a soft halo that is strongest in the dark.
  const halo = Math.min(160, (light === 'night' ? 110 : light === 'dusk' ? 70 : 35) + (lampOff ? 40 : 0))
  bulbs.forEach((b, i) => {
    const on = frame === null || bulbOn(i, frame)
    const c: RGB = on ? b.colour : [b.colour[0] * 0.45, b.colour[1] * 0.45, b.colour[2] * 0.45]
    if (on) {
      for (const [dx, dy] of [[-1, 0], [2, 0], [-1, 1], [2, 1], [-1, 2], [2, 2], [0, 3], [1, 3]]) {
        if (L.get(b.x + dx, b.y + dy)?.[3] !== 0) continue
        L.set(b.x + dx, b.y + dy, b.colour, halo)
      }
    }
    // A 2x3 bulb with a glint in its top-left pixel.
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 2; dx++) L.set(b.x + dx, b.y + dy, c)
    if (on) L.set(b.x, b.y, [Math.min(255, c[0] + 90), Math.min(255, c[1] + 90), Math.min(255, c[2] + 90)])
  })
  return L.data
}

/** Valentine's paper hearts on a ribbon along the shelf's front. Graded, not lit. */
export function drawHeartGarland({ light = 'dusk', lampOff = false }: { light?: LightingState; lampOff?: boolean } = {}): Uint8ClampedArray<ArrayBuffer> {
  const L = new Layer(GARLAND_RECT.w, GARLAND_RECT.h, -GARLAND_RECT.x, -GARLAND_RECT.y)
  for (let s = 0; s < SHELF_PINS.length - 1; s++) {
    const a = SHELF_PINS[s], b = SHELF_PINS[s + 1]
    for (let x = a; x <= b; x++) L.set(x, Math.round(garlandPoint(a, b, (x - a) / (b - a)).y), C.ribbon)
  }
  const HEART = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...']
  for (let s = 0; s < SHELF_PINS.length - 1; s++) {
    for (const t of [0.25, 0.5, 0.75]) {
      const p = garlandPoint(SHELF_PINS[s], SHELF_PINS[s + 1], t)
      const ox = Math.round(p.x) - 3, oy = Math.round(p.y)
      HEART.forEach((row, j) => [...row].forEach((ch, i) => {
        if (ch !== '#') return
        const edge = j === 0 || i === 0 || i === row.length - 1 || row[i - 1] !== '#' || row[i + 1] !== '#' || HEART[j + 1]?.[i] !== '#'
        L.set(ox + i, oy + j, edge ? C.heartDark : i <= 2 && j <= 2 ? C.heartLight : C.heart)
      }))
    }
  }
  grade(L.data, light)
  if (lampOff) dim(L.data)
  return L.data
}
