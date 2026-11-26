// Shared pixel art for the shelf's VHS and desk-game objects, used by both
// scripts/draw-shelf-games.mjs (the room's oblique shelf) and
// scripts/draw-desk-shelf-items.mjs (the desk close-up, seen straight on).
//
// A texture is string[] (row 0 at the top, one char per pixel, '.' clear) or a
// single palette char for a flat fill. In the room 1 texel is 1 stage px; in
// the close-up 1 texel is 1 art px (2 stage px), which keeps both shelves in
// proportion with their books.

export const PALETTE = {
  K: '000000', // ink
  // ivory (white chessmen, mahjong faces, cards)
  X: 'fffaec', W: 'efe1c4', w: 'd3c09c', v: 'a8916d', V: '7d6a4e',
  // ebony (black chessmen)
  e: '8a7069', E: '5a4542', f: '3a2a2c', 1: '221819',
  // chessboard
  Q: 'ecca98', 2: 'd8b27c', U: 'a4673c', 3: '87522d',
  F: '6b4229', M: '8d5b38', I: '3e2619', 4: 'b07444',
  // mahjong backs
  G: '3f7a52', g: '2b5a3a', h: '5f9e70',
  // reds
  R: 'c8473a', r: '8e2c26', 5: 'e8806a',
  // blues
  b: '7da0d0', B: '4467a0', n: '2d4a7d', j: '1f3360',
  // chips
  C: '3b3b44', c: '24242a', y: 'e2dccb', k: '5a5a66',
  // floppies
  D: '565a6c', d: '3a3d4b', i: '737890', S: 'cdd0d8', s: '8f929e', t: '5c5e68',
  L: 'f1ead6', l: 'cfc6ad', x: '2d6d8f', z: '74457a', Z: '4f2c53', 6: '9b6aa0',
  // phone
  o: '7083a8', N: '4a5a82', m: '2e3956', P: 'b3c682', p: '3f4c26', 7: 'cfdf9e',
  // cartridges
  H: '6a605a', A: '3a3432', a: '231f1e', T: '857e76',
  O: 'e0903f', Y: 'e8c95c', J: '66aa58',
  // VHS sleeves
  9: '1e1b1c', 0: '3a3536', '@': '5b9c3c', '#': '3c7428', '%': '9ccf5a',
  '&': '7fb6e0', '*': 'b9d9f0', '+': 'f0d050', '=': 'e4ddcb', '-': 'b5ad99',
}

// ---- helpers -------------------------------------------------------------------
export const grid = (w, h, ch) => Array.from({ length: h }, () => Array(w).fill(ch))
export function rect(g, x, y, w, h, ch) {
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (g[r]?.[c] !== undefined) g[r][c] = ch
  return g
}
export function stamp(g, x, y, rows) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.' && g[y + r]?.[x + c] !== undefined) g[y + r][x + c] = ch }))
  return g
}
export const done = (g) => g.map((r) => r.join(''))
/** A box's side or top, run back to front: `back` fill with `front` edge columns. */
export const twoTone = (cols, front, back, frontCols = 1) => [back.repeat(cols - frontCols) + front.repeat(frontCols)]
/** A panel: lit top row and left column, dark bottom row and right column. */
function panel(g, x, y, w, h, fill, lit, dark) {
  rect(g, x, y, w, h, fill)
  rect(g, x, y, w, 1, lit)
  rect(g, x, y, 1, h, lit)
  rect(g, x, y + h - 1, w, 1, dark)
  rect(g, x + w - 1, y, 1, h, dark)
}

// ---- VHS: three sleeves standing spine out ---------------------------------------
// The film's sleeve is on the left, so its cover shows on the box's side.
export const VHS_W = 27
export const VHS_H = 50
export const VHS_FRONT = (() => {
  const g = grid(VHS_W, VHS_H, '9')
  // 1: the film, green with a yellow title running down it and a white logo.
  panel(g, 0, 0, 9, VHS_H, '@', '%', '#')
  rect(g, 1, 2, 7, 1, '#')
  for (const [y, h] of [[6, 4], [11, 3], [15, 5], [21, 3], [25, 4]]) rect(g, 3, y, 3, h, '+')
  rect(g, 4, 7, 1, 2, 'O')
  rect(g, 4, 16, 1, 3, 'O')
  rect(g, 2, 33, 5, 1, '%')
  rect(g, 2, 42, 5, 5, '=')
  rect(g, 3, 43, 3, 3, '#')
  // 2: a black tape case, a white label with a red stripe.
  panel(g, 9, 0, 9, VHS_H, '9', '0', '9')
  rect(g, 10, 5, 7, 30, '=')
  rect(g, 10, 5, 7, 1, '-')
  rect(g, 11, 8, 5, 3, 'R')
  for (const y of [14, 17, 20, 23, 26, 29]) rect(g, 12, y, 3, 1, '-')
  rect(g, 13, 40, 2, 5, '0')
  // 3: a rental sleeve, white with an orange top band.
  panel(g, 18, 0, 9, VHS_H, '=', 'X', '-')
  rect(g, 19, 2, 7, 7, 'O')
  rect(g, 21, 4, 3, 3, '=')
  for (const [y, h] of [[13, 3], [18, 5], [25, 3]]) rect(g, 21, y, 3, h, '9')
  rect(g, 19, 41, 7, 6, 'B')
  rect(g, 20, 42, 5, 1, 'b')
  return done(g)
})()
/** The film's cover, seen on the left sleeve's side (column 0 is the back). */
export const VHS_COVER = (() => {
  const g = grid(20, VHS_H, '&')
  rect(g, 0, 0, 20, 10, '*')
  for (let c = 0; c < 20; c++) rect(g, c, 10 + ((c * 3) % 4), 1, 1, '*') // soft horizon of the sky
  rect(g, 2, 3, 16, 5, '+') // title block
  rect(g, 3, 4, 14, 1, 'O')
  rect(g, 3, 6, 9, 1, 'O')
  // Rolling green hills, a dark hill in front.
  for (let c = 0; c < 20; c++) {
    const hill = 30 - Math.round(4 * Math.sin((c + 3) / 3.2))
    rect(g, c, hill, 1, VHS_H - hill, '@')
    rect(g, c, hill, 1, 1, '%')
    const front = 38 - Math.round(3 * Math.sin((c + 9) / 2.6))
    rect(g, c, front, 1, VHS_H - front, '#')
  }
  rect(g, 11, 22, 3, 8, '9') // a small figure on the hill
  rect(g, 10, 24, 5, 3, '9')
  rect(g, 11, 23, 1, 1, '@')
  rect(g, 13, 23, 1, 1, '@')
  rect(g, 0, VHS_H - 4, 20, 4, '9') // credits band
  for (let c = 1; c < 19; c += 2) rect(g, c, VHS_H - 3, 1, 1, '-')
  return done(g)
})()
export const VHS_TOP = ['@@@@@@@@@999999999=========']

// ---- chess -----------------------------------------------------------------------
export const BOARD_N = 52
export const BOARD = (() => {
  const g = grid(BOARD_N, BOARD_N, 'F')
  // Wood grain on the rim.
  for (let r = 0; r < BOARD_N; r++) for (let c = 0; c < BOARD_N; c++) {
    if ((r * 7 + c * 3) % 11 === 0) g[r][c] = 'M'
    else if ((r * 5 + c * 13) % 17 === 0) g[r][c] = 'I'
  }
  rect(g, 0, 0, BOARD_N, 1, '4')
  rect(g, 0, 0, 1, BOARD_N, '4')
  rect(g, 0, BOARD_N - 1, BOARD_N, 1, 'I')
  rect(g, BOARD_N - 1, 0, 1, BOARD_N, 'I')
  rect(g, 4, 4, 44, 44, 'I') // inlay
  rect(g, 4, 47, 44, 1, 'M')
  rect(g, 47, 4, 1, 44, 'M')
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const light = (r + c) % 2 === 0
    const x = 6 + c * 5
    const y = 6 + r * 5
    rect(g, x, y, 5, 5, light ? 'Q' : 'U')
    rect(g, x, y + 4, 5, 1, light ? '2' : '3')
    rect(g, x + 4, y, 1, 4, light ? '2' : '3')
  }
  // A few gloss streaks across the varnish.
  for (const [x, y] of [[9, 8], [10, 9], [11, 10], [27, 7], [28, 8], [12, 30], [13, 31]]) g[y][x] = light(g[y][x])
  return done(g)
})()
function light(ch) {
  return { Q: 'X', 2: 'Q', U: '4', 3: 'U' }[ch] ?? ch
}

// Chessmen, about 1.4x the old set: white lit from the left, black in ebony.
// Collars are a darker band, not ink, so the pieces read at this size.
export const KING = [
  '......X......',
  '.....XWw.....',
  '...XXXWwww...',
  '.....XWw.....',
  '.....XWw.....',
  '....XWWWw....',
  '...XWWWWWw...',
  '...XWWWWWw...',
  '....XWWWw....',
  '...vvvvvvv...',
  '....XWWww....',
  '....XWWww....',
  '....XWWww....',
  '....XWWww....',
  '....XWWww....',
  '...XWWWWww...',
  '...vvvvvvv...',
  '..XWWWWWWww..',
  '.XWWWWWWWwww.',
  '.vvvvvvvvvvv.',
  'XWWWWWWWWWwwv',
  'XWWWWWWWWwwwv',
  '.wwwwwwwwwvv.',
]
export const QUEEN = [
  '.e...e...e.',
  '.eE..E..Ef.',
  '.eEE.E.EEf.',
  '..eEEEEEf..',
  '...eEEEf...',
  '...11111...',
  '....eEf....',
  '....eEf....',
  '....eEEf...',
  '....eEEf...',
  '...eEEEff..',
  '...11111...',
  '..eEEEEEff.',
  '.eEEEEEEEff',
  '.111111111.',
  'eEEEEEEEEff',
  'eEEEEEEEfff',
  '.fffffffff.',
]
export const BISHOP = [
  '....X....',
  '...XWw...',
  '..XWWvw..',
  '..XWvWw..',
  '..XvWWw..',
  '...XWw...',
  '..vvvvv..',
  '...XWw...',
  '...XWw...',
  '...XWww..',
  '..XWWww..',
  '..vvvvv..',
  '.XWWWWww.',
  'XWWWWWwwv',
  '.wwwwwvv.',
]
export const KNIGHT = [
  '...ee.......',
  '..eEEf......',
  '.eEEEEf.....',
  'eE1EEEEf....',
  'EEEEEEEEf...',
  'eEEEEEEEEf..',
  '.ff.eEEEEf..',
  '...eEEEEEf..',
  '...eEEEEf...',
  '..eEEEEEf...',
  '..eEEEEEff..',
  '.1111111111.',
  '.eEEEEEEEff.',
  'eEEEEEEEEEff',
  '.ffffffffff.',
]
export const ROOK = [
  'XW.XWWw.Ww',
  'XWWWWWWWww',
  '.XWWWWWww.',
  '..vvvvvv..',
  '..XWWWww..',
  '..XWWWww..',
  '..XWWWww..',
  '..XWWWww..',
  '.vvvvvvvv.',
  '.XWWWWWww.',
  'XWWWWWWwwv',
  '.wwwwwwvv.',
]
export const PAWN_W = ['...XWw...', '..XWWww..', '..XWWww..', '...XWw...', '..vvvvv..', '...XWw...', '..XWWww..', '.XWWWWww.', 'XWWWWWwwv', '.wwwwwvv.']
export const PAWN_B = ['...eEf...', '..eEEff..', '..eEEff..', '...eEf...', '..11111..', '...eEf...', '..eEEff..', '.eEEEEff.', 'eEEEEEfff', '.fffffff.']

// ---- mahjong ---------------------------------------------------------------------
export const TILE_W = 14
export const TILE_H = 19
const tileFace = (glyph) => {
  const g = grid(TILE_W, TILE_H, 'W')
  rect(g, 0, 0, TILE_W, 1, 'X')
  rect(g, 0, 0, 1, TILE_H, 'X')
  rect(g, TILE_W - 1, 0, 1, TILE_H, 'w')
  rect(g, 0, TILE_H - 1, TILE_W, 1, 'w')
  rect(g, 0, TILE_H - 3, TILE_W, 2, 'G') // the green back shows under the face
  rect(g, 0, TILE_H - 3, TILE_W, 1, 'h')
  rect(g, 0, TILE_H - 1, TILE_W, 1, 'g')
  stamp(g, 1, 2, glyph)
  return done(g)
}
export const ZHONG = tileFace([
  '.....RR.....',
  '.....RR.....',
  '.RRRRRRRRRR.',
  '.R...RR...r.',
  '.R...RR...r.',
  '.R...RR...r.',
  '.RRRRRRRRRr.',
  '.....RR.....',
  '.....RR.....',
  '.....RR.....',
  '.....rr.....',
])
export const BAMBOO = tileFace([
  '.JJ..JJ..JJ.',
  '.hJ..hJ..hJ.',
  '.gg..gg..gg.',
  '.JJ..JJ..JJ.',
  '.hJ..hJ..hJ.',
  '.gg..gg..gg.',
  '.JJ..JJ..JJ.',
  '.hJ..hJ..hJ.',
  '.gg..gg..gg.',
  '.JJ..JJ..JJ.',
  '.gg..gg..gg.',
])
export const DOTS = tileFace([
  '..BBB...BBB.',
  '.BbRbB.BbRbB',
  '.BRrRB.BRrRB',
  '.BbRbB.BbRbB',
  '..BBB...BBB.',
  '............',
  '....RRRR....',
  '...RrJJrR...',
  '...RJ55JR...',
  '...RrJJrR...',
  '....RRRR....',
])
export const TILE_SIDE = ['GGGWWW']
export const TILE_TOP = ['GGGXXX']
/** A two-high stack of tiles lying face down, `n` across, short ends out. */
export const stackFront = (n) => {
  const g = grid(n * 10, 14, 'W')
  for (let layer = 0; layer < 2; layer++) {
    const y = layer * 7
    rect(g, 0, y, n * 10, 3, 'G')
    rect(g, 0, y, n * 10, 1, 'h')
    rect(g, 0, y + 3, n * 10, 4, 'W')
    rect(g, 0, y + 3, n * 10, 1, 'X')
    rect(g, 0, y + 6, n * 10, 1, 'w')
    for (let c = 9; c < n * 10; c += 10) rect(g, c, y, 1, 7, layer ? 'v' : 'v')
  }
  return done(g)
}
export const STACK_TOP = (n) => [[...Array(n * 10)].map((_, c) => (c % 10 === 9 ? 'g' : 'G')).join('')]

// ---- solitaire: an open tuck box, a card peeking out -------------------------------
export const CARDBOX_W = 24
export const CARDBOX_H = 34
export const CARD_BOX = (() => {
  const g = grid(CARDBOX_W, CARDBOX_H, 'B')
  for (let r = 0; r < CARDBOX_H; r++) for (let c = 0; c < CARDBOX_W; c++) if ((r + c) % 4 === 0 || (r - c + 400) % 4 === 0) g[r][c] = 'n'
  panel(g, 0, 0, CARDBOX_W, CARDBOX_H, 'B', 'b', 'j')
  rect(g, 2, 2, CARDBOX_W - 4, 1, 'X') // white border
  rect(g, 2, CARDBOX_H - 3, CARDBOX_W - 4, 1, 'X')
  rect(g, 2, 2, 1, CARDBOX_H - 4, 'X')
  rect(g, CARDBOX_W - 3, 2, 1, CARDBOX_H - 4, 'X')
  rect(g, 0, 6, CARDBOX_W, 1, 'j') // lid fold
  rect(g, 8, 3, 8, 3, 'j') // thumb notch
  // Central medallion with a spade.
  rect(g, 6, 12, 12, 13, 'X')
  rect(g, 7, 11, 10, 15, 'X')
  stamp(g, 8, 13, [
    '...KK...',
    '..KKKK..',
    '.KKKKKK.',
    'KKKKKKKK',
    'KKKKKKKK',
    '.KK.KK..',
    '...KK...',
    '..KKKK..',
  ])
  rect(g, 7, 22, 10, 1, 'R')
  return done(g)
})()
export const CARD_PEEK = (() => {
  const g = grid(18, 8, 'X')
  rect(g, 17, 0, 1, 8, 'w')
  stamp(g, 2, 1, ['R.R', 'RRR', '.R.'])
  stamp(g, 12, 1, ['KK.', 'K.K', 'KK.'])
  return done(g)
})()

// ---- blackjack: two cards leaning on chip stacks ------------------------------------
export const CARD_W = 17
export const CARD_H = 23
const card = (rank, pip, ink) => {
  const g = grid(CARD_W, CARD_H, 'X')
  rect(g, CARD_W - 1, 0, 1, CARD_H, 'w')
  rect(g, 0, CARD_H - 1, CARD_W, 1, 'w')
  rect(g, 0, 0, CARD_W, 1, 'X')
  stamp(g, 2, 2, rank.map((r) => r.replace(/#/g, ink)))
  stamp(g, 5, 10, pip.map((r) => r.replace(/#/g, ink)))
  stamp(g, CARD_W - 6, CARD_H - 7, rank.map((r) => [...r].reverse().join('').replace(/#/g, ink)).reverse())
  return done(g)
}
export const ACE_SPADES = card(
  ['.#.', '#.#', '###', '#.#', '#.#'],
  ['...#...', '..###..', '.#####.', '#######', '#######', '.#.#.#.', '...#...', '..###..'],
  'K',
)
export const KING_HEARTS = card(
  ['#.#', '##.', '#..', '##.', '#.#'],
  ['.##.##.', '#######', '#######', '#######', '.#####.', '..###..', '...#...', '.......'],
  'R',
)
/** A stack of `n` chips seen from the front: an elliptical top, spotted edges. */
export function chipStack(n, face, side, shade, spot) {
  const rows = [
    `....${face.repeat(7)}....`,
    `..${face}${face}${spot}${face.repeat(5)}${spot}${face}${shade}..`,
    `.${face.repeat(12)}${shade}.`,
    `${face.repeat(13)}${shade}${shade}`,
  ]
  for (let i = 0; i < n; i++) {
    rows.push(`${side}${spot}${spot}${side.repeat(3)}${spot}${spot}${side.repeat(3)}${spot}${spot}${side}${shade}`)
    rows.push(`${shade}${side.repeat(12)}${shade}${shade}`)
  }
  return rows
}
export const RED_CHIPS = chipStack(6, '5', 'R', 'r', 'X')
export const BLACK_CHIPS = chipStack(4, 'k', 'C', 'c', 'y')

// ---- minesweeper: 3.5" floppies ------------------------------------------------------
export const FLOPPY_N = 36
export const floppy = (labelArt, body, shade, lit) => {
  const n = FLOPPY_N
  const g = grid(n, n, body)
  panel(g, 0, 0, n, n, body, lit, shade)
  rect(g, 1, 1, 3, 3, shade) // cut corner and arrow
  stamp(g, 2, 6, [lit + '..', lit + lit + '.', lit + lit + lit, lit + lit + '.', lit + '..'])
  // Metal shutter with its window.
  rect(g, 9, 0, 19, 13, 'S')
  rect(g, 9, 0, 1, 13, 'X')
  rect(g, 27, 0, 1, 13, 's')
  rect(g, 9, 12, 19, 1, 's')
  rect(g, 17, 2, 6, 8, 't')
  rect(g, 17, 2, 6, 1, 'd')
  rect(g, 11, 4, 3, 1, 's')
  // Label.
  rect(g, 4, 16, 28, 18, 'L')
  rect(g, 4, 16, 28, 3, 'l')
  rect(g, 4, 19, 28, 1, 'X')
  rect(g, 31, 16, 1, 18, 'l')
  rect(g, 1, 32, 3, 3, shade) // write-protect notch
  rect(g, 33, 32, 2, 3, shade)
  stamp(g, 6, 20, labelArt)
  return done(g)
}
export const MINE_LABEL = [
  '....K...............',
  '..K.K.K........R....',
  '...KKK........RRR...',
  '.KKKSKKK.....RRRR...',
  '...KKKK.........K...',
  '..K.K.K.........K...',
  '....K..........KKK..',
  '....................',
  '.xxxxxxxxxxxxxxxxx..',
  '....................',
  '.xxxxxxxxxxx........',
]
export const PLAIN_LABEL = ['', '', '.zzzzzzzzzzzzzzzz', '', '.ZZZZZZZZZZZ', '', '.ZZZZZZZZZZZZZZ', '', '.ZZZZZZZ'].map((r) => r.padEnd(20, '.'))

// ---- snake: a candybar phone -------------------------------------------------------
export const PHONE_W = 18
export const PHONE_H = 40
export const PHONE = (() => {
  const g = grid(PHONE_W, PHONE_H, 'N')
  panel(g, 0, 0, PHONE_W, PHONE_H, 'N', 'o', 'm')
  rect(g, 1, 1, PHONE_W - 2, 1, 'o')
  rect(g, 6, 2, 6, 1, 'm') // earpiece
  rect(g, 2, 4, 14, 13, 'm') // bezel
  rect(g, 3, 5, 12, 11, 'P')
  rect(g, 3, 5, 12, 1, '7')
  stamp(g, 3, 6, [
    '............',
    '.pppppp.....',
    '......p..p..',
    '......p.....',
    '...ppppp....',
    '............',
    '............',
    '............',
    'pppppppppppp',
    '.p..........',
  ])
  rect(g, 6, 18, 6, 3, 'o') // nav key
  rect(g, 7, 19, 4, 1, 'm')
  rect(g, 2, 18, 3, 2, 'G') // call / hang-up
  rect(g, 13, 18, 3, 2, 'R')
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
    rect(g, 2 + c * 5, 23 + r * 4, 4, 2, 'o')
    rect(g, 2 + c * 5, 25 + r * 4, 4, 1, 'm')
  }
  rect(g, 7, PHONE_H - 2, 4, 1, 'm') // mic
  return done(g)
})()

// ---- breakout / pong: Atari-style cartridges ------------------------------------------
export const CART_W = 28
export const CART_H = 34
export const cartridge = (label, trim) => {
  const g = grid(CART_W, CART_H, 'A')
  panel(g, 0, 0, CART_W, CART_H, 'A', 'H', 'a')
  for (let r = 2; r < 14; r += 2) { rect(g, 2, r, CART_W - 4, 1, 'a'); rect(g, 2, r + 1, CART_W - 4, 1, 'H') }
  rect(g, 2, 15, CART_W - 4, 17, trim)
  rect(g, 3, 16, CART_W - 6, 15, 'a')
  stamp(g, 3, 16, label)
  return done(g)
}
export const BREAKOUT_LABEL = [
  'RRRR.RRRR.RRRR.RRRR.RR',
  'OOOO.OOOO.OOOO.OOOO.OO',
  'YYYY.YYYY......YYYY.YY',
  'JJJJ.JJ...JJJJ.JJJJ.JJ',
  'bbbb.bbbb.bbbb...bb.bb',
  '......................',
  '..........X...........',
  '.........XXX..........',
  '..........X...........',
  '......................',
  '......................',
  '......................',
  '.......XXXXXXX........',
  '.......sssssss........',
  '......................',
]
export const PONG_LABEL = [
  '.X.X.....T.....XXX....',
  '.X.X.....T.......X....',
  '.XXX.....T.....XXX....',
  '...X.....T.....X......',
  '...X.....T.....XXX....',
  '.........T............',
  '.S.......T............',
  '.S.......T.......X....',
  '.S.......T............',
  '.S.......T..........S.',
  '.........T..........S.',
  '.........T..........S.',
  '.........T..........S.',
  'OOOOOOOOOOOOOOOOOOOOOO',
  '......................',
]

const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
export const RGB = Object.fromEntries(Object.entries(PALETTE).map(([k, h]) => [k, hex(h)]))
