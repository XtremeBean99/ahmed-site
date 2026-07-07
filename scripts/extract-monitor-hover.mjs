import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const srcDir = join(__dirname, '..', 'assets', 'pixel-art', 'room-view-monitor')

// Union bbox of the base + 3 highlight frames, +2px pad (pre-measured across
// all four 1408×768 canvases so hover playback never jitters).
const MON = { left: 235, top: 257, width: 402, height: 350 }

// Constant bbox of all 18 loading frames (identical in every frame — the
// screen-glass quad). The 1380×752 loading canvas is top-left aligned with
// the 1408×768 stage, so these are stage coordinates.
const LOAD = { left: 266, top: 275, width: 214, height: 171 }

// Room-view desktop speakers: lamp-on/lamp-off pair, union bbox +2px pad
// (identical content bbox in both variants, so the crossfade cannot jitter).
const SPK = { left: 146, top: 292, width: 435, height: 218 }

const hoverSources = [
  'monitor-keyboard-mouse.png',
  'monitor-keyboard-mouse-highlight-1.png',
  'monitor-keyboard-mouse-highlight-2.png',
  'monitor-keyboard-mouse-highlight-3.png',
]

for (let i = 0; i < hoverSources.length; i++) {
  await sharp(join(srcDir, hoverSources[i]))
    .extract(MON)
    .png()
    .toFile(join(outDir, `monitor-${i + 1}.png`))
  console.log(`monitor-${i + 1}.png ${MON.width}x${MON.height} at stage (${MON.left},${MON.top})`)
}

for (let i = 1; i <= 18; i++) {
  await sharp(join(srcDir, 'monitor-loading', `monitor-loading-screen-${i}.png`))
    .extract(LOAD)
    .png()
    .toFile(join(outDir, `monitor-loading-${i}.png`))
}
console.log(`monitor-loading-1..18 ${LOAD.width}x${LOAD.height} at stage (${LOAD.left},${LOAD.top})`)

for (const name of ['room-speakers.png', 'room-speakers-lamp-off.png']) {
  await sharp(join(srcDir, name))
    .extract(SPK)
    .png()
    .toFile(join(outDir, name))
  console.log(`${name} ${SPK.width}x${SPK.height} at stage (${SPK.left},${SPK.top})`)
}

// Lamp-off desk close-up is used at full canvas size; pass through sharp to
// normalise the PNG encoding.
await sharp(join(srcDir, 'close-up-desk', 'desk-closeup-lamp-off.png'))
  .png()
  .toFile(join(outDir, 'desk-closeup-lamp-off.png'))
console.log('desk-closeup-lamp-off.png (full canvas)')
