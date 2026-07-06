import sharp from 'sharp'
import { readdir, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sourceDir = join(__dirname, '..', '..', 'pixel-art', 'kitagawa poster')
const outputDir = join(__dirname, '..', 'public', 'room')

/**
 * Get raw pixel data and find bounding box of non-transparent pixels.
 * Returns { left, top, right, bottom } in pixel coords (inclusive),
 * or null if fully transparent.
 */
async function getNonTransparentBounds(imagePath) {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width, height, channels } = info
  let left = width, top = height, right = -1, bottom = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3]
      if (alpha > 0) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }

  if (right === -1) return null // fully transparent
  return { left, top, right, bottom }
}

async function main() {
  await mkdir(outputDir, { recursive: true })

  const files = []
  for (let i = 1; i <= 5; i++) {
    files.push(join(sourceDir, `kitagawa${i}.png`))
  }

  // Compute union bounding box across all frames
  let unionBox = null
  for (const file of files) {
    const bounds = await getNonTransparentBounds(file)
    if (!bounds) {
      console.error(`Warning: ${file} is fully transparent`)
      continue
    }
    console.log(`${file}: bounds =`, bounds)
    if (!unionBox) {
      unionBox = { ...bounds }
    } else {
      unionBox.left = Math.min(unionBox.left, bounds.left)
      unionBox.top = Math.min(unionBox.top, bounds.top)
      unionBox.right = Math.max(unionBox.right, bounds.right)
      unionBox.bottom = Math.max(unionBox.bottom, bounds.bottom)
    }
  }

  if (!unionBox) {
    console.error('No non-transparent pixels found in any frame')
    process.exit(1)
  }

  // Pad by 2px, clamped to image bounds (1408x768)
  const imgW = 1408, imgH = 768
  const pad = 2
  unionBox.left = Math.max(0, unionBox.left - pad)
  unionBox.top = Math.max(0, unionBox.top - pad)
  unionBox.right = Math.min(imgW - 1, unionBox.right + pad)
  unionBox.bottom = Math.min(imgH - 1, unionBox.bottom + pad)

  const cropW = unionBox.right - unionBox.left + 1
  const cropH = unionBox.bottom - unionBox.top + 1

  console.log(`\nUnion crop box (with ${pad}px pad):`, unionBox)
  console.log(`Crop dimensions: ${cropW} x ${cropH}`)
  console.log(`Stage origin (top-left): (${unionBox.left}, ${unionBox.top})`)

  // Crop all frames to the same box
  for (let i = 0; i < files.length; i++) {
    const outPath = join(outputDir, `poster-${i + 1}.png`)
    await sharp(files[i])
      .extract({
        left: unionBox.left,
        top: unionBox.top,
        width: cropW,
        height: cropH,
      })
      .png()
      .toFile(outPath)
    console.log(`Saved ${outPath}`)
  }

  // Also output the registry entry data
  console.log(`\n--- object registry data ---`)
  console.log(`poster: { x: ${unionBox.left}, y: ${unionBox.top}, w: ${cropW}, h: ${cropH} }`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
