// Draws the desk games' shelf objects (chess, mahjong, solitaire, blackjack,
// minesweeper, snake, pong, breakout) as pixel art on the full 1408x768 stage
// canvas, in the same rest + two-step highlight format as the hand-drawn shelf
// sources, then hands them to scripts/extract-shelf.mjs for cropping.
//
//   node scripts/draw-shelf-games.mjs && node scripts/extract-shelf.mjs && npm run lighting
//
// The objects live in the shelf's own 3D space, so they stand at different
// depths and overlap like the catan boxes, books and tapes do:
//   u  along the shelf, in stage px measured on the front lip
//   v  height above the shelf floor, in px
//   w  depth, 0 at the front lip and 1 at the back wall
// `proj` maps that space onto the stage with the oblique projection measured
// off background.png (the floor recedes up and to the left). Each object is a
// list of parts painted back to front; a part is one or more textured faces
// (a box's left side, top and front, a board leaning on the wall, a chess
// piece). Every part gets a 1 px ink ring, so a front part keeps its edge
// where it overlaps the one behind. The #f6da9c highlight outline is then grown
// by 1 px (frame 2) and 2 px (frame 3), like catan / books / vhs.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'assets', 'pixel-art', 'shelf')

const W = 1408
const H = 768
const INK = [0, 0, 0]
const HIGHLIGHT = [0xf6, 0xda, 0x9c]

// Shelf geometry, measured off background.png: the front edge of the floor is
// y 242 at x 300 and rises 0.135 px per px; the back wall meets the floor
// 24 px higher; the side wall at the right shows depth runs (-54, -16).
const SLOPE = 0.135
const DEPTH = [-54, -16]
const proj = (u, v, w) => [u + DEPTH[0] * w, 242 - SLOPE * (u - 300) + DEPTH[1] * w - v]
// Direction vectors of the three axes on the stage, per unit.
const AX_U = [1, -SLOPE]
const AX_V = [0, -1]
const AX_W = DEPTH

const PALETTE = {
  K: '000000', // ink
  // ivory (white chessmen, mahjong faces, cards)
  X: 'fbf4e2', W: 'ecdcbc', w: 'cbb894', v: 'a08a68',
  // ebony (black chessmen)
  e: '7a625c', E: '4d3b38', f: '2e2224',
  // chessboard
  Q: 'e6c391', U: '9c6238', F: '5c3a26', M: '7a4e33', I: '3e2619',
  // mahjong backs
  G: '3f7a52', g: '2b5a3a', h: '58966a',
  // reds
  q: 'e07a62', R: 'c0463a', r: '8a2e28',
  // card-back blues
  b: '6f93c6', B: '3d5d8f', n: '2a4170', j: '22355c',
  // chips
  C: '45454d', c: '2a2a30', y: 'd9d2c0', k: '5e5e68',
  // floppies
  D: '4f5262', d: '363946', i: '6a6e80', S: 'c0c2ca', s: '8a8c97', t: '5c5e68',
  L: 'ebe4cf', l: 'c7bfa7', x: '2d6d8f', z: '6b3f6e', Z: '4a2a4d',
  // phone
  o: '6a7b9e', N: '44547a', m: '2c3753', P: 'a7ba78', p: '3c4824',
  // cartridges
  H: '5a514c', A: '37312f', a: '221e1d', T: '77706a',
  O: 'd98a3c', Y: 'e2c45a', J: '62a456',
}

const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
const RGB = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, hex(h)]))

// ---- texture helpers ---------------------------------------------------------
// A texture is string[] (row 0 at the top) or a single palette char for a flat
// fill. `grid` + `rect` + `stamp` build the bigger ones.
const grid = (w, h, ch) => Array.from({ length: h }, () => Array(w).fill(ch))
function rect(g, x, y, w, h, ch) {
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (g[r]?.[c] !== undefined) g[r][c] = ch
  return g
}
function stamp(g, x, y, rows) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') g[y + r][x + c] = ch }))
  return g
}
const done = (g) => g.map((r) => r.join(''))

/** A box's left side, run back to front: `back` fill with a `front` edge column. */
const twoTone = (cols, front, back) => [back.repeat(cols - 1) + front]

// ---- chess: a board leaning on the back wall, chessmen standing in front -----
const BOARD = (() => {
  const g = grid(40, 40, 'F')
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) rect(g, 4 + c * 4, 4 + r * 4, 4, 4, (r + c) % 2 ? 'U' : 'Q')
  rect(g, 0, 0, 40, 1, 'M') // lit top and left rails, shaded bottom
  rect(g, 0, 0, 1, 40, 'M')
  rect(g, 0, 39, 40, 1, 'I')
  rect(g, 3, 3, 34, 1, 'I') // inlay line round the squares
  rect(g, 3, 3, 1, 34, 'I')
  rect(g, 3, 36, 34, 1, 'M')
  rect(g, 36, 3, 1, 34, 'M')
  return done(g)
})()

const KING = [
  '...XW...',
  '..XWWw..',
  '...XW...',
  '..XWWw..',
  '.XWWWWw.',
  '.XWWWWw.',
  '..XWWw..',
  '.KKKKKK.',
  '..XWWw..',
  '..XWWw..',
  '..XWWw..',
  '..XWWw..',
  '.XWWWWw.',
  '.KKKKKK.',
  'XWWWWWWw',
  'XWWWWWwv',
  '.wwwwwv.',
]
const QUEEN = [
  '.e..e..f',
  '.eE.E.ef',
  '.eEEEEf.',
  '..eEEf..',
  '.KKKKKK.',
  '..eEEf..',
  '..eEEf..',
  '..eEEf..',
  '..eEEf..',
  '.eEEEEf.',
  '.KKKKKK.',
  'eEEEEEEf',
  'eEEEEEff',
  '.ffffff.',
]
const KNIGHT = [
  '...ee....',
  '..eEEf...',
  '.eEKEEf..',
  'eEEEEEEf.',
  'eEEEEEEf.',
  '.ff.eEEf.',
  '...eEEEf.',
  '...eEEEf.',
  '..eEEEEf.',
  '.KKKKKKK.',
  '.eEEEEEf.',
  'eEEEEEEff',
  '.fffffff.',
]
const ROOK = [
  'X.XW.Ww',
  'XWWWWWw',
  '.XWWWw.',
  '.XWWWw.',
  '.XWWWw.',
  '.XWWWw.',
  '.XWWWw.',
  '.KKKKK.',
  'XWWWWWw',
  'XWWWWwv',
  '.wwwwv.',
]
const PAWN = (light) =>
  light
    ? ['.XWw.', '.XWw.', '..XW..'.slice(0, 5), '.XWw.', '.XWw.', 'XWWWw', 'XWWwv', '.wwv.']
    : ['.eEf.', '.eEf.', '..E..', '.eEf.', '.eEf.', 'eEEEf', 'eEEff', '.fff.']

// ---- mahjong: a two-high wall lying face down, three tiles standing up --------
// The wall is one box per layer; its front texture draws the tile seams.
const WALL_FRONT = (() => {
  const g = grid(40, 6, 'W')
  rect(g, 0, 0, 40, 1, 'h')
  rect(g, 0, 1, 40, 1, 'G')
  rect(g, 0, 2, 40, 1, 'w')
  rect(g, 0, 5, 40, 1, 'w')
  for (let c = 7; c < 40; c += 8) rect(g, c, 0, 1, 6, 'v')
  return done(g)
})()
const WALL_TOP = [[...Array(40)].map((_, c) => (c % 8 === 7 ? 'g' : 'G')).join('')]
const tileFace = (glyph) => {
  const g = grid(10, 14, 'W')
  rect(g, 0, 0, 1, 14, 'X')
  rect(g, 9, 0, 1, 14, 'w')
  rect(g, 0, 13, 10, 1, 'w')
  stamp(g, 1, 2, glyph)
  return done(g)
}
const ZHONG = tileFace([
  '...R....',
  '...R....',
  'RRRRRRR.',
  'R..R..R.',
  'R..R..R.',
  'RRRRRRR.',
  '...R....',
  '...R....',
  '...r....',
])
const BAMBOO = tileFace([
  '.J...J..',
  '.J...J..',
  '.g...g..',
  '.J.J.J..',
  '.J.J.J..',
  '.g.g.g..',
  '.J.J.J..',
  '.J.J.J..',
  '.g.g.g..',
])
const DOTS = tileFace([
  '..BBB...',
  '.BqRqB..',
  '.BRrRB..',
  '.BqRqB..',
  '..BBB...',
  '........',
  '.R...R..',
  '........',
  '.R...R..',
])

// ---- solitaire: a tuck box of cards, blue lattice back ------------------------
const CARD_BOX = (() => {
  const g = grid(18, 26, 'W')
  rect(g, 0, 0, 18, 4, 'b') // lid flap
  rect(g, 0, 3, 18, 1, 'n')
  rect(g, 6, 2, 6, 1, 'B') // thumb notch
  rect(g, 1, 5, 16, 20, 'B')
  for (let r = 5; r < 25; r++) for (let c = 1; c < 17; c++) if ((r + c) % 4 === 0 || (r - c + 40) % 4 === 0) g[r][c] = 'b'
  rect(g, 5, 10, 8, 9, 'W') // pip window
  stamp(g, 6, 11, ['...K..', '..KKK.', '.KKKKK', 'KKKKKK'.slice(0, 6), '.KKKKK', '...K..', '..KKK.'])
  rect(g, 17, 4, 1, 22, 'w')
  rect(g, 0, 25, 18, 1, 'w')
  return done(g)
})()

// ---- blackjack: ace of spades and king of hearts leaning together, chips -----
const card = (rank, pip) => {
  const g = grid(12, 16, 'X')
  rect(g, 11, 0, 1, 16, 'w')
  rect(g, 0, 15, 12, 1, 'w')
  stamp(g, 1, 1, rank)
  stamp(g, 5, 8, pip)
  return done(g)
}
const ACE_SPADES = card(['.KK.', 'K..K', 'KKKK', 'K..K', 'K..K'], ['..K..', '.KKK.', 'KKKKK', 'KKKKK', '..K..', '.KKK.'])
const KING_HEARTS = card(['R..R', 'R.R.', 'RR..', 'R.R.', 'R..R'], ['.R.R.', 'RRRRR', 'RRRRR', '.RRR.', '..R..'])

/** A stack of `n` chips, seen from the front: an elliptical top, striped edges. */
function chipStack(n, face, side, shade, spot) {
  const rows = [`...${face.repeat(5)}...`, `.${face}${spot}${face.repeat(5)}${spot}${shade}.`, `${face.repeat(10)}${shade}`]
  for (let i = 0; i < n; i++) {
    rows.push(`${side}${spot}${side.repeat(3)}${spot}${side.repeat(3)}${spot}${shade}`)
    rows.push(`${shade}${side.repeat(9)}${shade}`)
  }
  return rows
}
const RED_CHIPS = chipStack(7, 'q', 'R', 'r', 'X')
const BLACK_CHIPS = chipStack(4, 'k', 'C', 'c', 'y')

// ---- minesweeper: two 3.5" floppies leaning on the wall, a mine on the front --
const floppy = (labelArt, body, shade, lit) => {
  const g = grid(26, 27, body)
  rect(g, 0, 0, 26, 1, lit)
  rect(g, 0, 0, 1, 27, lit)
  rect(g, 25, 0, 1, 27, shade)
  rect(g, 0, 26, 26, 1, shade)
  rect(g, 7, 0, 13, 9, 'S') // metal shutter
  rect(g, 19, 0, 1, 9, 's')
  rect(g, 7, 8, 13, 1, 's')
  rect(g, 13, 1, 4, 6, 't')
  rect(g, 3, 11, 20, 14, 'L') // label
  rect(g, 3, 11, 20, 2, 'l')
  rect(g, 1, 24, 2, 2, shade) // write-protect notch
  stamp(g, 4, 13, labelArt)
  return done(g)
}
const MINE_LABEL = [
  '......K..........',
  '....K.K.K....RR..',
  '.....KKK....RRR..',
  '...KKKSKKK...RR..',
  '.....KKK......K..',
  '....K.K.K.....K..',
  '......K......KKK.',
  '.................',
  '.xxxxxxxxxxxxxx..',
  '.................',
  '.xxxxxxxxx.......',
]
const PLAIN_LABEL = ['', '', '.zzzzzzzzzzzzz', '', '.ZZZZZZZZZ', '', '.ZZZZZZZZZZZZ', '', '.ZZZZZZ'].map((r) => r.padEnd(17, '.'))

// ---- snake: a candybar phone with snake on its green screen -------------------
const PHONE = (() => {
  const g = grid(13, 28, 'N')
  rect(g, 0, 0, 1, 28, 'o')
  rect(g, 12, 0, 1, 28, 'm')
  rect(g, 4, 1, 5, 1, 'm') // earpiece
  rect(g, 1, 3, 11, 10, 'm')
  rect(g, 2, 4, 9, 8, 'P')
  stamp(g, 2, 4, ['.........', '.ppppp.p.', '.....p...', '.....p...', '.....ppp.', '.........', '.........', '.........'])
  rect(g, 4, 14, 5, 3, 'o') // nav key
  rect(g, 5, 15, 3, 1, 'm')
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) rect(g, 2 + c * 4, 18 + r * 2, 2, 1, 'o')
  rect(g, 0, 27, 13, 1, 'm')
  return done(g)
})()

// ---- pong / breakout: two Atari-style cartridges ------------------------------
const cartridge = (label, trim) => {
  const g = grid(20, 25, 'A')
  for (let r = 1; r < 10; r += 2) rect(g, 1, r, 18, 1, 'a') // grip ridges
  rect(g, 0, 0, 1, 25, 'H')
  rect(g, 19, 0, 1, 25, 'a')
  rect(g, 2, 11, 16, 12, trim)
  rect(g, 3, 12, 14, 10, 'a')
  stamp(g, 3, 12, label)
  rect(g, 0, 24, 20, 1, 'a')
  return done(g)
}
const PONG_LABEL = [
  '.......T......',
  '.X.....T......',
  '.X.....T......',
  '.X.....T....X.',
  '.......T....X.',
  '.......T..S.X.',
  '.......T......',
  '.......T......',
  'OOOOOOOOOOOOOO',
  '..............',
]
const BREAKOUT_LABEL = [
  'RRR.RRR.RRR.RR',
  'OOO.OOO.OOO.OO',
  'YYY.YYY.....YY',
  'JJJ.J...JJJ.JJ',
  '..............',
  '......X.......',
  '..............',
  '..............',
  '....XXXXX.....',
  '..............',
]

// ---- faces and parts ----------------------------------------------------------
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const mul = (a, k) => [a[0] * k, a[1] * k]
const texSize = (tex) => (typeof tex === 'string' ? [1, 1] : [tex[0].length, tex.length])

/**
 * A textured parallelogram. `o` is its bottom-left corner on the stage, `a` and
 * `b` the stage vectors of its full width and height. Texel rows run top down.
 */
const face = (o, a, b, tex) => ({ o, a, b, tex })

// Placement is by stage x of an object's front-left-bottom corner at its own
// depth, so neighbours at different depths are easy to line up.
const at = (x, v, w) => proj(x - DEPTH[0] * w, v, w)

/** A face standing upright at (x, w), leaning back by `lean` depth over its height. */
const upright = (x, w, du, dv, tex, lean = 0) => face(at(x, 0, w), mul(AX_U, du), add(mul(AX_V, dv), mul(AX_W, lean)), tex)

/** A box standing on the floor: left side, top, then front (front-left-bottom at x, w). */
function box(x, w, du, dv, dd, { front, side, top }, up = 0) {
  const u = x - DEPTH[0] * w
  const lift = (p) => [p[0], p[1] - up]
  return {
    faces: [
      face(lift(proj(u, 0, w + dd)), mul(AX_W, -dd), mul(AX_V, dv), side),
      face(lift(proj(u, dv, w)), mul(AX_U, du), mul(AX_W, dd), top),
      face(lift(proj(u, 0, w)), mul(AX_U, du), mul(AX_V, dv), front),
    ],
  }
}

/** Upright art with no shear (round things: chessmen, chips), left edge at x. */
function billboard(x, w, map) {
  const [, y] = at(x + map[0].length / 2, 0, w)
  return { faces: [face([x, Math.round(y)], [map[0].length, 0], [0, -map.length], map)] }
}

/** Stage pixels of one part: Map(index -> palette char), last face wins. */
function rasterPart(part) {
  const out = new Map()
  for (const f of part.faces) {
    const [tw, th] = texSize(f.tex)
    const corners = [f.o, add(f.o, f.a), add(f.o, f.b), add(add(f.o, f.a), f.b)]
    const x0 = Math.floor(Math.min(...corners.map((p) => p[0]))) - 1
    const x1 = Math.ceil(Math.max(...corners.map((p) => p[0]))) + 1
    const y0 = Math.floor(Math.min(...corners.map((p) => p[1]))) - 1
    const y1 = Math.ceil(Math.max(...corners.map((p) => p[1]))) + 1
    const det = f.a[0] * f.b[1] - f.a[1] * f.b[0]
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Pixel centre in the face's own (s, t) space, both 0..1.
        const px = x + 0.5 - f.o[0]
        const py = y + 0.5 - f.o[1]
        const s = (px * f.b[1] - py * f.b[0]) / det
        const t = (f.a[0] * py - f.a[1] * px) / det
        if (s < 0 || s >= 1 || t < 0 || t >= 1) continue
        const ch = typeof f.tex === 'string' ? f.tex : f.tex[th - 1 - Math.floor(t * th)][Math.floor(s * tw)]
        if (ch === '.') continue
        if (!RGB[ch]) throw new Error(`unknown palette key '${ch}'`)
        out.set(y * W + x, ch)
      }
    }
  }
  return out
}

function setPx(data, i, rgb) {
  data[i * 4] = rgb[0]
  data[i * 4 + 1] = rgb[1]
  data[i * 4 + 2] = rgb[2]
  data[i * 4 + 3] = 255
}

/** Paints an object: each part gets a 1 px ink ring, then its fills. */
function paintObject(obj) {
  const data = Buffer.alloc(W * H * 4)
  for (const part of obj.parts) {
    const px = rasterPart(part)
    for (const i of px.keys()) {
      for (const d of [1, -1, W, -W]) if (!px.has(i + d)) setPx(data, i + d, INK)
    }
    for (const [i, ch] of px) setPx(data, i, RGB[ch])
  }
  return data
}

// ---- the shelf, left to right ------------------------------------------------
// Depth bands: boards and floppies lean on the back wall (w ~0.8-1), boxes and
// the mahjong wall stand mid-shelf, chessmen, chips and the phone sit up front.
// Positions are front-lip u values; an object at depth w appears 54w px left.
const tile = (x, w, glyph) => box(x, w, 10, 14, 0.08, { front: glyph, side: twoTone(2, 'W', 'G'), top: 'h' })
const wallLayer = (x, layer) => box(x, 0.6, 40, 6, 0.14, { front: WALL_FRONT, side: twoTone(2, 'w', 'G'), top: WALL_TOP }, 6 * layer)
const cart = (x, w, label, trim) => box(x, w, 20, 25, 0.14, { front: cartridge(label, trim), side: twoTone(2, 'H', 'a'), top: 'H' })

// Objects are listed (and rendered) left to right; where two overlap, the one
// on the right is the one in front, so the DOM order is also the paint order.
const OBJECTS = [
  {
    id: 'chess',
    parts: [
      {
        faces: [
          face(at(295, 0, 0.9), mul(AX_W, -0.05), add(mul(AX_V, 40), mul(AX_W, 0.08)), 'I'),
          upright(295, 0.85, 40, 40, BOARD, 0.08),
        ],
      },
      billboard(297, 0.46, ROOK),
      billboard(305, 0.34, KING),
      billboard(315, 0.52, KNIGHT),
      billboard(324, 0.26, PAWN(true)),
      billboard(330, 0.44, QUEEN),
      billboard(335, 0.3, PAWN(false)),
    ],
  },
  {
    id: 'mahjong',
    parts: [
      wallLayer(348, 0),
      wallLayer(348, 1),
      tile(345, 0.28, ZHONG),
      tile(356, 0.22, BAMBOO),
      tile(367, 0.18, DOTS),
    ],
  },
  {
    id: 'solitaire',
    parts: [box(394, 0.52, 18, 26, 0.16, { front: CARD_BOX, side: twoTone(2, 'B', 'n'), top: 'b' })],
  },
  {
    id: 'blackjack',
    parts: [
      { faces: [upright(400, 0.36, 12, 16, ACE_SPADES, 0.08)] },
      { faces: [upright(409, 0.3, 12, 16, KING_HEARTS, 0.05)] },
      billboard(431, 0.36, BLACK_CHIPS),
      billboard(420, 0.2, RED_CHIPS),
    ],
  },
  {
    id: 'minesweeper',
    parts: [
      { faces: [upright(443, 0.94, 26, 27, floppy(PLAIN_LABEL, 'z', 'Z', 'z'), 0.05)] },
      { faces: [upright(450, 0.82, 26, 27, floppy(MINE_LABEL, 'D', 'd', 'i'), 0.1)] },
    ],
  },
  {
    id: 'snake',
    parts: [box(472, 0.26, 13, 28, 0.07, { front: PHONE, side: twoTone(2, 'o', 'm'), top: 'o' })],
  },
  { id: 'breakout', parts: [cart(497, 0.74, BREAKOUT_LABEL, 'T')] },
  { id: 'pong', parts: [cart(514, 0.34, PONG_LABEL, 'O')] },
]

/** Grows the opaque area by `radius` (diamond kernel) in `rgb`, under the art. */
function grow(src, radius, rgb) {
  const out = Buffer.from(src)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (src[(y * W + x) * 4 + 3]) continue
      let hit = false
      for (let dy = -radius; dy <= radius && !hit; dy++) {
        for (let dx = -radius; dx <= radius && !hit; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > radius) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          if (src[(ny * W + nx) * 4 + 3]) hit = true
        }
      }
      if (hit) setPx(out, y * W + x, rgb)
    }
  }
  return out
}

const save = (data, file) =>
  sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toFile(join(outDir, file))

async function main() {
  await mkdir(outDir, { recursive: true })
  for (const obj of OBJECTS) {
    const rest = paintObject(obj)
    await save(rest, `${obj.id}.png`)
    await save(grow(rest, 1, HIGHLIGHT), `${obj.id}2.png`)
    await save(grow(rest, 2, HIGHLIGHT), `${obj.id}3.png`)
    console.log(`drew ${obj.id}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
