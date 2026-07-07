import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = join(__dirname, '..', 'public', 'room', 'background.png')
const out = join(__dirname, '..', 'src', 'app', 'opengraph-image.png')

// 1408x768 (1.833:1) -> crop to 1.905:1 (1408x739, centred) -> 1200x630
await sharp(src)
  .extract({ left: 0, top: 14, width: 1408, height: 739 })
  .resize(1200, 630)
  .png()
  .toFile(out)

const meta = await sharp(out).metadata()
console.log(`opengraph-image.png ${meta.width}x${meta.height}`)
