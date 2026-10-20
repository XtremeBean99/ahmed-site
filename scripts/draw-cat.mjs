// Draws the cat on the bed: a ginger cat curled up asleep (two breathing
// frames) and the same cat with its head up, awake. Each pose also gets a
// hover frame with the room's #f6da9c highlight grown 2 px around it.
// Also the cat on its feet, in profile, for when it is fed (RoomCat): a 4-frame walk
// (cat-walk-1..4), a crouch and a leap for getting off and onto the bed, and two eating
// frames with its head down in the bowl (cat-eat-1..2),
// and the bowl itself, empty, full and half eaten, each with a hover frame.
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

/**
 * The cat on its feet, in profile facing left (RoomCat flips it to go right).
 *   walk  4 frames (`phase` 0..3): diagonal legs swing together, the leg coming forward
 *         lifts its paw, the body bobs a pixel on the push-off, the tail sways
 *   crouch      gathered to jump, or landing
 *   leap        stretched out mid-jump, front paws reaching, hind legs trailing
 *   eat   2 frames: crouched over the bowl, head down, the head dipping as it chews
 */
function profile({ pose = 'walk', phase = 0 }) {
  const GROUND = 29
  const P = {
    walk: { body: [26, 17, 12.5, 5.8], chest: [15.5, 16, 4.6, 5.2], head: [10, 10.5, 5.2], tilt: 0 },
    crouch: { body: [27, 21.5, 12.5, 5.4], chest: [16, 21, 4.6, 4.6], head: [10, 15.5, 5.2], tilt: 0 },
    leap: { body: [25, 15, 14.5, 5.2], chest: [13.5, 16, 4.4, 4.6], head: [8, 11.5, 5.2], tilt: 0.12 },
    eat: { body: [27, 21, 12.5, 5.6], chest: [16.5, 21.5, 4.6, 4.8], head: [9.5, 23 + (phase % 2) * 0.8, 5], tilt: 0 },
  }[pose]
  const bob = pose === 'walk' && phase % 2 === 1 ? -0.6 : 0
  const [bcx, bcy0, brx, bry] = P.body
  const bcy = bcy0 + bob
  const [ccx, ccy, crx, cry] = P.chest
  const [hcx, hcy0, hr] = P.head
  const hcy = hcy0 + bob
  const eyesShut = pose === 'eat'
  // Muzzle points left (down into the bowl when eating).
  const muzzle = pose === 'eat' ? [hcx - 3.6, hcy + 2.8, 2.6, 2] : [hcx - 4.2, hcy + 1.6, 2.6, 2]

  // Legs: hip (x, y) to paw (x, y), half-width at the hip and at the paw.
  const swing = (k) => Math.sin(((phase + k) / 4) * Math.PI * 2)
  const lift = (k) => (Math.cos(((phase + k) / 4) * Math.PI * 2) > 0.3 ? 1.6 : 0)
  let legs
  if (pose === 'walk') {
    const leg = (hx, k, near, hind) => ({ hip: [hx, bcy + 2], paw: [hx + swing(k) * 3.2, GROUND - lift(k)], w0: hind ? 2.3 : 1.6, w1: 1.3, near })
    legs = [leg(17.5, 2, false, false), leg(35, 0, false, true), leg(16, 0, true, false), leg(33.5, 2, true, true)]
  } else if (pose === 'crouch') {
    legs = [
      { hip: [18, bcy + 1], paw: [15, GROUND], w0: 1.6, w1: 1.4, near: false },
      { hip: [35, bcy + 1], paw: [33, GROUND], w0: 2.6, w1: 1.4, near: false },
      { hip: [16.5, bcy + 1], paw: [13, GROUND], w0: 1.6, w1: 1.4, near: true },
      { hip: [33.5, bcy + 1], paw: [31, GROUND], w0: 2.8, w1: 1.4, near: true },
    ]
  } else if (pose === 'leap') {
    legs = [
      { hip: [15, bcy + 2], paw: [5, 22], w0: 1.5, w1: 1.3, near: false },
      { hip: [36, bcy + 1], paw: [45, 21], w0: 2.2, w1: 1.2, near: false },
      { hip: [14, bcy + 2], paw: [3.5, 20], w0: 1.5, w1: 1.3, near: true },
      { hip: [35, bcy + 1], paw: [46, 18.5], w0: 2.4, w1: 1.2, near: true },
    ]
  } else {
    legs = [
      { hip: [17, bcy + 1], paw: [16.5, GROUND], w0: 1.5, w1: 1.3, near: false },
      { hip: [35, bcy + 1], paw: [32, GROUND], w0: 2.6, w1: 1.4, near: false },
      { hip: [15.5, bcy + 1], paw: [14.5, GROUND], w0: 1.5, w1: 1.3, near: true },
      { hip: [33.5, bcy + 1], paw: [30.5, GROUND], w0: 2.8, w1: 1.4, near: true },
    ]
  }
  const segDist = (px, py, [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return [Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t]
  }
  const inLeg = (px, py, l) => { const [d, t] = segDist(px, py, l.hip, l.paw); return d < l.w0 + (l.w1 - l.w0) * t }
  const isPaw = (px, py, l) => Math.hypot(px - l.paw[0], py - l.paw[1]) < 1.9

  // Tail: from the rump, up in an S when walking, low behind when crouched, curled when eating.
  const sway = pose === 'walk' ? Math.sin((phase / 4) * Math.PI * 2) : 0
  const tailPts = (t) => {
    if (pose === 'walk') return [37.5 + 6 * t + sway * 1.5 * t * t, bcy - 2 - 10 * t + 3 * t * t]
    if (pose === 'leap') return [38 + 9 * t, bcy - 1 - 3 * t]
    if (pose === 'crouch') return [38 + 7 * t, bcy + 1 - 2 * t + 4 * t * t]
    return [38 + 5 * t - 4 * t * t, bcy + 2 + 6 * t]
  }
  const inTail = (px, py) => {
    for (let i = 0; i <= 30; i++) {
      const [tx, ty] = tailPts(i / 30)
      if ((px - tx) ** 2 + (py - ty) ** 2 < (1.7 - 0.45 * (i / 30)) ** 2) return true
    }
    return false
  }
  const ell = (px, py, cx, cy, rx, ry) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1
  const inBody = (px, py) => {
    // tilt: the leap pitches the body nose-down a little
    const ty = py + (px - bcx) * P.tilt
    return ell(px, ty, bcx, bcy, brx, bry) || ell(px, py, ccx, ccy + bob, crx, cry)
  }
  const inHead = (px, py) => ell(px, py, hcx, hcy, hr, hr * 0.92) || ell(px, py, ...muzzle)
  const ears = [
    { tri: [[hcx - 1.5, hcy - 3.5], [hcx - 0.5, hcy - 8.6], [hcx + 2.5, hcy - 4.2]], near: true },
    { tri: [[hcx + 1.8, hcy - 4.2], [hcx + 4.2, hcy - 8.2], [hcx + 5, hcy - 2.6]], near: false },
  ]
  const inTri = (x, y, [a, b, c]) => {
    const sg = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
    const d1 = sg([x, y], a, b), d2 = sg([x, y], b, c), d3 = sg([x, y], c, a)
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
  }

  // Regions: 1 body, 2 tail, 3 head, 4 near ear, 5 near leg, 6 far leg, 7 far ear
  const region = new Uint8Array(AW * AH)
  const colour = new Array(AW * AH).fill(null)
  const set = (x, y, r) => { if (x >= 0 && y >= 0 && x < AW && y < AH) region[y * AW + x] = r }
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const px = x + 0.5, py = y + 0.5
    if (ears.some((e) => !e.near && inTri(px, py, e.tri))) set(x, y, 7)
    if (legs.some((l) => !l.near && inLeg(px, py, l))) set(x, y, 6)
    if (inTail(px, py)) set(x, y, 2)
    if (inBody(px, py)) set(x, y, 1)
    if (legs.some((l) => l.near && inLeg(px, py, l))) set(x, y, 5)
    if (ears.some((e) => e.near && inTri(px, py, e.tri))) set(x, y, 4)
    if (inHead(px, py)) set(x, y, 3)
  }
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const r = region[y * AW + x]
    if (!r) continue
    const px = x + 0.5, py = y + 0.5
    let c = C.base
    if (r === 1) {
      const ny = (py + (px - bcx) * P.tilt - bcy) / bry
      c = ny < -0.5 ? C.light : ny > 0.45 ? C.shadow : C.base
      // stripes down the flank, the belly and chest cream
      for (const sx of [22, 27, 32, 37]) if (Math.abs(px - (sx - 0.35 * (py - bcy))) < 0.7 && ny < 0.35) c = C.stripe
      if (ny > 0.55 && px < bcx) c = C.creamShade
      if (ell(px, py, ccx - 1, ccy + bob + 1.8, crx * 0.75, cry * 0.7)) c = C.cream
    } else if (r === 2) {
      c = Math.floor(px + py) % 4 < 2 ? C.stripe : C.base
    } else if (r === 5 || r === 6) {
      const l = legs.find((g) => (r === 5) === g.near && inLeg(px, py, g)) ?? legs[0]
      c = isPaw(px, py, l) ? (r === 6 ? C.creamShade : C.cream) : r === 6 ? C.shadow : C.base
    } else if (r === 3) {
      const ny = (py - hcy) / hr
      c = ny < -0.4 ? C.light : C.base
      if (ell(px, py, ...muzzle) || (ny > 0.25 && px < hcx + 1)) c = C.cream
      if (ny > 0.7) c = C.creamShade
      // stripes over the crown and a cheek stripe
      if (ny < -0.3 && [hcx + 0.5, hcx + 2.5].some((sx) => Math.abs(px - sx) < 0.45)) c = C.stripe
      if (Math.abs(py - (hcy + 0.8)) < 0.45 && px > hcx + 1.5 && px < hcx + 4.5) c = C.stripe
    } else if (r === 4) {
      c = C.base
    } else if (r === 7) {
      c = C.shadow
    }
    colour[y * AW + x] = c
  }
  // inner near ear, eye, nose, mouth
  const put = (x, y, c, only = 3) => { if (region[y * AW + x] === only) colour[y * AW + x] = c }
  const ex = Math.round(hcx - 2), ey = Math.round(hcy - 1)
  put(Math.round(hcx), Math.round(hcy - 5), C.pink, 4)
  if (eyesShut) {
    put(ex - 1, ey + 1, C.ink); put(ex, ey + 1, C.ink); put(ex + 1, ey, C.ink)
  } else {
    put(ex, ey, C.eye); put(ex, ey + 1, C.ink); put(ex - 1, ey, C.ink); put(ex - 1, ey + 1, C.eye)
  }
  const nx = Math.round(muzzle[0] - muzzle[2] + 0.6), ny = Math.round(muzzle[1] - 0.6)
  put(nx, ny, C.pink)
  put(nx + 1, ny + 2, C.ink)

  // Ink: outside edge, plus seams where the head and tail cross the body
  // and where anything sits on the far legs and far ear.
  const ink = new Uint8Array(AW * AH)
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const r = region[y * AW + x]
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const qx = x + dx, qy = y + dy
      const nr = qx < 0 || qy < 0 || qx >= AW || qy >= AH ? 0 : region[qy * AW + qx]
      if (!r && nr) ink[y * AW + x] = 1
      if (dx !== 0 && dy !== 0) continue
      if ((r === 6 || r === 7) && nr && nr !== r) ink[y * AW + x] = 1
      if (r === 1 && nr === 3) ink[y * AW + x] = 1
      // a near leg's lower half keeps its edge where it passes in front of the body
      if (r === 1 && nr === 5 && y > bcy + bry * 0.4) ink[y * AW + x] = 1
      if (r === 2 && nr === 1) ink[y * AW + x] = 1
    }
  }
  return toRgba(colour, ink)
}

// A ceramic bowl, front-on and seen a little from above: a teal glaze with a lighter
// band and a fish, the rim an ellipse, kibble heaped inside (`food` 0 empty, 1 half, 2 full).
const BW = 24 // art px (x2 = 48 stage px)
const BH = 13
function bowl(food) {
  const colour = new Array(BW * BH).fill(null)
  const glaze = [86, 142, 160], glazeDark = [58, 100, 120], glazeLight = [150, 200, 210], inside = [40, 58, 68], insideLit = [62, 86, 98]
  const kibble = [[160, 98, 56], [120, 72, 42], [196, 136, 82]]
  const rim = { cx: 11, cy: 3.6, rx: 10.4, ry: 3.4 }
  const ell = (px, py, rx, ry, cy = rim.cy) => ((px - rim.cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    const px = x + 0.5, py = y + 0.5
    // The body is the lower half of a wide ellipse under the rim, standing on a foot.
    const inBody = py >= rim.cy && ell(px, py, rim.rx, 7.6)
    const inFoot = py >= BH - 1.6 && Math.abs(px - rim.cx) < 5.5
    if (inBody || inFoot) {
      const side = (px - rim.cx) / rim.rx
      colour[y * BW + x] = side > 0.62 || inFoot ? glazeDark : py > 6.2 && py < 7.8 ? glazeLight : glaze
    }
    if (ell(px, py, rim.rx, rim.ry)) colour[y * BW + x] = glazeLight
    if (ell(px, py, rim.rx - 1.3, rim.ry - 1)) colour[y * BW + x] = py < rim.cy ? inside : insideLit
  }
  // A little fish on the band.
  for (const [x, y] of [[7, 7], [8, 7], [9, 7], [10, 6], [10, 8], [6, 6], [6, 8], [8, 6], [8, 8]]) colour[y * BW + x] = glazeDark
  // Kibble heaped in the bowl: a mound over the rim when full, a layer at the bottom when half eaten.
  if (food) {
    const top = food === 2 ? 0.6 : 4.4
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
      const px = x + 0.5, py = y + 0.5
      const inside = ell(px, py, rim.rx - 1.3, rim.ry - 1)
      const mound = food === 2 && py < rim.cy && ((px - rim.cx) / 7.5) ** 2 + ((py - rim.cy) / (rim.cy - top)) ** 2 <= 1
      if ((inside && py >= top) || mound) colour[y * BW + x] = kibble[(x * 3 + y * 5 + ((x * y) % 3)) % 3]
    }
  }
  const ink = new Uint8Array(BW * BH)
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) {
    if (colour[y * BW + x]) continue
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy
      if (nx >= 0 && ny >= 0 && nx < BW && ny < BH && colour[ny * BW + nx]) ink[y * BW + x] = 1
    }
  }
  return toRgba(colour, ink, BW, BH)
}

/** Art px to stage px (PX each), with PAD stage px of room for the highlight. */
function toRgba(colour, ink, aw = AW, ah = AH) {
  const W = aw * PX + PAD * 2, H = ah * PX + PAD * 2
  const out = Buffer.alloc(W * H * 4)
  for (let y = 0; y < ah; y++) for (let x = 0; x < aw; x++) {
    const c = ink[y * aw + x] ? C.ink : colour[y * aw + x]
    if (!c) continue
    for (let sy = 0; sy < PX; sy++) for (let sx = 0; sx < PX; sx++) {
      const i = ((PAD + y * PX + sy) * W + PAD + x * PX + sx) * 4
      out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 255
    }
  }
  return { W, H, data: out }
}

const write = ({ W, H, data }, name) =>
  sharp(data, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toFile(join(outDir, name))

const poses = [pose({ breath: 0 }), pose({ breath: 1 }), pose({ awake: true })]
await Promise.all(poses.flatMap((p, i) => [write(p, `cat-${i + 1}.png`), write(highlight(p, 2), `cat-${i + 1}-hover.png`)]))
const feeding = {
  ...Object.fromEntries([0, 1, 2, 3].map((phase) => [`cat-walk-${phase + 1}`, profile({ pose: 'walk', phase })])),
  'cat-crouch': profile({ pose: 'crouch' }),
  'cat-leap': profile({ pose: 'leap' }),
  'cat-eat-1': profile({ pose: 'eat', phase: 0 }),
  'cat-eat-2': profile({ pose: 'eat', phase: 1 }),
}
const bowls = { 'cat-bowl-empty': bowl(0), 'cat-bowl-half': bowl(1), 'cat-bowl-full': bowl(2) }
await Promise.all([
  ...Object.entries(feeding).map(([name, p]) => write(p, `${name}.png`)),
  ...Object.entries(bowls).flatMap(([name, p]) => [write(p, `${name}.png`), write(highlight(p, 2), `${name}-hover.png`)]),
])
console.log(`cat: ${poses[0].W}x${poses[0].H} -> public/room/cat-{1,2,3}{,-hover}.png, cat-walk-*, cat-eat-*; bowl ${bowls['cat-bowl-full'].W}x${bowls['cat-bowl-full'].H}`)
