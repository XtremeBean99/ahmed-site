// scripts/draw-side-table-side.mjs
//
// The side table's left side, under the desk. The hand-drawn table stops at its
// front-left edge (x 740), so below the desk top the room showed wall and floor
// where the cabinet's side should be. This paints that side into both source
// frames (assets/pixel-art/background/side-table1.png and side-table2.png):
// a panel in the cabinet's depth, a back stile, and the plinth carried round
// from the front. Only pixels below the desk's bottom outline and left of the
// desk's leg are touched, so the desk still reads as in front.
//
// Idempotent: the panel is computed from the background alone. Afterwards run
//   node scripts/extract-side-table.mjs && npm run lighting

import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const bgDir = join(__dirname, '..', 'assets', 'pixel-art', 'background')
const FRAMES = ['side-table1.png', 'side-table2.png']

// Geometry, measured off the art. The front face's left edge is x 740 and its
// foot (the plinth's bottom outline) is y 616 there. Depth runs up-left along
// the table top's right edge, 84 px across for 40 px up.
const FRONT_X = 741
const FOOT_Y = 616
const PLINTH_TOP_Y = 596
const DEPTH_SLOPE = 40 / 84
const BACK_X = 652 // the back stile's outline
const DESK_LEG_X = 707 // the desk's front-right leg starts here and hides the rest
const SCAN_FROM_Y = 480

// Desk top, its front edge and outline: everything above the panel in a column.
const DESK = new Set(['844b37', '2a1012', '59322d', '000000'])

const C = {
  ink: [0x00, 0x00, 0x00],
  edge: [0x61, 0x43, 0x45], // the back corner catching the lamp
  stile: [0x49, 0x2b, 0x29],
  stileShadow: [0x2d, 0x1a, 0x20],
  field: [0x3e, 0x21, 0x25],
  shade: [0x2f, 0x1c, 0x20], // the desk top's shadow on the side
  groove: [0x2b, 0x14, 0x1a],
  bevel: [0x49, 0x2b, 0x29],
  plinth: [0x2b, 0x14, 0x1a],
}

const along = (x, y0) => Math.round(y0 - (FRONT_X - x) * DEPTH_SLOPE)

function colourAt(x, y, deskBottom) {
  const foot = along(x, FOOT_Y)
  const plinthTop = along(x, PLINTH_TOP_Y)
  if (y > foot || x < BACK_X) return null
  if (y === foot || x === BACK_X || y === plinthTop) return C.ink
  if (y > plinthTop) return C.plinth
  const shaded = y - deskBottom < 3
  if (x === BACK_X + 1) return shaded ? C.stile : C.edge
  if (x <= BACK_X + 4) return shaded ? C.stileShadow : C.stile
  if (x === BACK_X + 5) return C.stileShadow
  if (y === plinthTop - 3) return C.groove
  if (y === plinthTop - 2) return C.bevel
  return shaded ? C.shade : C.field
}

async function main() {
  const bg = await sharp(join(bgDir, 'background.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = bg.info.width
  const hex = (x, y) => {
    const i = (y * W + x) * 4
    return [0, 1, 2].map((k) => bg.data[i + k].toString(16).padStart(2, '0')).join('')
  }

  // Per column, the first row below the desk top's bottom outline.
  const deskBottom = new Map()
  for (let x = BACK_X; x < DESK_LEG_X; x++) {
    let y = SCAN_FROM_Y
    while (DESK.has(hex(x, y))) y++
    deskBottom.set(x, y)
  }

  for (const file of FRAMES) {
    const src = join(bgDir, file)
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    let painted = 0
    for (let x = BACK_X; x < DESK_LEG_X; x++) {
      const top = deskBottom.get(x)
      for (let y = top; y <= along(x, FOOT_Y); y++) {
        const c = colourAt(x, y, top)
        if (!c) continue
        const i = (y * info.width + x) * 4
        data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255
        painted++
      }
    }
    // Read fully before writing, so the source can be overwritten in place.
    const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer()
    await writeFile(src, png)
    console.log(`${file}: ${painted} px of side panel`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
