/**
 * Catan sprite pipeline:
 *   export   render every manifest sprite procedurally into assets/pixel-art/catan
 *            (refuses to overwrite existing art unless --force)
 *   validate check every manifest file in assets/pixel-art/catan and copy it
 *            to public/catan (non-zero exit on any size error)
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { TILE_MASK_OFFSETS, createBuffer, renderProceduralSprite } from '../src/components/catan/pixel-art'
import { decodePNG, encodePNG } from '../src/components/catan/png'
import { renderUiSprite } from '../src/components/catan/ui-art'
import { SPRITES, SPRITE_NAMES, TILE_ANCHOR_X, TILE_ANCHOR_Y, TILE_MASK_FILE, TILE_MASK_HEIGHT, TILE_MASK_WIDTH } from '../src/components/catan/sprites'
import type { SpriteName } from '../src/components/catan/sprites'
import { UI_SPRITES, UI_SPRITE_NAMES } from '../src/components/catan/ui-sprites'
import type { UiSpriteName } from '../src/components/catan/ui-sprites'

const ASSET_DIR = path.join(process.cwd(), 'assets', 'pixel-art', 'catan')
const PREVIEW_DIR = path.join(ASSET_DIR, 'preview')
const PUBLIC_DIR = path.join(process.cwd(), 'public', 'catan')

const RECOLOR_KEYS: [number, number, number][] = [
  [255, 0, 255],
  [255, 128, 255],
  [128, 0, 128],
]

function encode(buffer: { width: number; height: number; data: Uint8ClampedArray }): Uint8Array {
  return encodePNG(buffer, { deflate: zlib.deflateSync })
}

function decode(bytes: Uint8Array) {
  return decodePNG(bytes, { inflate: zlib.inflateSync })
}

function scale4x(buffer: { width: number; height: number; data: Uint8ClampedArray }) {
  const out = createBuffer(buffer.width * 4, buffer.height * 4)
  for (let y = 0; y < buffer.height; y++) {
    for (let x = 0; x < buffer.width; x++) {
      const si = (y * buffer.width + x) * 4
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const di = ((y * 4 + dy) * out.width + (x * 4 + dx)) * 4
          out.data[di] = buffer.data[si]
          out.data[di + 1] = buffer.data[si + 1]
          out.data[di + 2] = buffer.data[si + 2]
          out.data[di + 3] = buffer.data[si + 3]
        }
      }
    }
  }
  return out
}

function tileMaskBuffer() {
  const out = createBuffer(TILE_MASK_WIDTH, TILE_MASK_HEIGHT)
  const mask = new Set(TILE_MASK_OFFSETS.map((off) => `${off.x},${off.y}`))
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      if (!mask.has(`${x - TILE_ANCHOR_X},${y - TILE_ANCHOR_Y}`)) continue
      const i = (y * out.width + x) * 4
      out.data[i] = 255
      out.data[i + 1] = 255
      out.data[i + 2] = 255
      out.data[i + 3] = 255
    }
  }
  return out
}

function placedOn(name: SpriteName): string {
  if (name === 'sea') return 'CSS sea tile from board origin, tiled (not composited)'
  if (name.startsWith('tile-')) return 'hex centre'
  if (name.startsWith('token-')) return 'hex centre'
  if (name === 'robber') return 'hex centre'
  if (name === 'settlement' || name === 'city') return 'vertex point'
  if (name.startsWith('road-')) return 'edge midpoint rounded down'
  if (name.startsWith('harbor-')) return 'harbor plate rect origin'
  if (name.startsWith('pier-')) return 'seaward-offset edge midpoint'
  return ''
}

function uiSpriteAppearsIn(name: UiSpriteName): string {
  if (name === 'card-longest-road') return 'Longest Road award (victory display)'
  if (name === 'card-largest-army') return 'Largest Army award (victory display)'
  if (name === 'card-back-resource') return 'resource deck back'
  if (name === 'card-back-development') return 'development deck back'
  if (name.startsWith('card-')) return 'player hand card'
  if (name.startsWith('die-')) return 'dice (roll and dice history)'
  if (name === 'icon-vp') return 'victory point totals'
  if (name === 'icon-knight') return 'knight and army counts'
  if (name === 'icon-road') return 'road costs and counts'
  if (name === 'icon-cards') return 'development card deck'
  if (name === 'icon-dev') return 'development card counts'
  return 'resource icons (costs, rates, bank)'
}

function uiSpriteScales(name: UiSpriteName): string {
  if (name.startsWith('card-')) return '1x, 2x'
  if (name.startsWith('die-')) return '1x, 2x'
  return '1x, 2x'
}

function specMarkdown(): string {
  const rows = SPRITE_NAMES.map((name) => {
    const meta = SPRITES[name]
    return `| ${meta.file} | ${meta.width} x ${meta.height} | (${meta.anchorX}, ${meta.anchorY}) | ${placedOn(name)} | ${meta.recolor ? 'yes' : 'no'} |`
  }).join('\n')
  const uiRows = UI_SPRITE_NAMES.map((name) => {
    const meta = UI_SPRITES[name]
    return `| ${meta.file} | ${meta.width} x ${meta.height} | ${uiSpriteAppearsIn(name)} | ${uiSpriteScales(name)} |`
  }).join('\n')
  return `# Catan board sprite contract

All files are PNG RGBA at 1x; one image pixel equals one logical board pixel. Alpha 0 means empty. The tile mask is the canonical hex pixel mask measured by the integer lattice (every island hex has the identical mask).

## Grid

- Canvas: 279 x 265 logical pixels
- Hex centre (axial q, r): x = 139 + 38q + 19r, y = 132 + 33r
- Centre spacing: 38 px horizontally, row step 33 px, row offset 19 px
- Corner offsets from a hex centre (corner order i0..i5): (19,-11), (19,11), (0,22), (-19,11), (-19,-11), (0,-22)
- Sea border: 44 px on all sides of the island vertex span
- Tile mask: ${TILE_MASK_WIDTH} x ${TILE_MASK_HEIGHT}, anchor (${TILE_ANCHOR_X}, ${TILE_ANCHOR_Y})

## Sea and shoreline

The canvases are transparent outside the island. The sea is not composited into the board; the viewport fills with \`sea.png\` as a CSS background tiled from the board origin at the camera scale. A procedural shoreline is drawn on the static layer around the island's outer edge: 1 px #1a1410 just outside the land, then 1 px #cfe3ea foam outside that.

## Files

| File | Size | Anchor | Placed on | Recolor |
|---|---|---|---|---|
${rows}
| ${TILE_MASK_FILE} | ${TILE_MASK_WIDTH} x ${TILE_MASK_HEIGHT} | (${TILE_ANCHOR_X}, ${TILE_ANCHOR_Y}) | guide only, not rendered | no |

## Changed in v3

- sea.png: 279 x 265 full-canvas sprite became a 32 x 32 seamless tile, anchor (0, 0), used only as a tiled CSS background.
- token-*.png: 11 x 11 became 13 x 13, anchor (5, 5) became (6, 6).
- settlement.png: 9 x 9 became 11 x 11, anchor (4, 4) became (5, 5).
- city.png: 13 x 11 became 15 x 13, anchor (6, 5) became (7, 6).
- robber.png: 7 x 10 became 9 x 13, anchor (3, 4) became (4, 6).
- Harbour plates moved 6 px closer to the coast (label offset 28 to 22); roads, piers and harbour plate sizes are unchanged.

## Player-colour key

Recolor sprites use exactly #FF00FF (base), #FF80FF (highlight) and #800080 (shade). The renderer replaces them with the player's base colour, mix(base, white, 0.4) and mix(base, black, 0.55). Every other colour is drawn as-is.

## UI sprites

UI sprites are PNG RGBA at 1x with a 1 px dark outline (#1a1410) and the same warm room palette. They are never tinted by the renderer; red/blue player colours shown in the UI are baked into the art where needed.

| File | Size | Where it appears | UI integer scales |
|---|---|---|---|
${uiRows}

## Workflow

1. Edit the PNG in \`assets/pixel-art/catan/\` at exactly the listed size (do not change the canvas size or anchor).
2. Run \`npm run catan-sprites\` to validate and copy the art to \`public/catan/\`.
3. Rebuild. To regenerate the procedural templates, run \`npm run catan-sprites:export\` (add \`--force\` to overwrite art that already exists).
`
}

function exportArt(): void {
  const files = new Map<string, Uint8Array>()
  for (const name of SPRITE_NAMES) {
    const meta = SPRITES[name]
    files.set(meta.file, encode(renderProceduralSprite(name)))
  }
  for (const name of UI_SPRITE_NAMES) {
    const meta = UI_SPRITES[name]
    files.set(meta.file, encode(renderUiSprite(name)))
  }
  const mask = tileMaskBuffer()
  files.set(TILE_MASK_FILE, encode(mask))

  fs.mkdirSync(ASSET_DIR, { recursive: true })
  fs.mkdirSync(PREVIEW_DIR, { recursive: true })

  const force = process.argv.includes('--force')
  let written = 0
  let kept = 0
  for (const [file, bytes] of files) {
    const assetFile = path.join(ASSET_DIR, file)
    const previewFile = path.join(PREVIEW_DIR, file)
    if (!force && fs.existsSync(assetFile)) {
      kept += 1
      continue
    }
    fs.writeFileSync(assetFile, bytes)
    fs.writeFileSync(previewFile, encode(scale4x(decode(bytes))))
    written += 1
  }
  fs.writeFileSync(path.join(ASSET_DIR, 'SPEC.md'), specMarkdown())
  console.log(`exported ${written} new sprites + SPEC.md to ${ASSET_DIR}${kept > 0 ? ` (kept ${kept} existing, use --force to overwrite)` : ''}`)
}

function validateArt(): void {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true })
  const errors: string[] = []

  for (const name of SPRITE_NAMES) {
    const meta = SPRITES[name]
    const file = path.join(ASSET_DIR, meta.file)
    if (!fs.existsSync(file)) {
      errors.push(`${meta.file} is missing`)
      continue
    }
    let png
    try {
      png = decode(fs.readFileSync(file))
    } catch (error) {
      errors.push(`${meta.file}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (png.width !== meta.width || png.height !== meta.height) {
      errors.push(`${meta.file} is ${png.width}x${png.height}, expected ${meta.width}x${meta.height}`)
      continue
    }

    if (name.startsWith('tile-')) {
      let outside = 0
      for (let y = 0; y < png.height; y++) {
        for (let x = 0; x < png.width; x++) {
          const i = (y * png.width + x) * 4
          if (png.data[i + 3] === 0) continue
          const dx = x - meta.anchorX
          const dy = y - meta.anchorY
          if (!TILE_MASK_OFFSETS.some((off) => off.x === dx && off.y === dy)) outside += 1
        }
      }
      if (outside > 0) console.warn(`${meta.file}: ${outside} opaque pixels outside the tile mask`)
    }

    if (meta.recolor) {
      let hasKey = false
      for (let i = 0; i < png.data.length && !hasKey; i += 4) {
        const r = png.data[i]
        const g = png.data[i + 1]
        const b = png.data[i + 2]
        if (RECOLOR_KEYS.some(([kr, kg, kb]) => r === kr && g === kg && b === kb)) hasKey = true
      }
      if (!hasKey) console.warn(`${meta.file}: no player-colour key pixels found`)
    }

    fs.copyFileSync(file, path.join(PUBLIC_DIR, meta.file))
  }

  const maskFile = path.join(ASSET_DIR, TILE_MASK_FILE)
  if (!fs.existsSync(maskFile)) {
    errors.push(`${TILE_MASK_FILE} is missing`)
  } else {
    const mask = decode(fs.readFileSync(maskFile))
    if (mask.width !== TILE_MASK_WIDTH || mask.height !== TILE_MASK_HEIGHT) {
      errors.push(`${TILE_MASK_FILE} is ${mask.width}x${mask.height}, expected ${TILE_MASK_WIDTH}x${TILE_MASK_HEIGHT}`)
    } else {
      fs.copyFileSync(maskFile, path.join(PUBLIC_DIR, TILE_MASK_FILE))
    }
  }

  for (const name of UI_SPRITE_NAMES) {
    const meta = UI_SPRITES[name]
    const file = path.join(ASSET_DIR, meta.file)
    if (!fs.existsSync(file)) {
      errors.push(`${meta.file} is missing`)
      continue
    }
    let png
    try {
      png = decode(fs.readFileSync(file))
    } catch (error) {
      errors.push(`${meta.file}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    if (png.width !== meta.width || png.height !== meta.height) {
      errors.push(`${meta.file} is ${png.width}x${png.height}, expected ${meta.width}x${meta.height}`)
      continue
    }
    let opaque = 0
    for (let i = 3; i < png.data.length; i += 4) {
      if (png.data[i] !== 0) opaque += 1
    }
    if (opaque === 0) console.warn(`${meta.file}: fully transparent`)
    fs.copyFileSync(file, path.join(PUBLIC_DIR, meta.file))
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(error)
    process.exit(1)
  }
  console.log(`validated ${SPRITE_NAMES.length} board sprites + ${UI_SPRITE_NAMES.length} UI sprites + ${TILE_MASK_FILE} and copied them to ${PUBLIC_DIR}`)
}

const mode = process.argv[2]
if (mode === 'export') exportArt()
else if (mode === 'validate') validateArt()
else {
  console.error('usage: tsx scripts/catan-sprites.ts <export|validate> [--force]')
  process.exit(1)
}
