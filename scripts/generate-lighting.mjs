// scripts/generate-lighting.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const roomDir = join(__dirname, '..', 'public', 'room')
const assetsBgDir = join(__dirname, '..', 'assets', 'pixel-art', 'background')

// Per-state grades. Dusk is the identity (the source art) and is not generated.
// tint = per-channel multiplier, bright = global multiplier, sat = saturation.
// Tuned visually in Task L5 — these are the starting values.
const GRADES = {
  dawn:  { tint: [1.08, 0.97, 0.92], bright: 0.95, sat: 0.95 },
  day:   { tint: [1.04, 1.02, 0.98], bright: 1.18, sat: 1.0 },
  night: { tint: [0.62, 0.68, 1.0],  bright: 0.70, sat: 0.78 },
}

// Pixels at or below this on every channel are outline ink — never graded.
const INK_MAX = 12

// Room-view layers to grade. Desk close-up art, the monitor boot screen and
// the music notes (emissive) are deliberately excluded.
const range = (name, n) => Array.from({ length: n }, (_, i) => `${name}-${i + 1}.png`)
const FILES = [
  'background.png',
  'background-lamp-off.png',
  ...range('monitor', 4),
  ...range('saitama', 14),
  ...range('poster', 5),
  ...range('bonsai', 5),
  'room-speakers.png',
  'room-speakers-lamp-off.png',
  ...range('coffee', 6),
  'coffee-steam.png',
  'side-table.png',
  'side-table-clock.png',
]

function gradePixel(data, i, { tint, bright, sat }) {
  const r = data[i], g = data[i + 1], b = data[i + 2]
  if (r <= INK_MAX && g <= INK_MAX && b <= INK_MAX) return
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
  data[i]     = clamp((lum + (r - lum) * sat) * tint[0] * bright)
  data[i + 1] = clamp((lum + (g - lum) * sat) * tint[1] * bright)
  data[i + 2] = clamp((lum + (b - lum) * sat) * tint[2] * bright)
}

async function gradeFile(file, state, grade) {
  const { data, info } = await sharp(join(roomDir, file))
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] === 0) continue
    gradePixel(data, i, grade)
  }
  let img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } })
  // Optional hand-drawn window override, composited onto graded backgrounds
  if (file === 'background.png' || file === 'background-lamp-off.png') {
    const override = join(assetsBgDir, `window-${state}.png`)
    if (existsSync(override)) {
      img = sharp(await img.png().toBuffer()).composite([{ input: override }])
    }
  }
  const outDir = join(roomDir, 'lighting', state)
  await mkdir(outDir, { recursive: true })
  await img.png().toFile(join(outDir, file))
}

async function main() {
  for (const [state, grade] of Object.entries(GRADES)) {
    for (const file of FILES) await gradeFile(file, state, grade)
    console.log(`${state}: ${FILES.length} sprites -> public/room/lighting/${state}/`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
