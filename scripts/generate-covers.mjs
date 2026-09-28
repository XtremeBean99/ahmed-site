// scripts/generate-covers.mjs
// Builds 128x128 JPEG cover thumbnails from the repo-internal originals in
// assets/audio-covers/. Public cover paths stay the same, so playlist.ts
// never changes. Run with:
//   npm run covers
//
// The original art can be 20-300 KB while the UI shows it at 24-36 px, so
// each file is centre-cropped to a square and scaled to 128x128 at ffmpeg
// qscale 3 (about quality 85), which is plenty for the pixelated thumbnails.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = join(root, 'assets', 'audio-covers')
const outDir = join(root, 'public', 'audio', 'covers')

const files = readdirSync(srcDir)
  .filter((f) => f.toLowerCase().endsWith('.jpg'))
  .sort()

mkdirSync(outDir, { recursive: true })

let failed = false
for (const file of files) {
  const src = join(srcDir, file)
  const out = join(outDir, file)
  const before = statSync(src).size
  try {
    execFileSync('ffmpeg', [
      '-y',
      '-i', src,
      '-vf', 'scale=128:128:force_original_aspect_ratio=increase,crop=128:128',
      '-q:v', '3',
      out,
    ], { stdio: 'ignore' })
  } catch {
    console.error(`covers: ffmpeg failed for ${file}`)
    failed = true
    continue
  }
  const after = statSync(out).size
  console.log(`${file}: ${before} B -> ${after} B`)
}

if (failed) process.exit(1)
