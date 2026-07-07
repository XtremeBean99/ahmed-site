import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const pixelDir = join(__dirname, '..', 'assets', 'pixel-art')

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

async function main() {
  await mkdir(outDir, { recursive: true })

  // 1. Extract monitor+keyboard+mouse sprite
  const skmPath = join(pixelDir, 'sources', 'monitor-keyboard-mouse.png')
  const skmBounds = await getBounds(skmPath)
  if (skmBounds) {
    const pad = 2
    const imgW = 1408, imgH = 768
    skmBounds.left = Math.max(0, skmBounds.left - pad)
    skmBounds.top = Math.max(0, skmBounds.top - pad)
    skmBounds.right = Math.min(imgW - 1, skmBounds.right + pad)
    skmBounds.bottom = Math.min(imgH - 1, skmBounds.bottom + pad)
    const w = skmBounds.right - skmBounds.left + 1
    const h = skmBounds.bottom - skmBounds.top + 1

    await sharp(skmPath)
      .extract({ left: skmBounds.left, top: skmBounds.top, width: w, height: h })
      .png()
      .toFile(join(outDir, 'monitor-desk.png'))
    console.log('monitor-desk.png:', w + 'x' + h, 'at stage (' + skmBounds.left + ',' + skmBounds.top + ')')
  }

  // 2. Extract bonsai tree sprites (like poster - union box across all)
  const bonsaiDir = join(pixelDir, 'sources', 'bonsai')
  let unionBox = null
  for (let i = 1; i <= 5; i++) {
    const bounds = await getBounds(join(bonsaiDir, 'bonsai-' + i + '.png'))
    if (!bounds) continue
    if (!unionBox) {
      unionBox = { ...bounds }
    } else {
      unionBox.left = Math.min(unionBox.left, bounds.left)
      unionBox.top = Math.min(unionBox.top, bounds.top)
      unionBox.right = Math.max(unionBox.right, bounds.right)
      unionBox.bottom = Math.max(unionBox.bottom, bounds.bottom)
    }
  }

  if (unionBox) {
    const pad = 2
    const imgW = 1408, imgH = 768
    unionBox.left = Math.max(0, unionBox.left - pad)
    unionBox.top = Math.max(0, unionBox.top - pad)
    unionBox.right = Math.min(imgW - 1, unionBox.right + pad)
    unionBox.bottom = Math.min(imgH - 1, unionBox.bottom + pad)
    const w = unionBox.right - unionBox.left + 1
    const h = unionBox.bottom - unionBox.top + 1

    for (let i = 0; i < 5; i++) {
      await sharp(join(bonsaiDir, 'bonsai-' + (i + 1) + '.png'))
        .extract({ left: unionBox.left, top: unionBox.top, width: w, height: h })
        .png()
        .toFile(join(outDir, 'bonsai-' + (i + 1) + '.png'))
    }
    console.log('bonsai frames:', w + 'x' + h, 'at stage (' + unionBox.left + ',' + unionBox.top + ')')
  }
}

main().catch(console.error)
