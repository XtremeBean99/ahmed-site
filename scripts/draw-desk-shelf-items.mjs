import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// VHS: two tapes and a boxed film lying in a stack, spines out.
item('vhs', 'vhs', (it) => {
  const x = 179
  const W = 46
  const H = 8
  // Bottom tape: black shell, white label.
  let y = FLOOR + 1 - H
  part(it, (l) => {
    panel(l, x, y, W, H, { fill: '2b2729', light: '423b3d', dark: '1a1718' })
    l.rect(x + 5, y + 2, 34, 4, 'e8e2d2')
    l.rect(x + 7, y + 3, 18, 1, '3d5d8f')
    l.rect(x + 7, y + 4, 10, 1, '3d5d8f')
  })
  side(it, x, y, W, H, '141213', 2, 1)
  // The boxed film: a red sleeve with VHS on it.
  y -= H + 2
  part(it, (l) => {
    panel(l, x - 2, y, W + 1, H + 1, { fill: 'b8442f', light: 'd4613f', dark: '832a1c' })
    l.rect(x - 1, y + 1, 9, H - 1, '2b2729')
    text3(l, x + 12, y + 2, 'VHS', 'f4ead2')
    l.rect(x + 26, y + 3, 14, 1, 'f4ead2')
    l.rect(x + 26, y + 5, 9, 1, 'e2b04a')
  })
  side(it, x - 2, y, W + 1, H + 1, '6a2114', 2, 1)
  // Top tape: orange label.
  y -= H + 1
  part(it, (l) => {
    panel(l, x + 2, y, W - 4, H, { fill: '2b2729', light: '423b3d', dark: '1a1718' })
    l.rect(x + 6, y + 2, 30, 4, 'e7a24a')
    l.rect(x + 8, y + 3, 14, 1, '5a2c10')
  })
  side(it, x + 2, y, W - 4, H, '141213', 2, 1)
})

// Chess: the board leaning on the wall, chessmen in front of it.
const KING = ['....X....', '...XWw...', '....X....', '...XWw...', '..XWWWw..', '..XWWWw..', '...XWw...', '..KKKKK..', '...XWw...', '...XWw...', '...XWw...', '...XWw...', '...XWw...', '..XWWWw..', '..KKKKK..', '.XWWWWWw.', 'XWWWWWWWw', 'XWWWWWWwv']
const QUEEN = ['.e..e..e.', '.eE.E.Ef.', '..eEEEf..', '...eEf...', '..KKKKK..', '...eEf...', '...eEf...', '...eEf...', '...eEf...', '..eEEEf..', '..KKKKK..', '.eEEEEEf.', 'eEEEEEEEf', 'eEEEEEEff']
const KNIGHT = ['...ee.....', '..eEEf....', '.eEEEEf...', 'eEKEEEEf..', 'EEEEEEEEf.', 'eEEEEEEEf.', '.ff.eEEEf.', '...eEEEEf.', '...eEEEEf.', '..eEEEEEf.', '.KKKKKKKK.', '.eEEEEEEf.', 'eEEEEEEEEf']
const ROOK = ['XW.XWW.Ww', 'XWWWWWWWw', '.XWWWWWw.', '..XWWWw..', '..XWWWw..', '..XWWWw..', '..XWWWw..', '.KKKKKKK.', '.XWWWWWw.', 'XWWWWWWWw', 'XWWWWWWwv']
const PAWN_W = ['..XWw..', '.XWWWw.', '.XWWWw.', '..XWw..', '..XWw..', '.KKKKK.', '..XWw..', '.XWWWw.', 'XWWWWWw', 'XWWWWwv']
const PAWN_B = ['..eEf..', '.eEEEf.', '.eEEEf.', '..eEf..', '..eEf..', '.KKKKK.', '..eEf..', '.eEEEf.', 'eEEEEEf', 'eEEEEff']
const CHESSMEN = { X: 'fbf4e2', W: 'ecdcbc', w: 'cbb894', v: 'a08a68', e: '7a625c', E: '4d3b38', f: '2e2224', K: INK }
item('chess', 'game', (it) => {
  const bx = 229
  const by = FLOOR - 42
  part(it, (l) => {
    panel(l, bx, by, 40, 40, { fill: '5c3a26', light: '7a4e33', dark: '3e2619' })
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) l.rect(bx + 4 + c * 4, by + 4 + r * 4, 4, 4, (r + c) % 2 ? '9c6238' : 'e6c391')
    l.rect(bx + 3, by + 3, 34, 1, '3e2619')
    l.rect(bx + 3, by + 3, 1, 34, '3e2619')
  })
  side(it, bx, by, 40, 40, '3e2619', 2, 1)
  const piece = (rows, x) => part(it, (l) => l.stamp(x, FLOOR + 1 - rows.length, rows, CHESSMEN))
  piece(ROOK, bx - 1)
  piece(PAWN_W, bx + 8)
  piece(KING, bx + 14)
  piece(QUEEN, bx + 22)
  piece(PAWN_B, bx + 30)
  piece(KNIGHT, bx + 34)
})

// Mahjong: a two-high wall of tiles lying face down, three standing on it.
const tileGlyphs = {
  zhong: ['...R....', '...R....', 'RRRRRRR.', 'R..R..R.', 'R..R..R.', 'RRRRRRR.', '...R....', '...R....', '...r....'],
  bamboo: ['.J...J..', '.J...J..', '.g...g..', '.J.J.J..', '.J.J.J..', '.g.g.g..', '.J.J.J..', '.J.J.J..', '.g.g.g..'],
  dots: ['..BBB...', '.BqRqB..', '.BRrRB..', '.BqRqB..', '..BBB...', '........', '.R...R..', '........', '.R...R..'],
}
const TILE_INK = { R: 'c0463a', r: '8a2e28', J: '62a456', g: '2b5a3a', B: '3d5d8f', q: 'e07a62' }
item('mahjong', 'game', (it) => {
  const x = 275
  for (let layer = 0; layer < 2; layer++) {
    const y = FLOOR + 1 - (layer + 1) * 7
    part(it, (l) => {
      for (let t = 0; t < 5; t++) {
        const tx = x + layer + t * 8
        l.rect(tx, y, 8, 3, '3f7a52')
        l.rect(tx, y, 8, 1, '58966a')
        l.rect(tx, y + 3, 8, 3, 'ecdcbc')
        l.rect(tx, y + 5, 8, 1, 'cbb894')
        l.rect(tx + 7, y, 1, 3, '2b5a3a')
        l.rect(tx + 7, y + 3, 1, 3, 'a08a68')
      }
    })
  }
  ;['zhong', 'bamboo', 'dots'].forEach((g, i) => {
    const tx = x + 3 + i * 12
    const ty = FLOOR + 1 - 14 - 15
    part(it, (l) => {
      panel(l, tx, ty, 11, 15, { fill: 'ecdcbc', light: 'fbf4e2', dark: 'cbb894' })
      l.rect(tx, ty + 13, 11, 2, '3f7a52')
      l.stamp(tx + 2, ty + 2, tileGlyphs[g], TILE_INK)
    })
  })
})

// Solitaire: a tuck box of cards, blue lattice back, a spade in the window.
item('solitaire', 'game', (it) => {
  const x = 318
  const y = FLOOR + 1 - 31
  part(it, (l) => {
    panel(l, x, y, 18, 31, { fill: '3d5d8f', light: '6f93c6', dark: '2a4170' })
    l.rect(x, y, 18, 4, '6f93c6')
    l.rect(x, y + 4, 18, 1, '2a4170')
    l.rect(x + 6, y + 2, 6, 2, '2a4170')
    for (let r = y + 6; r < y + 29; r++) for (let c = x + 2; c < x + 16; c++) if ((r + c) % 4 === 0 || (r - c + 400) % 4 === 0) l.set(c, r, '6f93c6')
    l.rect(x + 5, y + 12, 8, 9, 'fbf4e2')
    l.stamp(x + 6, y + 13, ['..#...', '.###..', '#####.', '#####.', '..#...', '.###..'], { '#': '1a1718' })
  })
  side(it, x, y, 18, 31, '22355c', 2, 1)
})

// Blackjack: the ace of spades and king of hearts leaning together, chip stacks.
const card = (l, x, y, rank, pip, colour) => {
  panel(l, x, y, 13, 19, { fill: 'fbf4e2', light: 'ffffff', dark: 'cbb894' })
  l.stamp(x + 2, y + 2, rank, { '#': colour })
  l.stamp(x + 4, y + 9, pip, { '#': colour })
}
const chips = (it, x, n, side, shade, spot) => part(it, (l) => {
  for (let i = 0; i < n; i++) {
    const y = FLOOR - 2 - i * 3
    l.rect(x, y, 9, 2, side)
    l.rect(x, y + 2, 9, 1, shade)
    for (const c of [1, 4, 7]) l.rect(x + c, y, 1, 2, spot)
  }
})
item('blackjack', 'game', (it) => {
  const x = 340
  part(it, (l) => card(l, x, FLOOR - 21, ['.##.', '#..#', '####', '#..#', '#..#'], ['..#..', '.###.', '#####', '#####', '..#..', '.###.'], '1a1718'))
  part(it, (l) => card(l, x + 8, FLOOR - 19, ['#..#', '#.#.', '##..', '#.#.', '#..#'], ['.#.#.', '#####', '#####', '.###.', '..#..'], 'c0463a'))
  chips(it, x - 1, 3, '2a2a30', '17171b', 'd9d2c0')
  chips(it, x + 12, 4, 'c0463a', '8a2e28', 'fbf4e2')
})

// Minesweeper: two 3.5" floppies leaning on the wall, a mine on the front one's label.
function floppy(l, x, y, body, lit, shade, label) {
  panel(l, x, y, 26, 27, { fill: body, light: lit, dark: shade })
  l.rect(x + 7, y, 13, 9, 'c0c2ca') // metal shutter
  l.rect(x + 19, y, 1, 9, '8a8c97')
  l.rect(x + 7, y + 8, 13, 1, '8a8c97')
  l.rect(x + 13, y + 1, 4, 6, '5c5e68')
  l.rect(x + 3, y + 11, 20, 14, 'ebe4cf') // label
  l.rect(x + 3, y + 11, 20, 2, 'c7bfa7')
  l.rect(x + 1, y + 24, 2, 2, shade) // write-protect notch
  l.stamp(x + 4, y + 13, label, { K: INK, S: 'c0c2ca', R: 'c0463a', x: '2d6d8f', z: '6b3f6e' })
}
item('minesweeper', 'game', (it) => {
  const x = 362
  part(it, (l) => floppy(l, x + 7, FLOOR - 30, '6b3f6e', '8a5a8d', '4a2a4d',
    ['', '', '.zzzzzzzzzzzzz', '', '.zzzzzzzzz', '', '.zzzzzzzzzzzz'].map((r) => r.padEnd(17, '.'))))
  part(it, (l) => floppy(l, x, FLOOR + 1 - 27, '4f5262', '6a6e80', '363946', [
    '......K..........', '....K.K.K....RR..', '.....KKK....RRR..', '...KKKSKKK...RR..',
    '.....KKK......K..', '....K.K.K.....K..', '......K......KKK.', '.................',
    '.xxxxxxxxxxxxxx..', '.................', '.xxxxxxxxx.......',
  ]))
  side(it, x, FLOOR + 1 - 27, 26, 27, '2a2c36', 1, 0)
})

// Snake: a candybar phone with snake on its green screen.
item('snake', 'game', (it) => {
  const x = 397
  const y = FLOOR + 1 - 33
  part(it, (l) => {
    panel(l, x, y, 14, 33, { fill: '44547a', light: '6a7b9e', dark: '2c3753' })
    l.rect(x + 5, y + 2, 4, 1, '2c3753') // earpiece
    l.rect(x + 2, y + 4, 10, 10, '2c3753')
    l.rect(x + 3, y + 5, 8, 8, 'a7ba78')
    l.stamp(x + 3, y + 5, ['........', '.pppp.p.', '....p...', '....p...', '....ppp.', '........', '........', '........'], { p: '3c4824' })
    l.rect(x + 5, y + 15, 4, 3, '6a7b9e') // nav key
    l.rect(x + 6, y + 16, 2, 1, '2c3753')
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) l.rect(x + 2 + c * 4, y + 19 + r * 2, 2, 1, '6a7b9e')
  })
  side(it, x, y, 14, 33, '1f283d', 2, 1)
})

// Breakout and pong: two Atari-style cartridges, grip ridges up top, a picture label.
const CART = { T: '77706a', X: 'fbf4e2', S: 'c0c2ca', O: 'd98a3c', Y: 'e2c45a', J: '62a456', R: 'c0463a' }
function cartridge(it, x, label, trim) {
  const y = FLOOR + 1 - 31
  part(it, (l) => {
    panel(l, x, y, 20, 31, { fill: '37312f', light: '5a514c', dark: '221e1d' })
    for (let r = 2; r < 14; r += 2) l.rect(x + 2, y + r, 16, 1, '221e1d')
    l.rect(x + 2, y + 15, 16, 13, trim)
    l.rect(x + 3, y + 16, 14, 11, '1a1616')
    l.stamp(x + 3, y + 16, label, CART)
  })
  side(it, x, y, 20, 31, '1a1616', 2, 1)
}
item('breakout', 'game', (it) => cartridge(it, 413, [
  'RRR.RRR.RRR.RR', 'OOO.OOO.OOO.OO', 'YYY.YYY.....YY', 'JJJ.J...JJJ.JJ', '..............',
  '......X.......', '..............', '..............', '....XXXXX.....', '..............',
], 'd98a3c'))
item('pong', 'game', (it) => cartridge(it, 434, [
  '.......T......', '.X.....T......', '.X.....T......', '.X.....T....X.', '.......T....X.',
  '.......T..S.X.', '.......T......', '.......T......', 'OOOOOOOOOOOOOO', '..............',
], 'c0463a'))

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
