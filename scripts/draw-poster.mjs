// Animates the My Dress Up Darling poster for hover, from the hand-drawn art in
// assets/pixel-art/poster/kitagawa-1.png (cropped to the poster's sprite box).
//
//   node scripts/draw-poster.mjs && npm run lighting
//
// Writes public/room/poster-1..14.png. Frame 1 is the art at rest, frame 2 adds the
// room's #f6da9c hover highlight grown 1 px, frames 3-14 are a 12-frame loop (highlight
// 2 px) that AnimatedSprite repeats from frame 3 while hovered. She is a print, so she
// never moves; the print does:
//  - the hearts printed down both sides float up and down, each on its own beat, behind her,
//  - a glint of light sweeps across the glossy surface,
//  - a sparkle twinkles at her fingertips.
import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..', 'assets', 'pixel-art', 'poster', 'kitagawa-1.png')
const outDir = join(__dirname, '..', 'public', 'room')

// The sprite box (objects.ts, the poster entry), as extract-posters.mjs cropped it.
const BOX = { left: 997, top: 78, width: 134, height: 247 }
const W = BOX.width
const H = BOX.height

const BG = [178, 151, 158] // the poster's plain background
const HEART = [178, 101, 124] // printed hearts and the top and bottom bands
const INK = [0, 0, 0]
const SPARKLE = [255, 250, 222]
const SPARKLE_RIM = [255, 214, 140]
const HIGHLIGHT = [0xf6, 0xda, 0x9c]

const LOOP = 12

const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]

function image(data) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? (y * W + x) * 4 : -1)
  return {
    data,
    alpha: (x, y) => (at(x, y) < 0 ? 0 : data[at(x, y) + 3]),
    rgb: (x, y) => { const i = at(x, y); return i < 0 ? null : [data[i], data[i + 1], data[i + 2]] },
    set: (x, y, c) => { const i = at(x, y); if (i < 0) return; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255 },
    clone() { return image(Buffer.from(data)) },
  }
}
const isBg = (img, x, y) => img.alpha(x, y) && same(img.rgb(x, y), BG)

// ---------------------------------------------------------------- effects

// The hearts printed down both sides: heart-pink shapes of heart size (the bands at the
// top and bottom are far bigger, and slivers of band between her legs far thinner).
function printedHearts(img) {
  const seen = new Uint8Array(W * H)
  const hearts = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (seen[y * W + x] || !img.alpha(x, y) || !same(img.rgb(x, y), HEART)) continue
    const comp = [[x, y]]
    seen[y * W + x] = 1
    for (let n = 0; n < comp.length; n++) {
      const [cx, cy] = comp[n]
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx]) continue
        if (img.alpha(nx, ny) && same(img.rgb(nx, ny), HEART)) { seen[ny * W + nx] = 1; comp.push([nx, ny]) }
      }
    }
    const xs = comp.map((p) => p[0]), ys = comp.map((p) => p[1])
    const w = Math.max(...xs) - Math.min(...xs) + 1, h = Math.max(...ys) - Math.min(...ys) + 1
    if (comp.length >= 20 && comp.length <= 120 && w >= 6 && h >= 6) hearts.push(comp)
  }
  return hearts
}

// Each heart floats up and down a pixel or two, out of step with its neighbours. The
// heart is lifted off the background and redrawn at its offset, only over background,
// so her hair always stays in front.
function bobHearts(img, hearts, frame) {
  for (const heart of hearts) for (const [x, y] of heart) img.set(x, y, BG)
  hearts.forEach((heart, i) => {
    const dy = Math.round(Math.sin(((frame / LOOP) + i * 0.37) * Math.PI * 2) * 1.6)
    for (const [x, y] of heart) if (isBg(img, x, y + dy)) img.set(x, y + dy, HEART)
  })
}

// A glint of light crossing the glossy print: a diagonal band, lighter at its centre,
// that sweeps from top left to bottom right in the first part of the loop.
const GLINT_FRAMES = 6
function glint(img, base, frame) {
  if (frame >= GLINT_FRAMES) return
  const travel = W + H * 0.6 + 24
  const pos = -12 + (frame / (GLINT_FRAMES - 1)) * travel
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!base.alpha(x, y) || same(base.rgb(x, y), INK)) continue // the frame line stays dark
    const d = Math.abs(x + y * 0.6 - pos)
    const amount = d < 2 ? 0.32 : d < 5 ? 0.16 : 0
    if (!amount) continue
    const c = img.rgb(x, y)
    img.set(x, y, c.map((v) => Math.round(v + (255 - v) * amount)))
  }
}

// One four-point sparkle at her fingertips, growing and fading late in the loop.
const SPARKLE_AT = [106, 30]
function sparkle(img, frame) {
  const size = [0, 0, 0, 0, 0, 0, 1, 2, 3, 2, 1, 0][frame % LOOP]
  if (!size) return
  const [x, y] = SPARKLE_AT
  if (isBg(img, x, y)) img.set(x, y, SPARKLE)
  for (let k = 1; k <= size; k++) {
    const c = k === size ? SPARKLE_RIM : SPARKLE
    for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) if (isBg(img, x + dx, y + dy)) img.set(x + dx, y + dy, c)
  }
}

// The room's hover outline: #f6da9c grown n px (4-neighbour steps) round the poster.
function highlight(img, n) {
  const out = img.clone()
  let edge = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) edge[i] = img.data[i * 4 + 3] ? 1 : 0
  for (let step = 0; step < n; step++) {
    const next = Uint8Array.from(edge)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (edge[y * W + x]) continue
      const hit = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy
        return nx >= 0 && ny >= 0 && nx < W && ny < H && edge[ny * W + nx]
      })
      if (hit) { next[y * W + x] = 1; out.set(x, y, HIGHLIGHT) }
    }
    edge = next
  }
  return out
}

// ---------------------------------------------------------------- frames

const base = image(await sharp(src).extract(BOX).ensureAlpha().raw().toBuffer())
const hearts = printedHearts(base)

const frames = [base, highlight(base, 1)]
for (let f = 0; f < LOOP; f++) {
  const img = base.clone()
  bobHearts(img, hearts, f)
  sparkle(img, f)
  glint(img, base, f)
  frames.push(highlight(img, 2))
}

for (const [i, img] of frames.entries()) {
  await sharp(img.data, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, `poster-${i + 1}.png`))
}
console.log(`poster: ${frames.length} frames (${hearts.length} printed hearts float)`)
