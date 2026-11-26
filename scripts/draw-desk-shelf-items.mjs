import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as art from './shelf-art.mjs'

// Draws the shelf's items as seen from the desk close-up: straight on and from
// below, so only their fronts show (no tops), with a sliver of side face that
// turns toward the eye (x 704). The close-up is drawn with 2 px pixels and
// 2 px black outlines, so everything here is drawn at half size, one art px
// per two stage px, and scaled up by 2 at the end.
//
// Each item is its own sprite (rest + the room's two-step #f6da9c highlight,
// grown 1 and 2 art px), cropped to its box. Their boxes and pixel hit masks
// go to src/lib/room/desk-shelf-sprites.ts for DeskShelf.tsx.
//
//   node scripts/draw-desk-shelf-items.mjs
//
// Art coordinates: x is stage x / 2; FLOOR is the shelf floor (stage y 28,
// just behind the close-up's lip, which DeskShelf paints over the feet).

const __dirname = dirname(fileURLToPath(import.meta.url))
const roomDir = join(__dirname, '..', 'public', 'room')
const outTs = join(__dirname, '..', 'src', 'lib', 'room', 'desk-shelf-sprites.ts')

const CW = 470
const CH = 140
const FLOOR = 130
const FLOOR_STAGE_Y = 26
const EYE_X = 352
const PAD = 2
const INK = '000000'
const HIGHLIGHT = 'f6da9c'

const rgb = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]

// ---- layers ------------------------------------------------------------------
class Layer {
  constructor() { this.px = new Array(CW * CH).fill(null) }
  set(x, y, c) { if (c && x >= 0 && y >= 0 && x < CW && y < CH) this.px[y * CW + x] = c }
  get(x, y) { return x >= 0 && y >= 0 && x < CW && y < CH ? this.px[y * CW + x] : null }
  rect(x, y, w, h, c) { for (let r = y; r < y + h; r++) for (let q = x; q < x + w; q++) this.set(q, r, c) }
  /** Paints `rows` (strings) with `map` (char -> colour); '.' is clear. */
  stamp(x, y, rows, map) {
    rows.forEach((row, r) => [...row].forEach((ch, q) => { if (ch !== '.') this.set(x + q, y + r, map[ch] ?? ch) }))
  }
  /** Draws this layer over `under`, adding a 1 px ink ring round its silhouette. */
  onto(under) {
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (this.get(x, y)) continue
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) under.set(x, y, INK)
    }
    for (let i = 0; i < this.px.length; i++) if (this.px[i]) under.px[i] = this.px[i]
  }
}

/** One outlined part: `draw` fills a fresh layer, which lands on `item` with its ink ring. */
function part(item, draw) {
  const l = new Layer()
  draw(l)
  l.onto(item)
}

/** A shaded panel: lit top row and left column, dark bottom row and right column. */
function panel(l, x, y, w, h, { fill, light, dark }) {
  l.rect(x, y, w, h, fill)
  l.rect(x, y, w, 1, light)
  l.rect(x, y, 1, h, light)
  l.rect(x, y + h - 1, w, 1, dark)
  l.rect(x + w - 1, y, 1, h, dark)
}

/**
 * The side face turned toward the eye, drawn as its own part so the ink ring
 * keeps the corner: `d` px deep, its top edge dropping `drop` px as it recedes.
 */
function side(item, x, y, w, h, colour, d, drop = 1) {
  if (d <= 0) return
  const right = x + w / 2 < EYE_X
  part(item, (l) => {
    for (let i = 1; i <= d; i++) {
      const col = right ? x + w + i : x - 1 - i
      const top = y + Math.round((i * drop) / d)
      l.rect(col, top, 1, y + h - top, colour)
    }
  })
}

// ---- fonts -------------------------------------------------------------------
const FONT5 = {
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
}
const FONT3 = {
  M: ['#.#', '###', '#.#', '#.#', '#.#'], O: ['###', '#.#', '#.#', '#.#', '###'],
  B: ['##.', '#.#', '##.', '#.#', '##.'], Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'], I: ['###', '.#.', '.#.', '.#.', '###'],
  C: ['###', '#..', '#..', '#..', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  S: ['###', '#..', '###', '..#', '###'], E: ['###', '#..', '##.', '#..', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'], H: ['#.#', '#.#', '###', '#.#', '#.#'],
  1: ['.#.', '##.', '.#.', '.#.', '###'], 9: ['###', '#.#', '###', '..#', '###'],
  8: ['###', '#.#', '###', '#.#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'],
  ' ': ['...', '...', '...', '...', '...'],
}
const scale2 = (rows) => rows.flatMap((r) => { const w = [...r].map((c) => c + c).join(''); return [w, w] })
/** A 3x5 glyph turned a quarter clockwise, for text running down a spine. */
const turn = (rows) => Array.from({ length: 3 }, (_, r) => Array.from({ length: 5 }, (_, c) => rows[4 - c][r]).join(''))

function text3(l, x, y, str, colour) {
  [...str].forEach((ch, i) => l.stamp(x + i * 4, y, FONT3[ch], { '#': colour }))
}
/** Text down a spine `w` wide, centred on the column span. */
function spineText(l, x, w, y, str, colour) {
  const left = x + Math.floor((w - 3) / 2) - 1
  ;[...str].forEach((ch, i) => l.stamp(left, y + i * 4, turn(FONT3[ch]), { '#': colour }))
}

// ---- the items ---------------------------------------------------------------
const items = []
function item(id, kind, draw) {
  const l = new Layer()
  draw(l)
  items.push({ id, kind, layer: l })
}

// Catan: three boxes lying flat, long side out, the logo across each.
const CATAN_BOXES = [
  { fill: '3f5f8f', light: '5a7cb0', dark: '2c4468', end: 'e2b04a', endDark: 'b07f2a', icon: 'hill' },
  { fill: '3d6b46', light: '548a5c', dark: '2a4c31', end: 'd9a441', endDark: 'a8752a', icon: 'sun' },
  { fill: 'a33b2d', light: 'c2533f', dark: '742519', end: 'd68a3a', endDark: '9f5a22', icon: 'wheat' },
]
const ICONS = {
  hill: ['....##....', '...####...', '..######..', '.###..###.', '###....###', '##......##'],
  sun: ['....##....', '.#.####.#.', '..######..', '.########.', '..######..', '.#......#.'],
  wheat: ['.#..#..#..', '###.#.###.', '.#.###.#..', '.#..#..#..', '..#.#.#...', '...###....'],
}
item('catan', 'catan', (it) => {
  const W = 92
  const H = 20
  const offs = [0, 3, -1]
  CATAN_BOXES.forEach((b, i) => {
    const x = 33 + offs[i]
    const y = FLOOR + 1 - (i + 1) * (H + 1)
    part(it, (l) => {
      panel(l, x, y, W, H, b)
      // End panel with the expansion's emblem, then the logo with a drop shadow.
      l.rect(x + 1, y + 1, 17, H - 2, b.end)
      l.rect(x + 1, y + H - 2, 17, 1, b.endDark)
      l.rect(x + 18, y + 1, 1, H - 2, b.dark)
      l.stamp(x + 4, y + 7, ICONS[b.icon], { '#': b.dark })
      const tx = x + 26
      const ty = y + 3
      ;['C', 'A', 'T', 'A', 'N'].forEach((ch, k) => {
        l.stamp(tx + k * 12 + 1, ty + 1, scale2(FONT5[ch]), { '#': b.dark })
        l.stamp(tx + k * 12, ty, scale2(FONT5[ch]), { '#': 'f2dcaa' })
      })
    })
    side(it, x, y, W, H, b.dark, 4, 1)
  })
})

// Books: three spines, title running down each between gilt bands.
const BOOKS = [
  { id: 'moby-dick', x: 132, w: 12, h: 76, fill: '1d6a55', light: '2f8a70', dark: '0f4637', band: 'd8b45c', title: 'MOBY DICK', ink: 'efe2c0' },
  { id: 'nineteen-eighty-four', x: 145, w: 13, h: 88, fill: 'b44a12', light: 'd06428', dark: '7c300a', band: '2a1a10', title: '1984', ink: 'f4e3c2' },
  { id: 'odyssey', x: 159, w: 16, h: 82, fill: '6c1d5c', light: '8a3378', dark: '4a1040', band: 'd8b45c', title: 'ODYSSEY', ink: 'e8c86a' },
]
for (const b of BOOKS) {
  item(b.id, 'book', (it) => {
    const y = FLOOR + 1 - b.h
    part(it, (l) => {
      panel(l, b.x, y, b.w, b.h, b)
      l.rect(b.x + 1, y + 4, b.w - 2, 2, b.band)
      l.rect(b.x + 1, y + b.h - 10, b.w - 2, 2, b.band)
      l.rect(b.x + 1, y + 8, b.w - 2, 1, b.band)
      const len = b.title.length * 4 - 1
      spineText(l, b.x, b.w, y + Math.round((b.h - len) / 2) - 2, b.title, b.ink)
    })
    if (b.id === 'odyssey') side(it, b.x, y, b.w, b.h, '3a0c32', 3, 1)
  })
}

// ---- the VHS and the desk games -------------------------------------------------
// The same objects and art as the room's shelf (scripts/shelf-art.mjs, one
// texel per art px), seen straight on: fronts only, with a sliver of right side
// since they all stand left of the eye. Back-wall things sit a few px higher
// (`w`, depth 0 front to 1 back, lifts by up to 8 px) so they still show over
// the small things standing in front of them, and each object is painted back
// to front, like the room's layout, packed from the books to x ~374 (stage
// ~748), which leaves the last quarter of the shelf bare.
const ART = art.PALETTE
/** One textured part standing on the floor at x, lifted by its depth. */
function piece(it, x, w, tex, sideColour = null, d = 0, up = 0) {
  const y = FLOOR + 1 - tex.length - Math.round(w * 8) - up
  part(it, (l) => l.stamp(x, y, tex, ART))
  if (sideColour) side(it, x, y, tex[0].length, tex.length, sideColour, d, 1)
}
/** Paints an object's parts back to front: [x, w, tex, sideColour?, depth?, up?]. */
const object = (id, kind, parts) => item(id, kind, (it) => {
  for (const p of [...parts].sort((a, b) => b[1] - a[1])) piece(it, ...p)
})

object('vhs', 'vhs', [[180, 0.3, art.VHS_FRONT, ART['-'], 3]])
object('chess', 'game', [
  [210, 0.92, art.BOARD, ART.I, 2],
  [217, 0.52, art.KING],
  [229, 0.44, art.BISHOP],
  [234, 0.3, art.QUEEN],
  [209, 0.26, art.ROOK],
  [242, 0.12, art.KNIGHT],
  [221, 0.1, art.PAWN_W],
])
object('minesweeper', 'game', [
  [252, 0.86, art.floppy(art.PLAIN_LABEL, 'z', 'Z', '6'), ART.Z, 1, 2],
  [263, 0.72, art.floppy(art.MINE_LABEL, 'D', 'd', 'i'), ART.d, 1, 8],
])
object('solitaire', 'game', [
  [297, 0.9, art.CARD_PEEK, null, 0, art.CARDBOX_H - 2],
  [294, 0.86, art.CARD_BOX, ART.j, 2],
])
object('snake', 'game', [[311, 0.5, art.PHONE, ART.m, 2]])
object('breakout', 'game', [[329, 0.86, art.cartridge(art.BREAKOUT_LABEL, 'O'), ART.a, 2]])
object('mahjong', 'game', [
  [258, 0.22, art.ZHONG, ART.G, 2],
  [271, 0.15, art.BAMBOO, ART.G, 2],
  [284, 0.08, art.DOTS, ART.G, 2],
])
object('blackjack', 'game', [
  [298, 0.3, art.ACE_SPADES, ART.w, 1],
  [308, 0.24, art.KING_HEARTS, ART.w, 1],
  [298, 0.06, art.BLACK_CHIPS],
  [314, 0.04, art.RED_CHIPS],
])
object('pong', 'game', [[345, 0.3, art.cartridge(art.PONG_LABEL, 'R'), ART.a, 2]])

// ---- export --------------------------------------------------------------------
/** Grows the silhouette of `px` by one ring of `colour` (the hover highlight). */
function grow(px, colour) {
  const out = px.slice()
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (px[y * CW + x]) continue
    const n = (dx, dy) => { const X = x + dx; const Y = y + dy; return X >= 0 && Y >= 0 && X < CW && Y < CH && px[Y * CW + X] }
    if (n(-1, 0) || n(1, 0) || n(0, -1) || n(0, 1)) out[y * CW + x] = colour
  }
  return out
}

async function writeSprite(px, box, file) {
  const w = box.w * 2
  const h = box.h * 2
  const buf = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = px[(box.y + (y >> 1)) * CW + box.x + (x >> 1)]
    if (!c) continue
    const [r, g, b] = rgb(c)
    const i = (y * w + x) * 4
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255
  }
  await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).png().toFile(join(roomDir, file))
}

/** The rest pixels as an SVG path in stage px local to the sprite, one rect per run of equal rows. */
function hitPath(px, box) {
  const rows = []
  for (let y = 0; y < box.h; y++) {
    const runs = []
    let start = -1
    for (let x = 0; x <= box.w; x++) {
      const on = x < box.w && px[(box.y + y) * CW + box.x + x]
      if (on && start < 0) start = x
      if (!on && start >= 0) { runs.push([start, x - start]); start = -1 }
    }
    rows.push(runs)
  }
  let d = ''
  for (let y = 0; y < rows.length;) {
    let n = 1
    while (y + n < rows.length && JSON.stringify(rows[y + n]) === JSON.stringify(rows[y])) n++
    for (const [x, w] of rows[y]) d += `M${x * 2} ${y * 2}h${w * 2}v${n * 2}h-${w * 2}z`
    y += n
  }
  return d
}

const entries = []
for (const { id, kind, layer } of items) {
  let x0 = CW, y0 = CH, x1 = -1, y1 = -1
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (layer.get(x, y)) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y)
  }
  const box = { x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + 1 + PAD * 2, h: y1 - y0 + 1 + PAD * 2 }
  const rest = layer.px
  const lift1 = grow(rest, HIGHLIGHT)
  const lift2 = grow(lift1, HIGHLIGHT)
  for (const [i, px] of [rest, lift1, lift2].entries()) await writeSprite(px, box, `desk-shelf-${id}-${i + 1}.png`)
  entries.push({ id, kind, x: box.x * 2, y: (box.y - FLOOR) * 2 + FLOOR_STAGE_Y, w: box.w * 2, h: box.h * 2, hit: hitPath(rest, box) })
  console.log(`${id}: ${box.w * 2}x${box.h * 2} at ${box.x * 2},${(box.y - FLOOR) * 2 + FLOOR_STAGE_Y}`)
}

await writeFile(outTs, `// Generated by scripts/draw-desk-shelf-items.mjs. Do not edit: rerun
//   node scripts/draw-desk-shelf-items.mjs
//
// The shelf's items as drawn for the desk close-up, in render order (later
// stands in front). Boxes are in close-up stage px (the shelf sits at negative
// y, above the stage); frames are /room/desk-shelf-<id>-1..3.png (rest, then
// the two-step highlight); \`hit\` is the rest pixels as an SVG path local to
// the box, for CSS clip-path.

export const DESK_SHELF_SPRITES = [
${entries.map((e) => `  { id: '${e.id}', kind: '${e.kind}', x: ${e.x}, y: ${e.y}, w: ${e.w}, h: ${e.h},\n    hit: '${e.hit}' },`).join('\n')}
] as const
`)
console.log(`wrote ${entries.length} sprites`)
