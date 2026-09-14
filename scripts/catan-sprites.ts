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
import { SPRITES, SPRITE_NAMES, TILE_ANCHOR_X, TILE_ANCHOR_Y, TILE_MASK_FILE, TILE_MASK_HEIGHT, TILE_MASK_WIDTH } from '../src/components/catan/sprites'
import type { SpriteName } from '../src/components/catan/sprites'

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
  if (name === 'sea') return 'board origin (0,0)'
  if (name.startsWith('tile-')) return 'hex centre'
  if (name.startsWith('token-')) return 'hex centre'
  if (name === 'robber') return 'hex centre'
  if (name === 'settlement' || name === 'city') return 'vertex point'
  if (name.startsWith('road-')) return 'edge midpoint rounded down'
  if (name.startsWith('harbor-')) return 'harbor plate rect origin'
  if (name.startsWith('pier-')) return 'seaward-offset edge midpoint'
  return ''
}

function specMarkdown(): string {
  const rows = SPRITE_NAMES.map((name) => {
    const meta = SPRITES[name]
    return `| ${meta.file} | ${meta.width} x ${meta.height} | (${meta.anchorX}, ${meta.anchorY}) | ${placedOn(name)} | ${meta.recolor ? 'yes' : 'no'} |`
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

## Files

| File | Size | Anchor | Placed on | Recolor |
|---|---|---|---|---|
${rows}
| ${TILE_MASK_FILE} | ${TILE_MASK_WIDTH} x ${TILE_MASK_HEIGHT} | (${TILE_ANCHOR_X}, ${TILE_ANCHOR_Y}) | guide only, not rendered | no |

## Player-colour key

Recolor sprites use exactly #FF00FF (base), #FF80FF (highlight) and #800080 (shade). The renderer replaces them with the player's base colour, mix(base, white, 0.4) and mix(base, black, 0.55). Every other colour is drawn as-is.

## Workflow

1. Edit the PNG in \`assets/pixel-art/catan/\` at exactly the listed size (do not change the canvas size or anchor).
2. Run \`npm run catan-sprites\` to validate and copy the art to \`public/catan/\`.
3. Rebuild. To regenerate the procedural templates, run \`npm run catan-sprites:export -- --force\`.
`
}

function exportArt(): void {
  const files = new Map<string, Uint8Array>()
  for (const name of SPRITE_NAMES) {
    const meta = SPRITES[name]
    files.set(meta.file, encode(renderProceduralSprite(name)))
  }
  const mask = tileMaskBuffer()
  files.set(TILE_MASK_FILE, encode(mask))

  const outputs = [...files.keys()].map((file) => path.join(ASSET_DIR, file))
  outputs.push(path.join(ASSET_DIR, 'SPEC.md'))
  for (const file of files.keys()) outputs.push(path.join(PREVIEW_DIR, file))

  const force = process.argv.includes('--force')
  const existing = outputs.filter((file) => fs.existsSync(file))
  if (existing.length > 0 && !force) {
    console.error('refusing to overwrite existing files (use --force):')
    for (const file of existing) console.error(`  ${file}`)
    process.exit(1)
  }

  fs.mkdirSync(ASSET_DIR, { recursive: true })
  fs.mkdirSync(PREVIEW_DIR, { recursive: true })
  for (const [file, bytes] of files) {
    fs.writeFileSync(path.join(ASSET_DIR, file), bytes)
    fs.writeFileSync(path.join(PREVIEW_DIR, file), encode(scale4x(decode(bytes))))
  }
  fs.writeFileSync(path.join(ASSET_DIR, 'SPEC.md'), specMarkdown())
  console.log(`exported ${files.size} sprites + SPEC.md to ${ASSET_DIR}`)
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

  if (errors.length > 0) {
    for (const error of errors) console.error(error)
    process.exit(1)
  }
  console.log(`validated ${SPRITE_NAMES.length} sprites + ${TILE_MASK_FILE} and copied them to ${PUBLIC_DIR}`)
}

const mode = process.argv[2]
if (mode === 'export') exportArt()
else if (mode === 'validate') validateArt()
else {
  console.error('usage: tsx scripts/catan-sprites.ts <export|validate> [--force]')
  process.exit(1)
}
