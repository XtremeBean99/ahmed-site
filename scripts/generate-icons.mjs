// scripts/generate-icons.mjs
// Builds the site's icons from assets/site-logo.jpg.
//   npm run icons
//
// Next's App Router picks up src/app/icon.png and src/app/apple-icon.png by
// file convention and emits the <link> tags itself, so nothing needs wiring
// into layout.tsx's metadata. Files in public/ are NOT auto-detected: that is
// why public/favicon.svg never showed up in a browser tab.
//
// The favicon is cropped to the red X because the full lockup is unreadable at
// 16-32px, where only the mark survives. The Apple touch icon is 180px, big
// enough to keep the whole logo.
import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(root, 'assets', 'site-logo.jpg')

// Square crop around the X, measured on the 1639x1639 source. Re-measure if the
// logo art is ever redrawn.
const X_CROP = { left: 325, top: 25, width: 980, height: 980 }

const out = (name) => join(root, 'src', 'app', name)

const source = sharp(SOURCE)
const { width, height } = await source.metadata()
if (width !== height) console.warn(`source is ${width}x${height}, not square: check the crop`)

await source
  .clone()
  .extract(X_CROP)
  .resize(256, 256, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile(out('icon.png'))

await source
  .clone()
  .resize(180, 180, { kernel: 'lanczos3' })
  .png({ compressionLevel: 9 })
  .toFile(out('apple-icon.png'))

console.log('wrote src/app/icon.png (256, cropped to the X) and src/app/apple-icon.png (180, full logo)')
