// Draws the desk games' shelf objects (chess, mahjong, solitaire, blackjack,
// minesweeper, snake, pong, breakout) as pixel art on the full 1408x768 stage
// canvas, in the same rest + two-step highlight format as the hand-drawn shelf
// sources, then hands them to scripts/extract-shelf.mjs for cropping.
//
//   node scripts/draw-shelf-games.mjs && node scripts/extract-shelf.mjs && npm run lighting
//
// Each object is one or more ASCII maps of fill colours ("parts", back to
// front). The script outlines every part in black (so a front part keeps its
// edge where it overlaps the one behind), shears each column up the shelf's
// slope so the art sits in the room's perspective, and grows the #f6da9c
// highlight outline by 1 px (frame 2) and 2 px (frame 3), like catan / books / vhs.
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

// Shelf floor, measured off background.png: a line a few px behind the front
// lip, at y = 236 for x = 300 and rising ~0.135 px per px to the right.
const floorAt = (x) => 236 - Math.floor((x - 300) * 0.135)

const PALETTE = {
  K: '000000', // ink
  // ivory (chess king, mahjong faces, cards)
  X: 'f6efdc', W: 'ecdcbc', w: 'cbb894', v: 'a08a68',
  // ebony (chess knight)
  e: '806660', E: '5a4541', f: '35282a',
  // mahjong green backs
  G: '3f7a52', g: '2b5a3a',
  // reds
  q: 'e07a62', R: 'c0463a', r: '8a2e28',
  // card-back blues
  b: '6286bb', B: '3d5d8f', n: '2a4170',
  // chips
  C: '45454d', c: '2a2a30', y: 'd9d2c0',
  // floppy
  D: '4f5262', d: '363946', S: 'c0c2ca', s: '8a8c97', t: '5c5e68',
  L: 'ebe4cf', l: 'c7bfa7',
  // phone
  o: '6a7b9e', N: '44547a', m: '2c3753', P: 'a7ba78', p: '3c4824',
  // cartridges
  H: '5a514c', A: '37312f', a: '221e1d', T: '77706a',
  O: 'd98a3c', Y: 'e2c45a', J: '62a456', Z: 'c9a24a',
}

// ---- chess: a white king with a black knight in front of it ----------------
const KING = [
  '.....Xw.....',
  '.....Ww.....',
  '...XWWWww...',
  '.....Ww.....',
  '.....Ww.....',
  '...KKKKKK...',
  '..XWWWWWww..',
  '.XWWWWWWwwv.',
  '.XWWWWWWwwv.',
  '..XWWWWwwv..',
  '...XWWWwv...',
  '..KKKKKKKK..',
  '..XWWWWwwv..',
  '..KKKKKKKK..',
  '...XWWWwv...',
  '...XWWWwv...',
  '...XWWWwv...',
  '...XWWWwv...',
  '...XWWWwv...',
  '..XWWWWwwv..',
  '..XWWWWwwv..',
  '..XWWWWWwwv.',
  '.KKKKKKKKKK.',
  '.XWWWWWWwwv.',
  'XWWWWWWWWwwv',
  'KKKKKKKKKKKK',
  'XWWWWWWWWwwv',
  'XWWWWWWWwwvv',
]
const KNIGHT = [
  '.......e.e......',
  '......eEeEf.....',
  '.....eEEEEEf....',
  '....eEEEEEEf....',
  '...eEKEEEEEff...',
  '..eEEEEEEEEEf...',
  '.eEEEEEEEEEEf...',
  'eEEEEEEEEEEEff..',
  'eEEf..eEEEEEff..',
  '.ff...eEEEEEEf..',
  '.....eEEEEEEEff.',
  '.....eEEEEEEEff.',
  '....eEEEEEEEEff.',
  '....eEEEEEEEEEf.',
  '...eEEEEEEEEEEff',
  '...KKKKKKKKKKKK.',
  '....eEEEEEEEEff.',
  '...eEEEEEEEEEEff',
  '..KKKKKKKKKKKKKK',
  '..eEEEEEEEEEEEff',
  '.eEEEEEEEEEEEEff',
]

// ---- mahjong: a two-high wall of face-down tiles and one tile showing 中 ----
const MAHJONG_WALL = [
  'XWWWWWWWWKXWWWWWWWWKXWWWWWWWWw',
  'WWWWWWWWWKWWWWWWWWWKWWWWWWWWWw',
  'wwwwwwwwwKwwwwwwwwwKwwwwwwwwwv',
  'GGGGGGGGGKGGGGGGGGGKGGGGGGGGGg',
  'GGGGGGGGGKGGGGGGGGGKGGGGGGGGGg',
  'gggggggggKgggggggggKgggggggggg',
  'KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  'XWWWWWWWWKXWWWWWWWWKXWWWWWWWWw',
  'wwwwwwwwwKwwwwwwwwwKwwwwwwwwwv',
  'GGGGGGGGGKGGGGGGGGGKGGGGGGGGGg',
  'GGGGGGGGGKGGGGGGGGGKGGGGGGGGGg',
  'gggggggggKgggggggggKgggggggggg',
]
const MAHJONG_TILE = [
  '.XWWWWWWWWWWWwGg',
  'XWWWWWWWWWWWWwGg',
  'XWWWWWRWWWWWWwGg',
  'XWWWWWRWWWWWWwGg',
  'XWRRRRRRRRRWWwGg',
  'XWRWWWRWWWRWWwGg',
  'XWRWWWRWWWRWWwGg',
  'XWRRRRRRRRRWWwGg',
  'XWWWWWRWWWWWWwGg',
  'XWWWWWRWWWWWWwGg',
  'XWWWWWRWWWWWWwGg',
  'XWWWWWWWWWWWWwGg',
  'XWWWWWWWWWWWWwGg',
  'wwwwwwwwwwwwwvGg',
]

// ---- solitaire: a tuck box of cards, lid open, blue lattice back -----------
const CARD_BOX = [
  '..XXXXXXXXXXXXXXX...',
  '.XXXXXXXXXXXXXXXXw..',
  'bbbbbbbbbbbbbbbbbbB.',
  'BBBBBBBBBBBBBBBBBBBn',
  'KKKKKKKKKKKKKKKKKKKn',
  'WWWWWWWWWWWWWWWWWwBn',
  'WBBBBBBBBBBBBBBBBwBn',
  'WBbBBBbBBBbBBBbBBwBn',
  'WBBbBbBbBbBbBbBbBwBn',
  'WBBBbBBBbBBBbBBBBwBn',
  'WBBbBbBbBbBbBbBbBwBn',
  'WBbBBBbBBBbBBBbBBwBn',
  'WBBbBbBbWWWbBbBbBwBn',
  'WBBBbBBWWKWWbBBBBwBn',
  'WBBbBbBWKKKWBbBbBwBn',
  'WBbBBBWKKKKKWBbBBwBn',
  'WBBbBbWKKKKKWbBbBwBn',
  'WBBBbBBWWKWWbBBBBwBn',
  'WBBbBbBWKKKWBbBbBwBn',
  'WBbBBBbBWWWBBBbBBwBn',
  'WBBbBbBbBbBbBbBbBwBn',
  'WBBBbBBBbBBBbBBBBwBn',
  'WBBbBbBbBbBbBbBbBwBn',
  'WBbBBBbBBBbBBBbBBwBn',
  'WBBBBBBBBBBBBBBBBwBn',
  'WWWWWWWWWWWWWWWWWwBn',
  'wwwwwwwwwwwwwwwwwvnn',
]

// ---- blackjack: an ace of spades behind a red and a black stack of chips ----
const ACE = [
  'XXXXXXXXXXXXW',
  'XKXXXXXXXXXXw',
  'KXKXXXXXXXXXw',
  'KKKXXXXXXXXXw',
  'KXKXXXKXXXXXw',
  'XXXXXKKKXXXXw',
  'XXXXKKKKKXXXw',
  'XXXKKKKKKKXXw',
  'XXXKKKKKKKXXw',
  'XXXXKXKXKXXXw',
  'XXXXXXKXXXXXw',
  'XXXXXKKKXXXXw',
  'XXXXXXXXXXXXw',
]
function chipStack(n, face, side, shade, spot) {
  const rows = [
    `..${face.repeat(9)}..`,
    `.${face}${spot}${face.repeat(7)}${spot}${face}.`,
    `${face.repeat(13)}`,
    `.${side}${face.repeat(10)}${shade}.`.replace(/^\./, side).replace(/\.$/, shade),
  ]
  for (let i = 0; i < n; i++) {
    rows.push(i % 2 ? `${side}${spot}${side.repeat(3)}${spot}${side.repeat(3)}${spot}${side}${shade}${shade}` : `${shade.repeat(13)}`)
    rows.push(`${side}${side}${spot}${side.repeat(3)}${spot}${side.repeat(3)}${spot}${shade}${shade}`)
  }
  return rows
}
const RED_CHIPS = chipStack(9, 'q', 'R', 'r', 'X')
const BLACK_CHIPS = chipStack(5, 'C', 'C', 'c', 'y')

// ---- minesweeper: a 3.5" floppy disk with a mine on the label --------------
const FLOPPY = [
  'DDDDDDDDSSSSSSSSSSSSSSDDDDD.',
  'DDDDDDDDSSSSSttttSSSSSDDDDDd',
  'DDDDDDDDSSSSSttttSSSSSDDDDDd',
  'DDDDDDDDSSSSSttttSSSSSDDDDDd',
  'DDDDDDDDSSSSSttttSSSSSDDDDDd',
  'DDDDDDDDSSSSSttttSSSSSDDDDDd',
  'DDDDDDDDSSSSSSSSSSSSSsDDDDDd',
  'DDDDDDDDssssssssssssssDDDDDd',
  'DDDDDDDDDDDDDDDDDDDDDDDDDDDd',
  'DDDLLLLLLLLLLLLLLLLLLLLLLDDd',
  'DDDllllllllllllllllllllllDDd',
  'DDDLLLLLLLLLLLLLLLLLLLLLLDDd',
  'DDDLLLLLLLLLLKLLLLLLLLLLLDDd',
  'DDDLLLLLLLLKLKLKLLLLLRLLLDDd',
  'DDDLLLLLLLLLKKKLLLLLRRLLLDDd',
  'DDDLLLLLLLKKKKKKLLLRRRLLLDDd',
  'DDDLLLLLLLKLLKKKLLLLLKLLLDDd',
  'DDDLLLLLKKKLKKKKKKLLLKLLLDDd',
  'DDDLLLLLLLKKKKKKLLLLKKKLLDDd',
  'DDDLLLLLLLLLKKKLLLLLLLLLLDDd',
  'DDDLLLLLLLLKLKLKLLLLLLLLLDDd',
  'DDDLLLLLLLLLLKLLLLLLLLLLLDDd',
  'DDDLLLLLLLLLLLLLLLLLLLLLLDDd',
  'DDDLLLLLLLLLLLLLLLLLLLLLLDDd',
  'DddDDDDDDDDDDDDDDDDDDDDDDDDd',
  'DddDDDDDDDDDDDDDDDDDDDDDDDDd',
  'dddddddddddddddddddddddddddd',
]

// ---- snake: a candybar phone with snake on its green screen -----------------
const PHONE = [
  '...oooooooo...',
  '..oNNNNNNNNm..',
  '.oNNNmmmmNNNm.',
  'oNNNNNNNNNNNNm',
  'oNmmmmmmmmmmNm',
  'oNmPPPPPPPPmNm',
  'oNmPppppPPPmNm',
  'oNmPPPPpPPPmNm',
  'oNmPPPPpPpPmNm',
  'oNmPpppppPPmNm',
  'oNmPpPPPPPPmNm',
  'oNmPpPPPPPPmNm',
  'oNmPPPPPPPPmNm',
  'oNmmmmmmmmmmNm',
  'oNNNNNNNNNNNNm',
  'oNNNNooooNNNNm',
  'oNNNoNNNNoNNNm',
  'oNNNNooooNNNNm',
  'oNNNNNNNNNNNNm',
  'oNNoNNoNNoNNNm',
  'oNNNNNNNNNNNNm',
  'oNNoNNoNNoNNNm',
  'oNNNNNNNNNNNNm',
  'oNNoNNoNNoNNNm',
  'oNNNNNNNNNNNNm',
  'oNNoNNoNNoNNNm',
  'oNNNNNNNNNNNNm',
  '.oNNNNNNNNNNm.',
  '..mmmmmmmmmm..',
]

// ---- pong / breakout: two Atari-style cartridges ----------------------------
function cartridge(label, frame = 'T') {
  return [
    '..HHHHHHHHHHHHHHHH..',
    '.HHHHHHHHHHHHHHHHHHa',
    'HAAAAAAAAAAAAAAAAAAa',
    'HaaaaaaaaaaaaaaaaaaA',
    'HAAAAAAAAAAAAAAAAAAa',
    'HaaaaaaaaaaaaaaaaaaA',
    'HAAAAAAAAAAAAAAAAAAa',
    'HaaaaaaaaaaaaaaaaaaA',
    'HAAAAAAAAAAAAAAAAAAa',
    ...label.map((row) => `HA${frame}${row}${frame}Aa`),
    'HAAAAAAAAAAAAAAAAAAa',
    'HAAAAAAAAAAAAAAAAAAa',
    'HAAAAATTTTTTTTAAAAAa',
    'aaaaaaaaaaaaaaaaaaaa',
  ]
}
const PONG_LABEL = [
  'OOOOOOOOOOOOOO',
  'aaaaaaaTaaaaaa',
  'aXaaaaaaaaaaaa',
  'aXaaaaaTaaaaaa',
  'aXaaaaaaaaaaXa',
  'aaaaaaaTaaaaXa',
  'aaaaaaaaaXaaXa',
  'aaaaaaaTaaaaaa',
  'aaaaaaaaaaaaaa',
  'aaaaaaaTaaaaaa',
  'OOOOOOOOOOOOOO',
]
const BREAKOUT_LABEL = [
  'TTTTTTTTTTTTTT',
  'RRaRRaRRaRRaRR',
  'OaOOaOOaOOaOOa',
  'YYaYYaYYaYYaYY',
  'JaJJaJJaJaaJJa',
  'aaaaaaaaaaaaaa',
  'aaaaaaaaaXaaaa',
  'aaaaaaaaaaaaaa',
  'aaaaaXXXXaaaaa',
  'aaaaaaaaaaaaaa',
  'TTTTTTTTTTTTTT',
]

/**
 * Objects left to right along the shelf. `x` is the object's left edge on the
 * stage; every part's bottom row rests on the shelf floor, `dx` shifts a part
 * right within the object, and parts paint back to front.
 */
const OBJECTS = [
  { id: 'chess', x: 300, parts: [{ map: KING }, { map: KNIGHT, dx: 11 }] },
  { id: 'mahjong', x: 334, parts: [{ map: MAHJONG_WALL }, { map: MAHJONG_TILE, dx: 20 }] },
  { id: 'solitaire', x: 375, parts: [{ map: CARD_BOX }] },
  {
    id: 'blackjack',
    x: 401,
    parts: [{ map: ACE, dx: 0, up: 14 }, { map: RED_CHIPS, dx: 7 }, { map: BLACK_CHIPS, dx: 18 }],
  },
  { id: 'minesweeper', x: 441, parts: [{ map: FLOPPY }] },
  { id: 'snake', x: 475, parts: [{ map: PHONE }] },
  { id: 'pong', x: 495, parts: [{ map: cartridge(PONG_LABEL, 'O') }] },
  { id: 'breakout', x: 519, parts: [{ map: cartridge(BREAKOUT_LABEL) }] },
]

const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]

/** Stage pixels of one part: [{ x, y, rgb }], sheared onto the shelf floor. */
function partPixels(obj, part) {
  const rows = part.map
  const out = []
  for (let my = 0; my < rows.length; my++) {
    for (let mx = 0; mx < rows[my].length; mx++) {
      const ch = rows[my][mx]
      if (ch === '.') continue
      const colour = PALETTE[ch]
      if (!colour) throw new Error(`${obj.id}: unknown palette key '${ch}'`)
      const x = obj.x + (part.dx ?? 0) + mx
      const y = floorAt(x) - (part.up ?? 0) - (rows.length - 1 - my)
      out.push({ x, y, rgb: hex(colour) })
    }
  }
  return out
}

function setPx(data, x, y, rgb) {
  const i = (y * W + x) * 4
  data[i] = rgb[0]
  data[i + 1] = rgb[1]
  data[i + 2] = rgb[2]
  data[i + 3] = 255
}

/** Paints an object: each part gets a 1 px ink ring, then its fills. */
function paintObject(obj) {
  const data = Buffer.alloc(W * H * 4)
  for (const part of obj.parts) {
    const px = partPixels(obj, part)
    const own = new Set(px.map((p) => p.y * W + p.x))
    for (const p of px) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = (p.y + dy) * W + (p.x + dx)
        if (!own.has(k)) setPx(data, p.x + dx, p.y + dy, INK)
      }
    }
    for (const p of px) setPx(data, p.x, p.y, p.rgb)
  }
  return data
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
      if (hit) setPx(out, x, y, rgb)
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
