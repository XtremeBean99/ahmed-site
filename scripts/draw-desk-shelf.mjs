import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Draws the strip of wall and shelf that sits ABOVE the desk close-up, for the
// desk view's "look up" pan (DeskShelf.tsx). The close-up only shows the
// underside of the shelf's bottom board in its top 60 rows; this extends that
// shelf upward: its side boards, back wall and the inner face of the left
// board (continuing the art's own diagonal), a top board drawn like the bottom
// one (front face, then underside), and the wall above, with the lamp's light
// continuing the close-up's 45-degree edge. Every colour is sampled from the
// close-up, once per lamp state, so the seam at row 0 is invisible.
//
// Output (1408 x EXT_H, stage rows -EXT_H..-1):
//   public/room/desk-shelf-top.png            (lamp on, from desk-closeup.png)
//   public/room/desk-shelf-top-lamp-off.png   (from desk-closeup-lamp-off.png)
// EXT_H and the board rows must match DESK_SHELF in src/lib/room/desk-shelf.ts.
//
//   node scripts/draw-desk-shelf.mjs

const __dirname = dirname(fileURLToPath(import.meta.url))
const roomDir = join(__dirname, '..', 'public', 'room')

const W = 1408
const EXT_H = 270
// Close-up columns (measured): outer outline of the left side board, its inner
// outline (the interior starts one column right), and the same for the right.
const L_OUT = 36
const L_IN = 57
const R_IN = 911
const R_OUT = 932
// Top board, in stage rows (negative = above the close-up): front face from
// TOP_FACE to TOP_UNDER - 1, underside from TOP_UNDER to INTERIOR_TOP - 1.
const TOP_FACE = -232
const TOP_UNDER = -212
const INTERIOR_TOP = -196
// The left board's inner face: its edge is at x 75 on row 0 and leans 0.24 px
// outward per row going up (measured off rows 0..22 of the close-up).
const INNER_EDGE_X0 = 75
const INNER_EDGE_SLOPE = 0.24
// The lamp light on the wall: lit left of x = y + 195 (rows 67..118 of the close-up).
const lit = (x, y) => x < y + 195

async function draw(srcName, outName) {
  const { data, info } = await sharp(join(roomDir, srcName)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const at = (x, y) => {
    const i = (y * info.width + x) * 4
    return [data[i], data[i + 1], data[i + 2], 255]
  }
  const OUTLINE = at(L_OUT, 10)
  const WALL_LIT = at(10, 10)
  const WALL = at(1300, 10)
  const INNER_FACE = at(65, 5)
  const out = Buffer.alloc(W * EXT_H * 4)
  const put = (x, r, c) => { const i = (r * W + x) * 4; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = c[3] }

  for (let r = 0; r < EXT_H; r++) {
    const y = r - EXT_H
    for (let x = 0; x < W; x++) {
      const inShelf = x >= L_OUT && x <= R_OUT && y >= TOP_FACE
      if (!inShelf) { put(x, r, lit(x, y) ? WALL_LIT : WALL); continue }
      const sideBoard = x <= L_IN || x >= R_IN
      // Outline round the whole shelf top, and under the top board's face and underside.
      if (y === TOP_FACE || x === L_OUT || x === R_OUT) { put(x, r, OUTLINE); continue }
      if (sideBoard) { put(x, r, at(x, 10)); continue }
      if (y < TOP_UNDER) {
        // Front face: the bottom board's face (rows 26..41, not its lit lip), outline at its foot.
        put(x, r, y === TOP_UNDER - 1 ? OUTLINE : at(x, 26 + Math.min(15, y - TOP_FACE - 1)))
        continue
      }
      if (y < INTERIOR_TOP) {
        // Underside: the bottom board's underside colour, outlined where it meets the back wall.
        put(x, r, y === INTERIOR_TOP - 1 ? OUTLINE : at(x, 52))
        continue
      }
      // Interior: the close-up's row 0 continued upward, the left inner face widening.
      const edge = INNER_EDGE_X0 + Math.round(-y * INNER_EDGE_SLOPE)
      put(x, r, x > L_IN && x <= edge ? INNER_FACE : at(x, 0))
    }
  }
  await sharp(out, { raw: { width: W, height: EXT_H, channels: 4 } }).png().toFile(join(roomDir, outName))
  console.log(`${outName}: ${W}x${EXT_H}`)
}

await draw('desk-closeup.png', 'desk-shelf-top.png')
await draw('desk-closeup-lamp-off.png', 'desk-shelf-top-lamp-off.png')
