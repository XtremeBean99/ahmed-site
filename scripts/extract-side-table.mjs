import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const bgDir = join(__dirname, '..', 'assets', 'pixel-art', 'background')

async function getBounds(imagePath) {
  const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let left = width, top = height, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + 3] > 0) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right === -1) return null
  return { left, top, right, bottom }
}

const SIDE_TABLE_FRAMES = ['side-table1.png', 'side-table2.png']
const CLOCK_JOB = { src: 'side-table-digital-clock-no-numbers.png', out: 'side-table-clock.png' }

async function main() {
  await mkdir(outDir, { recursive: true })
  const pad = 2
  const imgW = 1408, imgH = 768

  // Multi-frame side table: union bbox across both frames.
  const bounds = []
  for (const src of SIDE_TABLE_FRAMES) {
    const b = await getBounds(join(bgDir, src))
    if (!b) {
      console.error('No opaque pixels in', src)
      process.exitCode = 1
      continue
    }
    bounds.push(b)
  }
  const union = {
    left: Math.min(...bounds.map((b) => b.left)),
    top: Math.min(...bounds.map((b) => b.top)),
    right: Math.max(...bounds.map((b) => b.right)),
    bottom: Math.max(...bounds.map((b) => b.bottom)),
  }
  const left = Math.max(0, union.left - pad)
  const top = Math.max(0, union.top - pad)
  const right = Math.min(imgW - 1, union.right + pad)
  const bottom = Math.min(imgH - 1, union.bottom + pad)
  const w = right - left + 1
  const h = bottom - top + 1

  for (let i = 0; i < SIDE_TABLE_FRAMES.length; i++) {
    await sharp(join(bgDir, SIDE_TABLE_FRAMES[i]))
      .extract({ left, top, width: w, height: h })
      .png()
      .toFile(join(outDir, `side-table-${i + 1}.png`))
    console.log(`side-table-${i + 1}.png: ${w}x${h} at stage (${left},${top})`)
  }

  // Clock face (single frame, unchanged)
  const cb = await getBounds(join(bgDir, CLOCK_JOB.src))
  if (!cb) {
    console.error('No opaque pixels in', CLOCK_JOB.src)
    process.exitCode = 1
  } else {
    const cleft = Math.max(0, cb.left - pad)
    const ctop = Math.max(0, cb.top - pad)
    const cright = Math.min(imgW - 1, cb.right + pad)
    const cbottom = Math.min(imgH - 1, cb.bottom + pad)
    const cw = cright - cleft + 1
    const ch = cbottom - ctop + 1
    await sharp(join(bgDir, CLOCK_JOB.src))
      .extract({ left: cleft, top: ctop, width: cw, height: ch })
      .png()
      .toFile(join(outDir, CLOCK_JOB.out))
    console.log(`${CLOCK_JOB.out}: ${cw}x${ch} at stage (${cleft},${ctop})`)
  }
}

main().catch(console.error)
