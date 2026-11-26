// Draws the shelf's VHS sleeves and the desk games' objects (chess, mahjong,
// solitaire, blackjack, minesweeper, snake, pong, breakout) as pixel art on the
// full 1408x768 stage canvas, in the same rest + two-step highlight format as
// the hand-drawn shelf sources, then hands them to scripts/extract-shelf.mjs
// for cropping. The art itself (textures and palette) lives in
// scripts/shelf-art.mjs, shared with the desk close-up's shelf.
//
//   node scripts/draw-shelf-games.mjs && node scripts/extract-shelf.mjs && npm run lighting
//
// The objects live in the shelf's own 3D space, so they stand at different
// depths and overlap like the catan boxes and books do:
//   u  along the shelf, in stage px measured on the front lip
//   v  height above the shelf floor, in px
//   w  depth, 0 at the front lip and 1 at the back wall
// `proj` maps that space onto the stage with the oblique projection measured
// off background.png (the floor recedes up and to the left). Each object is a
// list of parts painted back to front; a part is one or more textured faces
// (a box's left side, top and front, a board leaning on the wall, a chess
// piece). Every part gets a 1 px ink ring, so a front part keeps its edge
// where it overlaps the one behind. The #f6da9c highlight outline is then grown
// by 1 px (frame 2) and 2 px (frame 3), like catan and books.
//
// Layout: the tall things (chessboard, floppies, a cartridge) lean on the back
// wall and the small ones stand in front, packed from the books (x ~255) to
// about x 465 on the front lip, which leaves the last quarter of the shelf
// (to the right wall at x ~594) bare.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as art from './shelf-art.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'assets', 'pixel-art', 'shelf')

const W = 1408
const H = 768
const INK = [0, 0, 0]
const HIGHLIGHT = [0xf6, 0xda, 0x9c]
const { RGB } = art

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


// ---- the shelf ---------------------------------------------------------------
// Positions are stage x of an object's front-left-bottom corner at its own
// depth w. Objects are listed (and rendered) in paint order: where two
// overlap, the later one is in front, so the DOM order is also the paint order.
const twoTone = art.twoTone
const tile = (x, w, glyph) => box(x, w, art.TILE_W, art.TILE_H, 0.1, { front: glyph, side: art.TILE_SIDE, top: art.TILE_TOP })
const cart = (x, w, label, trim) =>
  box(x, w, art.CART_W, art.CART_H, 0.14, { front: art.cartridge(label, trim), side: twoTone(8, 'H', 'a', 2), top: twoTone(8, 'T', 'H', 2) })
/** A board or disk leaning on the wall: its face plus a strip of edge on its left. */
const leaning = (x, w, n, tex, lean, edge) => ({
  faces: [
    face(at(x, 0, w + 0.04), mul(AX_W, -0.04), add(mul(AX_V, n), mul(AX_W, lean)), edge),
    upright(x, w, n, n, tex, lean),
  ],
})

const OBJECTS = [
  {
    id: 'vhs',
    parts: [box(274, 0.3, art.VHS_W, art.VHS_H, 0.34, { front: art.VHS_FRONT, side: art.VHS_COVER, top: art.VHS_TOP })],
  },
  {
    id: 'chess',
    parts: [
      leaning(304, 0.92, art.BOARD_N, art.BOARD, 0.05, 'I'),
      billboard(311, 0.52, art.KING),
      billboard(323, 0.44, art.BISHOP),
      billboard(303, 0.26, art.ROOK),
      billboard(328, 0.3, art.QUEEN),
      billboard(315, 0.1, art.PAWN_W),
      billboard(336, 0.12, art.KNIGHT),
    ],
  },
  {
    id: 'minesweeper',
    parts: [
      leaning(346, 0.86, art.FLOPPY_N, art.floppy(art.PLAIN_LABEL, 'z', 'Z', '6'), 0.05, 'Z'),
      leaning(357, 0.72, art.FLOPPY_N, art.floppy(art.MINE_LABEL, 'D', 'd', 'i'), 0.08, 'd'),
    ],
  },
  {
    id: 'solitaire',
    parts: [
      { faces: [upright(409, 0.9, 18, 8, art.CARD_PEEK, 0.02)].map((f) => ({ ...f, o: [f.o[0] + 3, f.o[1] - art.CARDBOX_H + 2] })) },
      box(406, 0.86, art.CARDBOX_W, art.CARDBOX_H, 0.14, { front: art.CARD_BOX, side: twoTone(6, 'B', 'j'), top: twoTone(6, 'b', 'n') }),
    ],
  },
  { id: 'breakout', parts: [cart(424, 0.86, art.BREAKOUT_LABEL, 'O')] },
  {
    id: 'snake',
    parts: [box(389, 0.5, art.PHONE_W, art.PHONE_H, 0.1, { front: art.PHONE, side: twoTone(4, 'o', 'm'), top: 'o' })],
  },
  {
    id: 'mahjong',
    parts: [
      tile(352, 0.22, art.ZHONG),
      tile(365, 0.15, art.BAMBOO),
      tile(378, 0.08, art.DOTS),
    ],
  },
  {
    id: 'blackjack',
    parts: [
      { faces: [upright(392, 0.3, art.CARD_W, art.CARD_H, art.ACE_SPADES, 0.1)] },
      { faces: [upright(403, 0.24, art.CARD_W, art.CARD_H, art.KING_HEARTS, 0.07)] },
      billboard(393, 0.06, art.BLACK_CHIPS),
      billboard(410, 0.04, art.RED_CHIPS),
    ],
  },
  { id: 'pong', parts: [cart(448, 0.3, art.PONG_LABEL, 'R')] },
]

// Every textured face must be a rectangle of known palette chars.
for (const obj of OBJECTS) for (const part of obj.parts) for (const f of part.faces) {
  if (typeof f.tex === 'string') continue
  const len = f.tex[0].length
  f.tex.forEach((row, r) => {
    if (row.length !== len) throw new Error(`${obj.id}: texture row ${r} is ${row.length} wide, not ${len}`)
  })
}

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
