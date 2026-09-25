// src/components/room/card-art.ts
/**
 * Pixel art for the desk playing cards, painted into an RGBA buffer so it can be
 * turned into an image in the browser and proofed in Node. One art pixel is one
 * CSS pixel on the monitor; bigger views scale by whole numbers.
 */
import { isRed, rankLabel, type Card, type Suit } from '@/lib/games/cards'

export const CARD_W = 45
export const CARD_H = 63

export type CardFace = Card | 'back'

type RGBA = readonly [number, number, number, number]
const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a]

const OUTLINE = hex('#3a3028')
const FACE = hex('#fbf7ee')
const FACE_LIGHT = hex('#ffffff')
const FACE_SHADE = hex('#e6dccb')
const RED = hex('#b3372c')
const BLACK = hex('#2a2520')

// 5x7 rank glyphs; '10' is condensed into one 8-wide glyph.
const GLYPHS: Record<string, string[]> = {
  A: ['..#..', '.#.#.', '#...#', '#...#', '#####', '#...#', '#...#'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '10': ['.#...##.', '##..#..#', '.#..#..#', '.#..#..#', '.#..#..#', '.#..#..#', '###..##.'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
}

const PIP: Record<Suit, string[]> = {
  H: ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
  D: ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
  S: ['...#...', '..###..', '.#####.', '#######', '#######', '.#.#.#.', '..###..'],
  C: ['..###..', '..###..', '##.#.##', '#######', '##.#.##', '...#...', '..###..'],
}

const BIG_PIP: Record<Suit, string[]> = {
  H: [
    '.###...###.',
    '#####.#####',
    '###########',
    '###########',
    '###########',
    '.#########.',
    '..#######..',
    '...#####...',
    '....###....',
    '.....#.....',
  ],
  D: [
    '.....#.....',
    '....###....',
    '...#####...',
    '..#######..',
    '.#########.',
    '###########',
    '.#########.',
    '..#######..',
    '...#####...',
    '....###....',
    '.....#.....',
  ],
  S: [
    '.....#.....',
    '....###....',
    '...#####...',
    '..#######..',
    '.#########.',
    '###########',
    '###########',
    '###########',
    '.###.#.###.',
    '.....#.....',
    '...#####...',
  ],
  C: [
    '....###....',
    '...#####...',
    '...#####...',
    '....###....',
    '.##..#..##.',
    '###########',
    '###########',
    '.##..#..##.',
    '.....#.....',
    '....###....',
    '...#####...',
  ],
}

// Pip columns and rows (top-left corner of a 7x7 pip); rows below the middle are drawn upside down.
const L = 9
const C = 19
const R = 29
const LAYOUTS: Record<number, [number, number][]> = {
  2: [[C, 12], [C, 44]],
  3: [[C, 12], [C, 28], [C, 44]],
  4: [[L, 12], [R, 12], [L, 44], [R, 44]],
  5: [[L, 12], [R, 12], [C, 28], [L, 44], [R, 44]],
  6: [[L, 12], [R, 12], [L, 28], [R, 28], [L, 44], [R, 44]],
  7: [[L, 12], [R, 12], [C, 20], [L, 28], [R, 28], [L, 44], [R, 44]],
  8: [[L, 12], [R, 12], [C, 20], [L, 28], [R, 28], [C, 36], [L, 44], [R, 44]],
  9: [[L, 12], [R, 12], [L, 23], [R, 23], [C, 28], [L, 33], [R, 33], [L, 44], [R, 44]],
  10: [[L, 12], [R, 12], [C, 17], [L, 23], [R, 23], [L, 33], [R, 33], [C, 39], [L, 44], [R, 44]],
}

class Canvas {
  readonly px: Uint8ClampedArray<ArrayBuffer> = new Uint8ClampedArray(new ArrayBuffer(CARD_W * CARD_H * 4))
  set(x: number, y: number, c: RGBA) {
    if (x < 0 || y < 0 || x >= CARD_W || y >= CARD_H) return
    const i = (y * CARD_W + x) * 4
    this.px[i] = c[0]; this.px[i + 1] = c[1]; this.px[i + 2] = c[2]; this.px[i + 3] = c[3]
  }
  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  /** `flip` turns the bitmap upside down in place; `rotate` mirrors it to the opposite corner of the card. */
  stamp(bmp: string[], x: number, y: number, c: RGBA, opts: { flip?: boolean; rotate?: boolean } = {}) {
    const h = bmp.length
    for (let j = 0; j < h; j++) {
      const row = bmp[j]
      for (let i = 0; i < row.length; i++) {
        if (row[i] !== '#') continue
        if (opts.rotate) this.set(CARD_W - 1 - (x + i), CARD_H - 1 - (y + j), c)
        else if (opts.flip) this.set(x + (row.length - 1 - i), y + (h - 1 - j), c)
        else this.set(x + i, y + j, c)
      }
    }
  }
}

/** The rounded card body: 1px outline with pixel-rounded corners and a soft bevel. */
function body(cv: Canvas, fill: RGBA, light: RGBA, shade: RGBA) {
  const W = CARD_W
  const H = CARD_H
  cv.rect(2, 0, W - 4, 1, OUTLINE)
  cv.rect(2, H - 1, W - 4, 1, OUTLINE)
  cv.rect(0, 2, 1, H - 4, OUTLINE)
  cv.rect(W - 1, 2, 1, H - 4, OUTLINE)
  for (const [x, y] of [[1, 1], [W - 2, 1], [1, H - 2], [W - 2, H - 2]]) cv.set(x, y, OUTLINE)
  cv.rect(1, 2, W - 2, H - 4, fill)
  cv.rect(2, 1, W - 4, H - 2, fill)
  cv.rect(2, 1, W - 4, 1, light)
  cv.rect(1, 2, 1, H - 4, light)
  cv.rect(2, H - 2, W - 4, 1, shade)
  cv.rect(W - 2, 2, 1, H - 4, shade)
}

function paintBack(cv: Canvas) {
  body(cv, hex('#f4ead6'), hex('#fffaf0'), hex('#dccbb0'))
  const panel = hex('#8e3a2c')
  const edge = hex('#6a2a20')
  const lattice = hex('#a84c3a')
  const knot = hex('#e8c890')
  const x0 = 4
  const y0 = 4
  const w = CARD_W - 8
  const h = CARD_H - 8
  cv.rect(x0, y0, w, h, edge)
  cv.rect(x0 + 1, y0 + 1, w - 2, h - 2, panel)
  for (let v = 1; v < h - 1; v++) {
    for (let u = 1; u < w - 1; u++) {
      const a = (u + v) % 6 === 0
      const b = (u - v + 600) % 6 === 0
      if (a && b) cv.set(x0 + u, y0 + v, knot)
      else if (a || b) cv.set(x0 + u, y0 + v, lattice)
    }
  }
}

function paintFace(cv: Canvas, card: Card) {
  body(cv, FACE, FACE_LIGHT, FACE_SHADE)
  const ink = isRed(card.suit) ? RED : BLACK
  const glyph = GLYPHS[rankLabel(card.rank)]
  const gw = glyph[0].length
  // Index: rank and suit side by side, repeated upside down in the opposite corner.
  for (const rotate of [false, true]) {
    cv.stamp(glyph, 3, 3, ink, { rotate })
    cv.stamp(PIP[card.suit], 3 + gw + 1, 3, ink, { rotate })
  }
  if (card.rank === 1) {
    const big = BIG_PIP[card.suit]
    cv.stamp(big, Math.floor((CARD_W - big[0].length) / 2), Math.floor((CARD_H - big.length) / 2), ink)
    return
  }
  if (card.rank <= 10) {
    for (const [x, y] of LAYOUTS[card.rank]) cv.stamp(PIP[card.suit], x, y, ink, { flip: y > 28 })
    return
  }
  paintCourt(cv, card, ink)
}

// Court cards: a framed, double-headed portrait. Each half is 31x18; the lower half is the upper rotated.
const COURT_PALETTE: Record<string, RGBA> = {
  o: hex('#2a2520'),
  s: hex('#ecc8a0'),
  S: hex('#c89a70'),
  y: hex('#d8a038'),
  Y: hex('#a8742a'),
  w: hex('#fbf7ee'),
  h: hex('#5a3a2a'),
  g: hex('#c8c0b0'),
  b: hex('#4a5a86'),
}

const COURT: Record<11 | 12 | 13, string[]> = {
  // Jack: feathered cap, young face, collar.
  11: [
    '...............................',
    '..........oooooooo.............',
    '.........oyyyyyyyyo...ww.......',
    '........oyyyyyyyyyyo.www.......',
    '........oRRRRRRRRRRRoww........',
    '........ohhsssssshhho..........',
    '........ohsssssssssho..........',
    '........ohsosssssosho..........',
    '........ohssssSsssso...........',
    '.........osssssssso............',
    '.........osssoossso............',
    '..........ossssssoo............',
    '......oooowwwwwwwwwoooo........',
    '....ooRRRwbbwwwwwbbwRRRoo......',
    '...oRRRRRwwbbwwwbbwwRRRRRo.....',
    '..oRRRRRRRwwwbbbwwwRRRRRRRo....',
    '..oRRRyRRRRwwwbwwwRRRRyRRRo....',
    '..oRRyyyRRRRwwwwwRRRRyyyRRo....',
  ],
  // Queen: tall crown, long hair.
  12: [
    '..........y...y...y............',
    '..........yo.oyo.oy............',
    '.........oyyyyyyyyyo...........',
    '.........oywyRyywyyo...........',
    '........ohyyyyyyyyyho..........',
    '.......ohhssssssssshho.........',
    '.......ohsssssssssssho.........',
    '.......ohssossssossssho........',
    '.......ohssssssSsssssho........',
    '.......ohhsssRRRssssshho.......',
    '......ohhhsssssssssshhho.......',
    '......ohhhhosssssssohhhho......',
    '.....ohhhoowwwwwwwwoohhhho.....',
    '....oRRRRRwbwwwwwwbwRRRRRo.....',
    '...oRRRRRRwwbbwwbbwwRRRRRRo....',
    '..oRRRyRRRRwwwbbwwwRRRRyRRRo...',
    '..oRRyyyRRRRwwwwwwRRRRyyyRRo...',
    '..oRRRyRRRRRRwwwwRRRRRRyRRRo...',
  ],
  // King: broad crown, beard.
  13: [
    '.........y..y..y..y............',
    '.........yo.y..y.oy............',
    '........oyyyyyyyyyyo...........',
    '........oyRywyRywyRyo..........',
    '........oyyyyyyyyyyyo..........',
    '........ohssssssssssho.........',
    '........osssssssssssso.........',
    '........ossossssosssso.........',
    '........osssssSssssssso........',
    '........oggsssssssssggo........',
    '........ogggRRRRRRgggo.........',
    '........oggggggggggggo.........',
    '......oooogggggggggoooo........',
    '....ooRRRRwggggggggwRRRoo......',
    '...oRRRRRRwwgggggggwwRRRRo.....',
    '..oRRRyRRRRwwwggggwwwRRyRRo....',
    '..oRRyyyRRRRwwwwwwwwRRyyyRo....',
    '..oRRRyRRRRRRwwwwwwRRRRyRRo....',
  ],
}

function paintCourt(cv: Canvas, card: Card, ink: RGBA) {
  const fx = 6
  const fy = 12
  const fw = 33
  const fh = 39
  cv.rect(fx, fy, fw, fh, ink)
  cv.rect(fx + 1, fy + 1, fw - 2, fh - 2, hex('#f1e6d0'))
  const art = COURT[card.rank as 11 | 12 | 13]
  const robe = isRed(card.suit) ? RED : hex('#3a4a6a')
  for (const rotate of [false, true]) {
    for (let j = 0; j < art.length; j++) {
      for (let i = 0; i < art[j].length; i++) {
        const k = art[j][i]
        if (k === '.') continue
        const col = k === 'R' ? robe : COURT_PALETTE[k]
        const x = fx + 1 + i
        const y = fy + 1 + j
        if (rotate) cv.set(CARD_W - 1 - x, CARD_H - 1 - y, col)
        else cv.set(x, y, col)
      }
    }
  }
  cv.rect(fx + 1, 31, fw - 2, 1, ink)
  // Suit pip tucked beside each head.
  cv.stamp(PIP[card.suit], fx + fw - 9, fy + 2, ink)
  cv.stamp(PIP[card.suit], fx + fw - 9, fy + 2, ink, { rotate: true })
}

/** RGBA pixels (CARD_W x CARD_H) for a card face or the shared back. */
export function paintCard(face: CardFace): Uint8ClampedArray<ArrayBuffer> {
  const cv = new Canvas()
  if (face === 'back') paintBack(cv)
  else paintFace(cv, face)
  return cv.px
}
