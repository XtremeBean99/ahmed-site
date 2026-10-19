// Draws the windowsill bonsai at five growth stages, picked by how many times the
// visitor has been to the room (lib/room/bonsai.ts):
//
//   1 sprout · 2 sapling · 3 young tree · 4 the full tree (the hand-drawn art) · 5 in bloom
//
//   node scripts/draw-bonsai.mjs && npm run lighting
//
// Stage 4 is assets/pixel-art/bonsai/tree1..5.png, cropped to the sprite box. Stages 1-3
// are drawn here in the same palette on the same pot: the pot is the hand-drawn one with
// the trunk taken out and the stretch of back rim it hid redrawn. Stage 5 is stage 4 with blossoms on the pads
// and petals for the falling leaves.
//
// Each stage gets six frames, written as public/room/bonsai-<stage>-<frame>.png:
//   1 rest · 2 hover, #f6da9c highlight grown 1 px · 3-6 hover, highlight 2 px, swaying
// with leaves drifting off. AnimatedSprite plays 1 -> 2 on hover, then loops 3-6.
import sharp from 'sharp'
import { readdir, unlink } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const srcDir = join(__dirname, '..', 'assets', 'pixel-art', 'bonsai')

// The sprite box on the 1408x768 stage (objects.ts), unchanged from the original crop.
const BOX = { left: 1241, top: 291, width: 99, height: 131 }
const W = BOX.width
const H = BOX.height

const C = {
  ink: [0, 0, 0],
  leafDark: [44, 68, 32],
  leafLight: [112, 129, 75],
  leafMid: [78, 99, 52],
  soil: [58, 73, 42],
  potTop: [148, 106, 90],
  bark: [72, 44, 40],
  barkShadow: [30, 16, 15],
  barkLight: [120, 86, 77],
  barkMid: [98, 67, 60],
  petal: [232, 150, 166],
  petalLight: [250, 214, 214],
  petalShade: [196, 104, 128],
}
const HIGHLIGHT = [0xf6, 0xda, 0x9c]

// ---------------------------------------------------------------- image helpers

const idx = (x, y) => (y * W + x) * 4
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H
const alpha = (img, x, y) => (inside(x, y) ? img[idx(x, y) + 3] : 0)
const rgb = (img, x, y) => { const i = idx(x, y); return [img[i], img[i + 1], img[i + 2]] }
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
function put(img, x, y, c) {
  if (!inside(x, y)) return
  const i = idx(x, y)
  img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; img[i + 3] = 255
}

// Deterministic per-pixel noise, so every run draws the same tree.
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

async function loadFrame(n) {
  return sharp(join(srcDir, `tree${n}.png`)).extract(BOX).ensureAlpha().raw().toBuffer()
}

// ---------------------------------------------------------------- the empty pot

// The trunk and its roots hide the pot's back corner. The lines below were measured off
// the hand-drawn pot where it shows: the back rim's outer edge runs from the corner at
// (43, 82) to (69, 87), its inner edge from (51, 86) to (65, 91), and the left rim's inner
// edge climbs about 3 px per row to meet it. Inside PATCH every pixel is redrawn from
// these lines except the left rim, which is already whole in the original.
const PATCH = { x0: 36, x1: 69, y0: 72, y1: 98 }
const outerBack = (x) => Math.round(82 + (x - 43) / 5.2)
const innerBack = (x) => Math.round(86 + (x - 51) / 2.8)
const leftInner = (y) => 33 + (91 - y) * 3.2
// Nothing of the pot is above its back corner.
const POT_TOP = 82

function emptyPot(src) {
  const pot = Buffer.from(src)
  for (let y = 0; y < POT_TOP; y++) for (let x = 0; x < W; x++) pot.fill(0, idx(x, y), idx(x, y) + 4)
  for (let y = Math.max(PATCH.y0, POT_TOP); y <= PATCH.y1; y++) for (let x = PATCH.x0; x <= PATCH.x1; x++) {
    const xl = leftInner(y)
    if (x <= xl + 1 && x < 43) {
      // The left rim is whole in the original, bar a stray root pixel or two.
      const c = rgb(pot, x, y)
      if (alpha(pot, x, y) && !same(c, C.ink) && !same(c, C.potTop)) put(pot, x, y, C.potTop)
      continue
    }
    if (x >= 43 && y < outerBack(x)) pot.fill(0, idx(x, y), idx(x, y) + 4)
    else if (x >= 43 && y === outerBack(x)) put(pot, x, y, C.ink)
    else if (x <= xl + 1) put(pot, x, y, C.potTop)
    else if (x <= xl + 3.5) put(pot, x, y, C.ink)
    else if (x >= 51 && y < innerBack(x)) put(pot, x, y, C.potTop)
    else if (x >= 51 && y === innerBack(x)) put(pot, x, y, C.ink)
    else put(pot, x, y, C.soil)
  }
  return pot
}

// ---------------------------------------------------------------- drawing the young trees

// A trunk is a cubic Bezier from the soil up; r0 at the base tapering to r1.
function bezier(p, t) {
  const u = 1 - t
  return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k])
}

function strokeMask(limbs, sway) {
  // label per pixel: 0 empty, else 1 and a lateral offset in [-1,1] for shading
  const mask = new Uint8Array(W * H)
  const side = new Float32Array(W * H)
  for (const { pts, r0, r1 } of limbs) {
    const pp = pts.map(([x, y], k) => [x + sway * (k / 3) * ((H - y) / H) * 2, y])
    const N = 80
    for (let s = 0; s <= N; s++) {
      const t = s / N
      const [cx, cy] = bezier(pp, t)
      const [nx2, ny2] = bezier(pp, Math.min(1, t + 0.01))
      const [px2, py2] = bezier(pp, Math.max(0, t - 0.01))
      let tx = nx2 - px2, ty = ny2 - py2
      const len = Math.hypot(tx, ty) || 1
      tx /= len; ty /= len
      const r = r0 + (r1 - r0) * t
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        if (!inside(x, y)) continue
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy
        if (dx * dx + dy * dy > r * r) continue
        // Signed distance across the limb: + is its right-hand side (lit; the window is behind-right).
        const lat = (dx * -ty + dy * tx) / Math.max(r, 0.5)
        mask[y * W + x] = 1
        side[y * W + x] = -lat
      }
    }
  }
  return { mask, side }
}

function padMask(pads, sway) {
  const mask = new Int16Array(W * H).fill(-1)
  pads.forEach(({ cx, cy, rx, ry, bumps = [] }, n) => {
    const scx = cx + sway * ((H - cy) / H) * 2
    const blobs = [{ x: scx, y: cy, rx, ry }, ...bumps.map(([bx, by, br]) => ({ x: scx + bx, y: cy + by, rx: br, ry: br * 0.75 }))]
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (blobs.some((b) => ((x + 0.5 - b.x) / b.rx) ** 2 + ((y + 0.5 - b.y) / b.ry) ** 2 <= 1)) mask[y * W + x] = n
    }
  })
  return mask
}

function drawTree(pot, { limbs, pads }, sway = 0) {
  const img = Buffer.from(pot)
  const { mask: wood, side } = strokeMask(limbs, sway)
  const leaf = padMask(pads, sway)
  const soilLine = (x, y) => alpha(pot, x, y) && same(rgb(pot, x, y), C.soil)

  // Bark: lit on its right, shadowed on its left, a few knots.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!wood[y * W + x]) continue
    const s = side[y * W + x] + (hash(x, y, 1) - 0.5) * 0.2
    put(img, x, y, s > 0.62 ? C.barkLight : s > 0.3 ? C.barkMid : s < -0.55 ? C.barkShadow : C.bark)
  }
  // Pads: lit from above and to the right, darker underneath, speckled like the hand-drawn ones.
  pads.forEach(({ cx, cy, rx, ry }, n) => {
    const scx = cx + sway * ((H - cy) / H) * 2
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (leaf[y * W + x] !== n) continue
      const u = (x - scx) / rx, v = (y - cy) / ry
      const shade = -v * 1.1 + u * 0.35 + 0.15 + (hash(x, y, 2) - 0.5) * 0.25
      put(img, x, y, shade > 0.12 ? C.leafLight : shade > -0.02 && hash(x, y, 3) > 0.5 ? C.leafMid : C.leafDark)
    }
  })
  // Ink: a 1 px outline round wood and leaves, and between a pad and whatever it covers.
  const ink = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    const here = leaf[i] >= 0 ? 'leaf' + leaf[i] : wood[i] ? 'wood' : null
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (!inside(nx, ny)) continue
      const j = ny * W + nx
      const there = leaf[j] >= 0 ? 'leaf' + leaf[j] : wood[j] ? 'wood' : null
      if (!there) continue
      // Outside the tree: ink unless it is the soil the trunk grows out of.
      if (!here && !(soilLine(x, y) && there === 'wood')) ink.push([x, y])
      // A pad drawn over the wood or over a pad behind it gets its own edge.
      if (here && here !== there && there.startsWith('leaf') && leaf[i] < leaf[j]) ink.push([x, y])
      if (here === 'wood' && there.startsWith('leaf')) ink.push([x, y])
    }
  }
  for (const [x, y] of ink) put(img, x, y, C.ink)
  return img
}

// The young trees grow toward the hand-drawn one: a top crown, a pad out to the left
// and one to the right, an S-curved trunk leaning right.
const BASE = [54, 98]
const roots = (r) => [
  { pts: [[BASE[0] - 1, BASE[1] - 2], [BASE[0] - 4, BASE[1]], [BASE[0] - 7, BASE[1] + 1], [BASE[0] - 9 - r, BASE[1] + 2]], r0: r * 0.55, r1: 0.6 },
  { pts: [[BASE[0] + 1, BASE[1] - 2], [BASE[0] + 4, BASE[1]], [BASE[0] + 7, BASE[1] + 1], [BASE[0] + 8 + r, BASE[1] + 2]], r0: r * 0.5, r1: 0.6 },
]
const YOUNG = {
  1: {
    limbs: [{ pts: [BASE, [53, 92], [56, 88], [54, 83]], r0: 1.4, r1: 0.9 }],
    pads: [
      { cx: 49, cy: 85, rx: 4, ry: 2.4 },
      { cx: 59, cy: 84, rx: 4.5, ry: 2.6 },
      { cx: 54, cy: 79, rx: 5.5, ry: 3.6, bumps: [[-2, -2, 3]] },
    ],
  },
  2: {
    limbs: [
      { pts: [BASE, [46, 86], [64, 76], [52, 62]], r0: 3.4, r1: 1.4 },
      { pts: [[52, 80], [47, 77], [43, 76], [38, 73]], r0: 1.4, r1: 0.8 },
      ...roots(2),
    ],
    pads: [
      { cx: 37, cy: 72, rx: 8, ry: 4, bumps: [[2, -2, 4]] },
      { cx: 52, cy: 56, rx: 14, ry: 7, bumps: [[-6, -4, 6], [4, -5, 6]] },
    ],
  },
  3: {
    limbs: [
      { pts: [BASE, [40, 80], [72, 68], [46, 38]], r0: 6, r1: 2.4 },
      { pts: [[50, 68], [40, 63], [32, 62], [22, 56]], r0: 2.4, r1: 1 },
      { pts: [[57, 64], [64, 62], [70, 63], [76, 58]], r0: 2.2, r1: 1 },
      ...roots(4),
    ],
    pads: [
      { cx: 20, cy: 53, rx: 13, ry: 6, bumps: [[-3, -3, 7], [5, -3, 5]] },
      { cx: 76, cy: 55, rx: 13, ry: 6, bumps: [[-3, -3, 6], [5, -2, 5]] },
      { cx: 44, cy: 28, rx: 26, ry: 10, bumps: [[-12, -4, 9], [-2, -8, 10], [10, -6, 9], [18, -1, 7]] },
    ],
  },
}

// ---------------------------------------------------------------- hover frames

// The art's main body: opaque pixels in clumps of 20 or more, so drifting leaves and
// petals do not get a highlight halo of their own.
function bodyMask(img) {
  const seen = new Uint8Array(W * H)
  const body = new Uint8Array(W * H)
  for (let start = 0; start < W * H; start++) {
    if (seen[start] || !img[start * 4 + 3]) continue
    const comp = [start]
    seen[start] = 1
    for (let n = 0; n < comp.length; n++) {
      const x = comp[n] % W, y = Math.floor(comp[n] / W)
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy
        if (!inside(nx, ny)) continue
        const j = ny * W + nx
        if (!seen[j] && img[j * 4 + 3]) { seen[j] = 1; comp.push(j) }
      }
    }
    if (comp.length >= 20) for (const j of comp) body[j] = 1
  }
  return body
}

// The room's hover outline: #f6da9c grown n px (4-neighbour steps) round the body.
function highlight(img, n) {
  const out = Buffer.from(img)
  let edge = bodyMask(img)
  for (let step = 0; step < n; step++) {
    const next = Uint8Array.from(edge)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (edge[i]) continue
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && edge[(y + dy) * W + x + dx])) {
        next[i] = 1
        if (!out[i * 4 + 3]) put(out, x, y, HIGHLIGHT)
      }
    }
    edge = next
  }
  return out
}

// ---------------------------------------------------------------- leaves and blossoms

// Falling leaves for the drawn stages: each starts under a pad and drifts down and to the
// left, one per pad, staggered so the loop never empties.
function fallingLeaves(img, pads, frame, sway) {
  const out = Buffer.from(img)
  pads.forEach(({ cx, cy, rx, ry }, n) => {
    for (let leaf = 0; leaf < 2; leaf++) {
      const phase = (frame + leaf * 2 + n) % 4
      const x0 = Math.round(cx + sway + (hash(n, leaf, 7) - 0.3) * rx)
      const y0 = Math.round(cy + ry + 1)
      const x = x0 - phase * 2 - (phase > 1 ? 1 : 0)
      const y = y0 + phase * 3
      if (inside(x, y) && !alpha(out, x, y)) put(out, x, y, (n + leaf) % 3 ? C.leafLight : C.leafMid)
    }
  })
  return out
}

const isLeaf = (c) => same(c, C.leafLight) || same(c, C.leafDark)

// Blossoms for stage 5: small five-pixel flowers and two-pixel buds where the crown is
// solid leaf all round, spaced out, lit on top and shaded underneath.
function blossomSites(img) {
  const sites = []
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    let solid = true
    for (let dy = -2; dy <= 2 && solid; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!alpha(img, x + dx, y + dy) || !isLeaf(rgb(img, x + dx, y + dy))) { solid = false; break }
    }
    // Mostly on the lit tops of the pads, where flowers would face the window.
    const lit = same(rgb(img, x, y), C.leafLight)
    if (!solid || hash(x, y, 11) > (lit ? 0.12 : 0.03)) continue
    if (sites.some(([sx, sy]) => Math.abs(sx - x) + Math.abs(sy - y) < 13)) continue
    sites.push([x, y])
  }
  return sites
}

function blossom(img, sites) {
  const out = Buffer.from(img)
  for (const [n, [x, y]] of sites.entries()) {
    if (n % 3 === 2) {
      // a bud: two pixels
      put(out, x, y, C.petal)
      put(out, x, y + 1, C.petalShade)
      continue
    }
    put(out, x, y - 1, C.petal)
    put(out, x - 1, y, C.petal)
    put(out, x + 1, y, C.petal)
    put(out, x, y + 1, C.petalShade)
    put(out, x, y, C.petalLight)
  }
  // The hand-drawn falling leaves (loose single pixels off the tree) become petals.
  const body = bodyMask(img)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (alpha(img, x, y) && !body[y * W + x]) put(out, x, y, hash(x, y, 13) > 0.5 ? C.petal : C.petalLight)
  }
  return out
}

// ---------------------------------------------------------------- output

const SWAY = [0, 0.6, 1, 0.6]

async function main() {
  const originals = []
  for (let n = 1; n <= 5; n++) originals.push(await loadFrame(n))
  const pot = emptyPot(originals[0])

  const stages = {}
  for (const stage of [1, 2, 3]) {
    const tree = YOUNG[stage]
    const rest = drawTree(pot, tree, 0)
    const sway = SWAY.map((sw, f) => (stage === 1 ? drawTree(pot, tree, sw * 0.5) : fallingLeaves(drawTree(pot, tree, sw), tree.pads, f, sw)))
    stages[stage] = [rest, highlight(rest, 1), ...sway.map((img) => highlight(img, 2))]
  }
  stages[4] = [originals[0], highlight(originals[0], 1), ...originals.slice(1).map((img) => highlight(img, 2))]
  const sites = blossomSites(originals[0])
  const bloom = originals.map((img) => blossom(img, sites))
  stages[5] = [bloom[0], highlight(bloom[0], 1), ...bloom.slice(1).map((img) => highlight(img, 2))]

  for (const name of await readdir(outDir)) if (/^bonsai-\d(-\d)?\.png$/.test(name)) await unlink(join(outDir, name))
  for (const [stage, frames] of Object.entries(stages)) {
    for (const [f, data] of frames.entries()) {
      await sharp(data, { raw: { width: W, height: H, channels: 4 } })
        .png({ compressionLevel: 9 })
        .toFile(join(outDir, `bonsai-${stage}-${f + 1}.png`))
    }
  }
  console.log(`bonsai: 5 stages x 6 frames, ${W}x${H}, ${sites.length} blossoms`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) await main()

export { emptyPot, drawTree, YOUNG, loadFrame, W, H, sharp }
