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

const JOBS = [
  { src: 'side-table.png', out: 'side-table.png' },
  { src: 'side-table-digital-clock-no-numbers.png', out: 'side-table-clock.png' },
]

async function main() {
  await mkdir(outDir, { recursive: true })
  const pad = 2
  const imgW = 1408, imgH = 768
  for (const job of JOBS) {
    const srcPath = join(bgDir, job.src)
    const b = await getBounds(srcPath)
    if (!b) {
      console.error('No opaque pixels in', job.src)
      process.exitCode = 1
      continue
    }
    const left = Math.max(0, b.left - pad)
    const top = Math.max(0, b.top - pad)
    const right = Math.min(imgW - 1, b.right + pad)
    const bottom = Math.min(imgH - 1, b.bottom + pad)
    const w = right - left + 1
    const h = bottom - top + 1
    await sharp(srcPath)
      .extract({ left, top, width: w, height: h })
      .png()
      .toFile(join(outDir, job.out))
    console.log(`${job.out}: ${w}x${h} at stage (${left},${top})`)
  }
}

main().catch(console.error)
