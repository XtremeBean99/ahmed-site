import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const srcDir = join(__dirname, '..', 'assets', 'pixel-art', 'xtreme-bean-animation')

await mkdir(outDir, { recursive: true })

// The frames are 128x128; pass through sharp to normalise encoding.
// Named xtreme-1..xtreme-28 in public/room/ for simple programmatic loading.
for (let i = 1; i <= 28; i++) {
  await sharp(join(srcDir, `xtreme${i}.png`))
    .png()
    .toFile(join(outDir, `xtreme-${i}.png`))
  console.log(`xtreme-${i}.png`)
}
