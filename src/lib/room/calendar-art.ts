// src/lib/room/calendar-art.ts
//
// Draws the wall calendar as pixel art into an RGBA buffer the size of
// CALENDAR_RECT, one buffer pixel per stage pixel, so the canvas shows it
// unscaled. The page is drawn flat, then bent onto the wall (pagePoint) so its
// edges follow the poster's perspective; text, the ring round today and the
// nail are stamped whole at their wall positions, so glyphs never shear.
// No DOM here: RoomCalendar.tsx puts the buffer on a canvas.

import type { LightingState } from './lighting'
import {
  CALENDAR_RECT,
  PAGE,
  monthGrid,
  occasionOn,
  pagePoint,
  wallPoint,
  type CalendarDate,
  type OccasionId,
} from './calendar'

type RGB = readonly [number, number, number]
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

const C = {
  ink: hex('#000000'),
  paper: hex('#ddd0c2'),
  paperShade: hex('#c4b4a4'),
  dogEar: hex('#b7a593'),
  text: hex('#3a2c28'),
  faded: hex('#a09184'),
  weekday: hex('#6a5a50'),
  red: hex('#b0382e'),
  marker: hex('#cf3328'),
  rule: hex('#bfae9c'),
  binding: hex('#4a3a3a'),
  wire: hex('#c9c1ba'),
  wireShade: hex('#6e6460'),
  string: hex('#3b2d29'),
  nail: hex('#7d7570'),
  nailShine: hex('#d8d2cc'),
  highlight: hex('#f6da9c'),
}

const OCCASION_COLOURS: Record<OccasionId, RGB> = {
  newYear: hex('#d9a520'),
  valentines: hex('#d9456a'),
  halloween: hex('#e07a1f'),
  christmas: hex('#3f8a3a'),
  newYearsEve: hex('#d9a520'),
}

// ── 3x5 pixel font (M, N and W wider so they read) ──────────────────────────
const GLYPHS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '..#', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  ' ': ['..', '..', '..', '..', '..'],
}

const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function textWidth(s: string): number {
  return [...s].reduce((w, ch) => w + (GLYPHS[ch]?.[0].length ?? 3) + 1, -1)
}

// A marker ring, drawn by hand: the stroke overshoots where it closes, top left.
const RING = [
  '.#########...',
  '#.#......##..',
  '#..........#.',
  '#...........#',
  '#...........#',
  '.#..........#',
  '..#........#.',
  '...##....##..',
  '.....####....',
]

// ── Page layout (page pixels) ────────────────────────────────────────────────
const PICTURE = { u: 3, v: 6, w: PAGE.w - 6, h: 33 }
const HEADER_V = 42
const WEEKDAY_V = 51
const RULE_V = 57
const GRID = { u: 2, v: 59, cellW: 10, rowH: 8 }
/** The page hangs on a string from a nail this far above it. */
const NAIL_V = -10
const HANG = 12

class Layer {
  readonly data: Uint8ClampedArray<ArrayBuffer>
  constructor(readonly w: number, readonly h: number, readonly ox = 0, readonly oy = 0) {
    this.data = new Uint8ClampedArray(w * h * 4)
  }
  private index(x: number, y: number) {
    const px = x + this.ox, py = y + this.oy
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return -1
    return (py * this.w + px) * 4
  }
  set(x: number, y: number, c: RGB, a = 255) {
    const i = this.index(Math.round(x), Math.round(y))
    if (i < 0) return
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = a
  }
  get(x: number, y: number): [number, number, number, number] | null {
    const i = this.index(x, y)
    if (i < 0) return null
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
  }
  rect(x: number, y: number, w: number, h: number, c: RGB) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
  }
}

// ── Seasonal pictures (southern hemisphere: Canberra's seasons) ──────────────
type Season = 'summer' | 'autumn' | 'winter' | 'spring'
export function seasonFor(month: number): Season {
  if (month === 11 || month <= 1) return 'summer'
  if (month <= 4) return 'autumn'
  if (month <= 7) return 'winter'
  return 'spring'
}

function drawPicture(p: Layer, season: Season) {
  const { u: x0, v: y0, w, h } = PICTURE
  const put = (x: number, y: number, c: RGB) => {
    if (x >= 0 && y >= 0 && x < w && y < h) p.set(x0 + x, y0 + y, c)
  }
  // Two-tone sky, dithered where the tones meet, like the window's skies.
  const sky = (top: RGB, bottom: RGB, until: number) => {
    for (let y = 0; y < until; y++) {
      const t = y / Math.max(1, until - 1)
      for (let x = 0; x < w; x++) put(x, y, t < 0.45 || (t < 0.6 && (x + y) % 2 === 0) ? top : bottom)
    }
  }
  const ridge = (base: number, amp: number, period: number, phase: number, c: RGB, peakCap?: RGB) => {
    for (let x = 0; x < w; x++) {
      const top = Math.round(base - amp * Math.abs(Math.sin((x + phase) / period)))
      for (let y = top; y < h; y++) put(x, y, peakCap && y < top + 2 && top < base - amp * 0.6 ? peakCap : c)
    }
  }

  if (season === 'summer') {
    sky(hex('#7fb6dc'), hex('#a9d2ea'), 18)
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) put(54 + x, 7 + y, hex('#f6d55c'))
    for (let y = 18; y < 24; y++) for (let x = 0; x < w; x++) put(x, y, (x * 7 + y * 3) % 11 === 0 ? hex('#8cc4e2') : hex('#3d86b8'))
    for (let y = 24; y < h; y++) for (let x = 0; x < w; x++) put(x, y, (x + y * 5) % 13 === 0 ? hex('#cdb37c') : hex('#e6cf98'))
    // A beach umbrella: a striped dome on a pole, and its shadow on the sand.
    for (let y = 13; y < 30; y++) put(20, y, hex('#5a4030'))
    for (let x = -6; x <= 6; x++) {
      const top = 13 - Math.round(Math.sqrt(36 - x * x) * 4 / 6)
      for (let y = top; y <= 13; y++) put(20 + x, y, Math.floor((x + 6) / 3) % 2 ? hex('#f2ede6') : hex('#c8453a'))
    }
    for (let x = 15; x < 27; x++) put(x, 30, hex('#cdb37c'))
  } else if (season === 'autumn') {
    sky(hex('#e6b98c'), hex('#f0d2a8'), 20)
    ridge(20, 4, 9, 2, hex('#a7734c'))
    for (let y = 22; y < h; y++) for (let x = 0; x < w; x++) put(x, y, (x * 3 + y) % 9 === 0 ? hex('#6c4c32') : hex('#7d5a3b'))
    const tree = (cx: number, base: number, r: number, leaf: RGB, dark: RGB) => {
      for (let y = base - r - 2; y < base; y++) put(cx, y, hex('#4e3222'))
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r + 1) continue
        put(cx + x, base - r - 4 + y, (x + y) % 3 === 0 && y > 0 ? dark : leaf)
      }
    }
    tree(14, 30, 6, hex('#d9752f'), hex('#a8521f'))
    tree(36, 27, 5, hex('#c0472c'), hex('#8e3220'))
    tree(55, 31, 7, hex('#e0a83a'), hex('#b07c22'))
    for (const [x, y, c] of [[24, 25, '#d9752f'], [44, 29, '#e0a83a'], [8, 31, '#c0472c'], [62, 23, '#d9752f']] as const) put(x, y, hex(c))
  } else if (season === 'winter') {
    sky(hex('#a3b4c7'), hex('#c3cfdb'), 22)
    ridge(24, 13, 7, 0, hex('#6b7b90'), hex('#f1f3f5'))
    ridge(26, 6, 5, 3, hex('#56667b'), hex('#e3e9ef'))
    for (let y = 26; y < h; y++) for (let x = 0; x < w; x++) put(x, y, (x * 5 + y * 3) % 17 === 0 ? hex('#cdd7e0') : hex('#e8eef3'))
    const pine = (cx: number, base: number, ht: number) => {
      for (let y = 0; y < ht; y++) for (let x = -Math.floor(y / 2); x <= Math.floor(y / 2); x++) put(cx + x, base - ht + y, y % 3 === 0 && x === 0 ? hex('#e8eef3') : hex('#2f5a45'))
      put(cx, base, hex('#4e3222'))
    }
    pine(9, 31, 9)
    pine(17, 30, 7)
    pine(58, 31, 10)
    for (const [x, y] of [[30, 3], [44, 8], [12, 12], [62, 5], [25, 15], [50, 18]]) put(x, y, hex('#f1f3f5'))
  } else {
    // Spring: Floriade, Canberra's tulip festival, under a clear sky.
    sky(hex('#8fc3de'), hex('#b8dcec'), 20)
    for (const [cx, cy] of [[14, 5], [48, 8]]) for (let x = -4; x <= 4; x++) {
      put(cx + x, cy, hex('#f3f6f8'))
      if (Math.abs(x) < 3) put(cx + x, cy - 1, hex('#f3f6f8'))
    }
    ridge(21, 3, 11, 4, hex('#7fa86a'))
    for (let y = 23; y < h; y++) for (let x = 0; x < w; x++) put(x, y, hex('#5f9a4a'))
    const tulips = ['#d8433b', '#f0c43a', '#e57fa8', '#9a5fc0']
    const rows = [{ y: 24, gap: 2 }, { y: 27, gap: 3 }, { y: 30, gap: 3 }]
    rows.forEach(({ y, gap }, r) => {
      const c = hex(tulips[r % tulips.length])
      const c2 = hex(tulips[(r + 2) % tulips.length])
      for (let x = r % 2; x < w; x += gap) {
        put(x, y, x % (gap * 4) < gap * 2 ? c : c2)
        put(x, y + 1, hex('#3f7a34'))
      }
    })
  }
  // Frame the print.
  for (let x = -1; x <= w; x++) { p.set(x0 + x, y0 - 1, C.paperShade); p.set(x0 + x, y0 + h, C.paperShade) }
  for (let y = -1; y <= h; y++) { p.set(x0 - 1, y0 + y, C.paperShade); p.set(x0 + w, y0 + y, C.paperShade) }
}

/** The flat page: paper, binding, picture and rules, plus the hanging string. Text comes later. */
function drawPage(today: CalendarDate): Layer {
  const p = new Layer(PAGE.w, PAGE.h + HANG, 0, HANG)
  const { w, h } = PAGE
  p.rect(0, 0, w, h, C.paper)
  for (let x = 1; x < w - 1; x++) p.set(x, h - 2, C.paperShade)
  for (let x = 0; x < w; x++) { p.set(x, 0, C.ink); p.set(x, h - 1, C.ink) }
  for (let y = 0; y < h; y++) { p.set(0, y, C.ink); p.set(w - 1, y, C.ink) }
  // The bottom-right corner is folded up: cut away past the fold, the flap on the paper.
  for (let j = 0; j < 7; j++) {
    for (let i = 0; i < 7; i++) {
      const x = w - 7 + i, y = h - 7 + j
      if (i + j > 6) p.set(x, y, C.ink, 0)
      else if (i + j === 6 || i === 0 || j === 0) p.set(x, y, C.ink)
      else p.set(x, y, C.dogEar)
    }
  }

  // Binding strip with wire coils through it.
  p.rect(1, 1, w - 2, 3, C.binding)
  for (let x = 4; x < w - 3; x += 4) {
    for (let y = -2; y <= 2; y++) p.set(x, y, C.wire)
    p.set(x + 1, -1, C.wireShade)
    p.set(x + 1, 2, C.wireShade)
  }
  // The string up to the nail.
  const mid = Math.floor(w / 2)
  for (let y = NAIL_V + 1; y <= -2; y++) {
    const t = (y - NAIL_V) / (-2 - NAIL_V)
    p.set(mid - Math.round(t * 14), y, C.string)
    p.set(mid + Math.round(t * 14), y, C.string)
  }

  drawPicture(p, seasonFor(today.month))
  for (let x = 3; x < w - 3; x++) p.set(x, RULE_V, C.rule)
  return p
}

export interface CalendarArtOptions {
  /** 0 at rest; 1 then 2 px of the room's #f6da9c hover outline. */
  highlight?: 0 | 1 | 2
  light?: LightingState
}

/** The calendar for `today`, as RGBA the size of CALENDAR_RECT. */
export function drawCalendar(today: CalendarDate, { highlight = 0, light = 'dusk' }: CalendarArtOptions = {}): Uint8ClampedArray<ArrayBuffer> {
  const { x: rx, y: ry, w: W, h: H } = CALENDAR_RECT
  const out = new Layer(W, H, -rx, -ry)
  const page = drawPage(today)

  // Bend the flat page onto the wall: sample it at each stage pixel's page point.
  const paperMask = new Uint8Array(W * H)
  for (let y = ry; y < ry + H; y++) {
    for (let x = rx; x < rx + W; x++) {
      const { u, v } = pagePoint(x + 0.5, y + 0.5)
      const px = page.get(Math.floor(u), Math.floor(v))
      if (!px || px[3] === 0) continue
      out.set(x, y, [px[0], px[1], px[2]], px[3])
      if (Math.floor(v) >= 0) paperMask[(y - ry) * W + (x - rx)] = 1
    }
  }

  // Stamp a pattern whole, positioned by where its top-left lands on the wall.
  const stamp = (rows: string[], u: number, v: number, c: RGB) => {
    const at = wallPoint(u, v)
    const ox = Math.round(at.x), oy = Math.round(at.y)
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === '#') out.set(ox + i, oy + j, c) }))
  }
  const text = (s: string, u: number, v: number, c: RGB) => {
    for (const ch of s) {
      const g = GLYPHS[ch]
      if (g) stamp(g, u, v, c)
      u += (g?.[0].length ?? 3) + 1
    }
  }

  const month = MONTHS[today.month]
  const header = `${month} ${today.year}`
  const hx = Math.floor((PAGE.w - textWidth(header)) / 2)
  text(month, hx, HEADER_V, C.red)
  text(String(today.year), hx + textWidth(month + ' ') + 1, HEADER_V, C.text)

  WEEKDAYS.forEach((d, col) => {
    const u = GRID.u + col * GRID.cellW + Math.floor((GRID.cellW - textWidth(d)) / 2)
    text(d, u, WEEKDAY_V, col === 6 ? C.red : C.weekday)
  })

  for (const { day, col, row } of monthGrid(today.year, today.month)) {
    const label = String(day)
    const u = GRID.u + col * GRID.cellW + Math.floor((GRID.cellW - textWidth(label)) / 2)
    const v = GRID.v + row * GRID.rowH
    if (day === today.day) {
      const centre = u + textWidth(label) / 2
      stamp(RING, Math.round(centre - 6.5), v - 2, C.marker)
    }
    const colour = day < today.day ? C.faded : col === 6 ? C.red : C.text
    text(label, u, v, colour)
    const occasion = occasionOn(today.month, day)
    if (occasion) stamp(['##'], u + textWidth(label) + 1, v + 4, OCCASION_COLOURS[occasion])
  }

  // The nail the string hangs from.
  stamp(['.#.', '###', '.#.'], Math.floor(PAGE.w / 2) - 1, NAIL_V - 1, C.nail)
  stamp(['#'], Math.floor(PAGE.w / 2) - 1, NAIL_V - 1, C.nailShine)

  // Soft shadow on the wall, down and right of the paper.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      if (out.data[i + 3] || paperMask[y * W + x]) continue
      if (x >= 2 && y >= 2 && paperMask[(y - 2) * W + (x - 2)]) {
        out.data[i] = 40; out.data[i + 1] = 20; out.data[i + 2] = 22; out.data[i + 3] = 70
      }
    }
  }

  if (highlight) outline(out.data, W, H, highlight)
  grade(out.data, light)
  return out.data
}

/** Grow the #f6da9c hover outline round every opaque pixel, like the room's sprites. */
function outline(data: Uint8ClampedArray, W: number, H: number, radius: number) {
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] === 255
  const ring: number[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue
      let hit = false
      for (let dy = -radius; dy <= radius && !hit; dy++) {
        for (let dx = -radius; dx <= radius && !hit; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= radius && solid(x + dx, y + dy)) hit = true
        }
      }
      if (hit) ring.push((y * W + x) * 4)
    }
  }
  for (const i of ring) {
    data[i] = C.highlight[0]; data[i + 1] = C.highlight[1]; data[i + 2] = C.highlight[2]; data[i + 3] = 255
  }
}

// The lighting grades of scripts/generate-lighting.mjs (keep the two in step).
// Dusk is the source art; outline ink is never graded.
const GRADES: Partial<Record<LightingState, { tint: [number, number, number]; bright: number; sat: number }>> = {
  dawn: { tint: [1.08, 0.97, 0.92], bright: 0.95, sat: 0.95 },
  day: { tint: [1.04, 1.02, 0.98], bright: 1.18, sat: 1.0 },
  night: { tint: [0.62, 0.68, 1.0], bright: 0.93, sat: 0.78 },
}
const INK_MAX = 12

export function grade(data: Uint8ClampedArray, light: LightingState) {
  const g = GRADES[light]
  if (!g) return
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    const r = data[i], gr = data[i + 1], b = data[i + 2]
    if (r <= INK_MAX && gr <= INK_MAX && b <= INK_MAX) continue
    const lum = 0.299 * r + 0.587 * gr + 0.114 * b
    data[i] = (lum + (r - lum) * g.sat) * g.tint[0] * g.bright
    data[i + 1] = (lum + (gr - lum) * g.sat) * g.tint[1] * g.bright
    data[i + 2] = (lum + (b - lum) * g.sat) * g.tint[2] * g.bright
  }
}
