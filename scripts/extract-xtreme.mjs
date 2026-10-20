import sharp from 'sharp'
import { mkdir, readdir, unlink } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Builds the Xtreme Bean splash (XtremeSplash.tsx) from the 28 hand-drawn keyframes in
// assets/pixel-art/xtreme-bean-animation/ into one sprite sheet, public/room/xtreme-sheet.png.
//
// TWEENS in-betweens are generated between each pair of keyframes, so the splash runs at
// (TWEENS + 1)x the frame rate in the same time. Each in-between keeps the pixel look (no
// anti-aliasing, no half-transparent pixels):
//  - a pixel opaque in both keyframes lerps its colour (the white -> grey -> black and
//    white -> pink -> red fades of the logo),
//  - a pixel only in the next keyframe grows outward from the shape the two frames share,
//    nearest pixels first, and a pixel only in the previous one retracts tip first, so arms
//    swing and letters stretch instead of popping,
//  - pixels the shared shape cannot reach fall back to an ordered-dither dissolve.
// Keep TWEENS in step with TOTAL_FRAMES and COLS in XtremeSplash.tsx.

const KEYFRAMES = 28
const TWEENS = 0 // in-betweens per keyframe pair; 0 keeps the hand-drawn animation as drawn
const SIZE = 128
const COLS = 10

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const srcDir = join(__dirname, '..', 'assets', 'pixel-art', 'xtreme-bean-animation')

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16)
const bayer = (i) => BAYER4[((i >> 7) & 3) * 4 + (i & 127 & 3)]

async function load(n) {
  const { data } = await sharp(join(srcDir, `xtreme${n}.png`))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return data
}

const opaque = (px, i) => px[i * 4 + 3] >= 128

// 8-connected BFS distance through `mask` from every pixel in `seed`; Infinity if unreachable.
function distances(seed, mask) {
  const dist = new Float64Array(SIZE * SIZE).fill(Infinity)
  const queue = new Int32Array(SIZE * SIZE)
  let head = 0, tail = 0
  for (let i = 0; i < SIZE * SIZE; i++) if (seed[i]) { dist[i] = 0; queue[tail++] = i }
  while (head < tail) {
    const i = queue[head++], x = i & 127, y = i >> 7
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) {
        const j = ny * SIZE + nx
        if (mask[j] && dist[j] === Infinity) { dist[j] = dist[i] + 1; queue[tail++] = j }
      }
    }
  }
  return dist
}

function tween(a, b, t) {
  const n = SIZE * SIZE
  const shared = new Uint8Array(n), onlyA = new Uint8Array(n), onlyB = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const inA = opaque(a, i), inB = opaque(b, i)
    shared[i] = inA && inB
    onlyA[i] = inA && !inB
    onlyB[i] = inB && !inA
  }
  const dA = distances(shared, onlyA), dB = distances(shared, onlyB)
  let maxA = 0, maxB = 0
  for (let i = 0; i < n; i++) {
    if (dA[i] !== Infinity) maxA = Math.max(maxA, dA[i])
    if (dB[i] !== Infinity) maxB = Math.max(maxB, dB[i])
  }
  const grows = (d, max, amount, i) =>
    d === Infinity ? bayer(i) < amount : d <= amount * (max + 1) - 0.5

  const out = Buffer.alloc(n * 4)
  for (let i = 0; i < n; i++) {
    let src = null
    if (shared[i]) {
      for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(a[i * 4 + c] + (b[i * 4 + c] - a[i * 4 + c]) * t)
      out[i * 4 + 3] = 255
      continue
    }
    if (onlyB[i] && grows(dB[i], maxB, t, i)) src = b
    else if (onlyA[i] && grows(dA[i], maxA, 1 - t, i)) src = a
    if (src) {
      out.set(src.subarray(i * 4, i * 4 + 3), i * 4)
      out[i * 4 + 3] = 255
    }
  }
  return out
}

const keys = []
for (let k = 1; k <= KEYFRAMES; k++) keys.push(await load(k))

const frames = []
for (let k = 0; k < KEYFRAMES; k++) {
  frames.push(keys[k])
  if (k === KEYFRAMES - 1) break
  for (let s = 1; s <= TWEENS; s++) frames.push(tween(keys[k], keys[k + 1], s / (TWEENS + 1)))
}

const rows = Math.ceil(frames.length / COLS)
await mkdir(outDir, { recursive: true })
await sharp({ create: { width: COLS * SIZE, height: rows * SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(frames.map((data, f) => ({
    input: data,
    raw: { width: SIZE, height: SIZE, channels: 4 },
    left: (f % COLS) * SIZE,
    top: Math.floor(f / COLS) * SIZE,
  })))
  .png({ compressionLevel: 9, palette: false })
  .toFile(join(outDir, 'xtreme-sheet.png'))

// The old one-file-per-frame output is superseded by the sheet.
for (const name of await readdir(outDir)) if (/^xtreme-\d+\.png$/.test(name)) await unlink(join(outDir, name))

console.log(`xtreme-sheet.png: ${frames.length} frames, ${COLS}x${rows}`)
