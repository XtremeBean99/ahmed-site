// Draws the cat on the bed: a ginger cat curled up asleep (two breathing
// frames) and the same cat with its head up, awake. Each pose also gets a
// hover frame with the room's #f6da9c highlight grown 2 px around it.
//
//   node scripts/draw-cat.mjs && npm run lighting
//
// The cat is built from shapes on a 2 stage px art grid (so its outlines are
// 2 px, like the bed's) rather than hand-typed maps: an ellipse body, a round
// head with ears, a tail wrapped round the front. Shading is by height on each
// shape (lit from above), stripes run over the back, then every shape gets a
// black ink edge, including where the head and tail overlap the body.
import sharp from 'sharp'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')

const AW = 48 // art px
const AH = 30
const PX = 2 // stage px per art px
const PAD = 2 // stage px of padding for the highlight

const C = {
  ink: [0, 0, 0],
  base: [196, 124, 78],
  light: [222, 158, 104],
  shadow: [150, 88, 62],
  stripe: [128, 72, 52],
  cream: [232, 208, 184],
  creamShade: [196, 168, 148],
  pink: [206, 140, 132],
  eye: [70, 110, 60],
}
const HIGHLIGHT = [0xf6, 0xda, 0x9c]

/** One pose: shapes in art px. `breath` lifts the back; `awake` raises the head. */
function pose({ breath = 0, awake = false }) {
  // Region id per pixel: 0 empty, 1 body, 2 tail, 3 head, 4 ear
  const region = new Uint8Array(AW * AH)
  const colour = new Array(AW * AH).fill(null)
  const set = (x, y, r) => { if (x >= 0 && y >= 0 && x < AW && y < AH) region[y * AW + x] = r }

  const body = { cx: 27, cy: 20 - breath * 0.5, rx: 16, ry: 8 + breath * 0.6 }
  const head = awake ? { cx: 11, cy: 13, r: 6.6 } : { cx: 11, cy: 19, r: 6.4 }
  const inBody = (x, y) => ((x - body.cx) / body.rx) ** 2 + ((y - body.cy) / body.ry) ** 2 <= 1
  const inHead = (x, y) => (x - head.cx) ** 2 + ((y - head.cy) * 1.08) ** 2 <= head.r ** 2
  // Tail: a band hugging the bottom of the body, front to back, ending under the chin.
  const inTail = (x, y) => {
    const e = ((x - body.cx) / (body.rx + 2.6)) ** 2 + ((y - (body.cy + 1.4)) / (body.ry + 2.2)) ** 2
    return e <= 1 && e >= 0.6 && y > body.cy + 2.5 && x > 7
  }
  // Ears: triangles on the head, pointed up (perked when awake, flatter asleep).
  const ears = awake
    ? [[[6, 3], [4.5, 10], [10, 8]], [[15.5, 3], [12, 8], [17.5, 10]]]
    : [[[5, 10], [4.5, 16], [10, 13.5]], [[15.5, 10.5], [12, 13.5], [17.5, 16]]]
  const inTri = (x, y, [a, b, c]) => {
    const s = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
    const pt = [x, y]
    const d1 = s(pt, a, b), d2 = s(pt, b, c), d3 = s(pt, c, a)
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
  }

  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const px = x + 0.5, py = y + 0.5
    if (inBody(px, py)) set(x, y, 1)
    if (inTail(px, py)) set(x, y, 2)
    if (ears.some((t) => inTri(px, py, t))) set(x, y, 4)
    if (inHead(px, py)) set(x, y, 3)
  }

  // Fill colours
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const r = region[y * AW + x]
    if (!r) continue
    const px = x + 0.5, py = y + 0.5
    let c = C.base
    if (r === 1) {
      const ny = (py - body.cy) / body.ry
      c = ny < -0.5 ? C.light : ny > 0.45 ? C.shadow : C.base
      // Stripes over the back, leaning with the curve.
      for (const sx of [19, 24, 29, 34, 39]) {
        if (Math.abs(px - (sx + 0.35 * (py - body.cy))) < 0.75 && ny < 0.25 && ny > -0.95) c = C.stripe
      }
    } else if (r === 2) {
      c = px < 13 ? C.cream : (Math.floor(px) % 6 < 2 ? C.stripe : C.base)
      if (py > body.cy + body.ry + 1.2 && px >= 13) c = C.shadow
    } else if (r === 4) {
      c = C.base
    } else if (r === 3) {
      const ny = (py - head.cy) / head.r
      c = ny < -0.45 ? C.light : C.base
      // Muzzle and chin
      if (ny > 0.15 && Math.abs(px - head.cx) < 3.6) c = C.cream
      if (ny > 0.65 && Math.abs(px - head.cx) < 3) c = C.creamShade
      // Forehead stripes (the "M")
      if (ny < -0.35 && ny > -0.95 && [head.cx - 1.5, head.cx + 0.5, head.cx + 2.5].some((sx) => Math.abs(px - sx) < 0.4)) c = C.stripe
    }
    colour[y * AW + x] = c
  }
  // Inner ears
  for (const [a, b, cc] of ears) {
    const mx = Math.round((a[0] + b[0] + cc[0]) / 3 - 0.5), my = Math.round((a[1] + b[1] + cc[1]) / 3 - 0.5)
    if (region[my * AW + mx] === 4) colour[my * AW + mx] = C.pink
    if (region[(my - 1) * AW + mx] === 4) colour[(my - 1) * AW + mx] = C.pink
  }
  // Face: closed eyes are short smiles, open eyes are green with a pupil.
  const fy = Math.round(head.cy)
  const hx = Math.round(head.cx)
  const put = (x, y, c) => { if (region[y * AW + x]) colour[y * AW + x] = c }
  if (awake) {
    for (const ex of [hx - 3, hx + 2]) { put(ex, fy, C.eye); put(ex + 1, fy, C.ink); put(ex, fy - 1, C.ink); put(ex + 1, fy - 1, C.eye) }
  } else {
    for (const ex of [hx - 3, hx + 2]) { put(ex, fy, C.ink); put(ex + 1, fy + 1, C.ink); put(ex + 2, fy, C.ink) }
  }
  put(hx, fy + 2, C.pink)
  put(hx + 1, fy + 2, C.pink)
  put(hx, fy + 3, C.ink)
  put(hx + 1, fy + 3, C.ink)

  // Ink: outside edge (8-neighbour) and the seams where head/tail sit on the body.
  const ink = new Uint8Array(AW * AH)
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const r = region[y * AW + x]
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy
      const nr = nx < 0 || ny < 0 || nx >= AW || ny >= AH ? 0 : region[ny * AW + nx]
      if (!r && nr) ink[y * AW + x] = 1
      // A seam: body pixels next to the head or tail (4-neighbour) take the line.
      if (r === 1 && (nr === 3 || nr === 2) && (dx === 0 || dy === 0)) ink[y * AW + x] = 1
      if (r === 4 && nr === 3 && dy === 1 && dx === 0 && !awake) ink[y * AW + x] = 0
    }
  }

  // To RGBA at stage scale.
  const W = AW * PX + PAD * 2, H = AH * PX + PAD * 2
  const out = Buffer.alloc(W * H * 4)
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const c = ink[y * AW + x] ? C.ink : colour[y * AW + x]
    if (!c) continue
    for (let sy = 0; sy < PX; sy++) for (let sx = 0; sx < PX; sx++) {
      const i = ((PAD + y * PX + sy) * W + PAD + x * PX + sx) * 4
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255
    }
  }
  return { W, H, data: out }
}

/** Grows the room's highlight colour `n` stage px around the opaque pixels. */
function highlight({ W, H, data }, n) {
  const out = Buffer.from(data)
  let edge = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) edge[i] = data[i * 4 + 3] ? 1 : 0
  for (let step = 0; step < n; step++) {
    const next = Uint8Array.from(edge)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (edge[y * W + x]) continue
      const hit = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const nx = x + dx, ny = y + dy
        return nx >= 0 && ny >= 0 && nx < W && ny < H && edge[ny * W + nx]
      })
      if (hit) {
        next[y * W + x] = 1
        const i = (y * W + x) * 4
        out[i] = HIGHLIGHT[0]; out[i + 1] = HIGHLIGHT[1]; out[i + 2] = HIGHLIGHT[2]; out[i + 3] = 255
      }
    }
    edge = next
  }
  return { W, H, data: out }
}

const write = ({ W, H, data }, name) =>
  sharp(data, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toFile(join(outDir, name))

const poses = [pose({ breath: 0 }), pose({ breath: 1 }), pose({ awake: true })]
await Promise.all(poses.flatMap((p, i) => [write(p, `cat-${i + 1}.png`), write(highlight(p, 2), `cat-${i + 1}-hover.png`)]))
console.log(`cat: ${poses[0].W}x${poses[0].H} -> public/room/cat-{1,2,3}{,-hover}.png`)
