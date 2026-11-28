// Draws Gurtle, the turtle mascot of the Gurtle word game, in profile facing
// right: a domed moss-green shell with three scutes and a cream rim, a round
// head with one big eye, stubby legs and a little tail. Frames:
//
//   gurtle-idle     standing, eye open            gurtle-blink   eye shut
//   gurtle-happy    ^ eye, open smile, legs out   gurtle-worried brow, sweat drop
//   gurtle-hide     tucked into the shell         gurtle-walk-1/2 legs swapping
//
//   node scripts/draw-gurtle.mjs            -> public/gurtle/*.png at art size (CSS scales them)
//   node scripts/draw-gurtle.mjs --preview  -> also an 8x contact sheet in the OS temp folder
//
// Built from shapes on the art grid, like draw-cat.mjs: an ellipse dome cut
// flat at the base, Voronoi seams between scute centres, a circle head on a
// neck. Lit from the top left. Every part gets a dark ink edge, and parts in
// front draw a seam line on whatever sits behind them.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'gurtle')

const AW = 44
const AH = 30
const OY = 3 // headroom for the sweat drop and the happy hop pose

const C = {
  ink: [38, 30, 22],
  shell: [86, 128, 58],
  shellLight: [116, 160, 72],
  shellDark: [62, 98, 44],
  shine: [176, 212, 118],
  seam: [40, 66, 30],
  rim: [226, 208, 132],
  rimShade: [180, 158, 92],
  belly: [238, 218, 160],
  bellyShade: [206, 180, 120],
  skin: [164, 202, 104],
  skinLight: [200, 228, 140],
  skinShade: [122, 160, 76],
  skinFar: [100, 136, 64],
  eye: [26, 20, 16],
  white: [255, 255, 250],
  cheek: [236, 150, 138],
  mouth: [96, 40, 30],
  tongue: [222, 104, 104],
  sweat: [150, 204, 236],
  hole: [30, 24, 18],
}

// Paint order: later regions sit in front. Seams are inked on the region behind.
const R = { farLeg: 1, tail: 2, belly: 3, shell: 4, rim: 5, neck: 6, head: 7, leg: 8, drop: 9 }
const GROUP = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 4, 6: 6, 7: 6, 8: 8, 9: 9 }
const ORDER = { 1: 1, 2: 2, 3: 3, 4: 4, 6: 5, 8: 6, 9: 7 }

function frame({ eye = 'open', legs = 'stand', hidden = false, drop = false }) {
  const region = new Uint8Array(AW * AH)
  const colour = new Array(AW * AH).fill(null)
  const set = (x, y, r) => { if (x >= 0 && y >= 0 && x < AW && y < AH) region[y * AW + x] = r }
  const at = (x, y) => (x < 0 || y < 0 || x >= AW || y >= AH ? 0 : region[y * AW + x])
  const fillRect = (x0, y0, w, h, r) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y + OY, r) }

  // Tucked in, the shell settles onto the ground.
  const sy = hidden ? 4 : 0
  const dome = { cx: 19, cy: 19 + sy, rx: 12.2, ry: 12 }
  const head = { cx: 35.5, cy: 12.5, r: 5.6 }
  const hx = Math.floor(head.cx), hy = Math.floor(head.cy)
  const inDome = (px, py) => py < dome.cy && ((px - dome.cx) / dome.rx) ** 2 + ((py - dome.cy) / dome.ry) ** 2 <= 1
  const inHead = (px, py) => (px - head.cx) ** 2 + (py - head.cy) ** 2 <= head.r ** 2

  // Legs: [x, width, rows] per leg, near pair and far pair, by pose.
  const L = {
    stand: { near: [[8, 5, 5], [25, 5, 5]], far: [[14, 4, 4], [21, 4, 4]] },
    walk1: { near: [[7, 5, 5], [26, 5, 4]], far: [[15, 4, 4], [20, 4, 3]] },
    walk2: { near: [[9, 5, 4], [24, 5, 5]], far: [[13, 4, 3], [22, 4, 4]] },
    jump: { near: [[5, 5, 4], [28, 5, 4]], far: [[12, 4, 3], [23, 4, 3]] },
  }[legs]

  if (!hidden) {
    for (const [x, w, h] of L.far) fillRect(x, 19, w, h, R.farLeg)
    // Tail: a small wedge off the back of the shell.
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const px = x + 0.5, py = y + 0.5 - OY
      if (px > 4 && px < 9 && py > 18 && py < 21.2 && py - 18 > (9 - px) * 0.38) set(x, y, R.tail)
    }
  }
  // Belly (plastron): two rows under the dome, rounded at the ends.
  fillRect(9, 19 + sy, 20, 1, R.belly)
  fillRect(10, 20 + sy, 18, 1, R.belly)
  // Dome, with a two-row rim along the base.
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const px = x + 0.5, py = y + 0.5 - OY
    if (inDome(px, py)) set(x, y, py > dome.cy - 2 ? R.rim : R.shell)
  }
  if (!hidden) {
    // Neck from under the front of the shell up to the head.
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const px = x + 0.5, py = y + 0.5 - OY
      if (px > 28.5 && px < 34.5 && py > 13.5 && py < 20.5 && px - 28.5 > (py - 13.5) * 0.25 - 0.5) set(x, y, R.neck)
      if (inHead(px, py)) set(x, y, R.head)
    }
    for (const [x, w, h] of L.near) {
      fillRect(x, 19, w, h, R.leg)
      fillRect(x - 1, 19 + h - 1, w + 1, 1, R.leg) // a foot that sticks out at the back
    }
  }
  if (drop) {
    for (const [x, y] of [[41, 6], [40, 7], [41, 7], [40, 8], [41, 8]]) set(x, y + OY, R.drop)
  }

  // Scute centres on the dome (art px before OY).
  const scutes = [[19, 11 + sy], [11.2, 15.6 + sy], [26.8, 15.6 + sy]]
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const r = region[y * AW + x]
    if (!r) continue
    const px = x + 0.5, py = y + 0.5 - OY
    let c = C.skin
    if (r === R.shell) {
      const d = scutes.map(([sx, scy]) => Math.hypot(px - sx, (py - scy) * 1.15)).sort((a, b) => a - b)
      const nearest = scutes.reduce((best, s) => (Math.hypot(px - s[0], (py - s[1]) * 1.15) < Math.hypot(px - best[0], (py - best[1]) * 1.15) ? s : best))
      if (d[1] - d[0] < 1.05) c = C.seam
      else {
        const dx = px - nearest[0], dy = py - nearest[1]
        c = Math.hypot(dx + 0.6, dy + 0.6) < 2.6 ? C.shellLight : py > dome.cy - 4 ? C.shellDark : C.shell
      }
      // The shine: a short curved streak top left.
      const sx = (px - (dome.cx - 6.5)) / 2.2, syy = (py - (dome.cy - 8.6)) / 1.1
      if (sx * sx + syy * syy <= 1 && c !== C.seam) c = C.shine
    } else if (r === R.rim) {
      c = Math.floor(px) % 4 === 1 ? C.rimShade : py > dome.cy - 1 ? C.rimShade : C.rim
      if (Math.floor(px) % 4 === 1) c = C.seam
    } else if (r === R.belly) {
      c = py - sy > 20 ? C.bellyShade : C.belly
      if (Math.floor(px) % 5 === 3) c = C.bellyShade
    } else if (r === R.head) {
      const ny = (py - head.cy) / head.r, nx = (px - head.cx) / head.r
      c = ny + nx * 0.4 < -0.55 ? C.skinLight : ny > 0.5 ? C.skinShade : C.skin
    } else if (r === R.neck) {
      c = px < 31 ? C.skinShade : C.skin
    } else if (r === R.leg) {
      // Lit from the left: the right column and the sole are in shade.
      const right = at(x + 1, y) !== R.leg
      const sole = at(x, y + 1) !== R.leg
      c = sole ? C.skinShade : right ? C.skinShade : C.skin
      if (sole && x % 2 === 0) c = C.skin
    } else if (r === R.farLeg) {
      c = C.skinFar
    } else if (r === R.tail) {
      c = py > 20 ? C.skinShade : C.skin
    } else if (r === R.drop) {
      c = C.sweat
    }
    colour[y * AW + x] = c
  }

  const put = (x, y, c) => { if (region[(y + OY) * AW + x]) colour[(y + OY) * AW + x] = c }
  if (!hidden) {
    // Face, placed from the head centre (hx, hy). The eye is 2x3 with a glint;
    // the mouth sits at the front of the snout.
    const mouth = () => { put(hx + 1, hy + 2, C.mouth); put(hx + 2, hy + 2, C.mouth); put(hx + 3, hy + 1, C.mouth) }
    const eyePx = [[hx + 1, hy - 3], [hx + 2, hy - 3], [hx + 1, hy - 2], [hx + 2, hy - 2], [hx + 1, hy - 1], [hx + 2, hy - 1]]
    if (eye === 'open') {
      for (const [x, y] of eyePx) put(x, y, C.eye)
      put(hx + 1, hy - 3, C.white)
      mouth()
    } else if (eye === 'worried') {
      // Looking down, a brow lifted at the inner end, a wobbly mouth.
      for (const [x, y] of eyePx) put(x, y, C.eye)
      put(hx + 2, hy - 1, C.white)
      put(hx, hy - 5, C.eye); put(hx + 1, hy - 4, C.eye); put(hx + 2, hy - 4, C.eye)
      put(hx + 1, hy + 3, C.mouth); put(hx + 2, hy + 2, C.mouth); put(hx + 3, hy + 2, C.mouth)
    } else if (eye === 'blink') {
      for (const x of [hx, hx + 1, hx + 2]) put(x, hy - 1, C.eye)
      mouth()
    } else if (eye === 'happy') {
      for (const [x, y] of [[hx, hy - 1], [hx + 1, hy - 2], [hx + 2, hy - 2], [hx + 3, hy - 1]]) put(x, y, C.eye)
      for (const x of [hx + 1, hx + 2, hx + 3, hx + 4]) put(x, hy + 1, C.mouth)
      put(hx + 1, hy + 2, C.mouth); put(hx + 2, hy + 2, C.tongue); put(hx + 3, hy + 2, C.tongue); put(hx + 4, hy, C.mouth)
    }
    put(hx - 1, hy + 1, C.cheek); put(hx, hy + 1, C.cheek)
    put(hx + 5, hy - 1, C.skinShade) // nostril
  } else {
    // Peeking out of the shell: a dark opening at the front with two glints.
    for (const [x, y] of [[27, 15], [28, 15], [29, 15], [26, 16], [27, 16], [28, 16], [29, 16], [30, 16], [26, 17], [27, 17], [28, 17], [29, 17], [30, 17]]) put(x, y + sy, C.hole)
    put(27, 16 + sy, C.white); put(29, 16 + sy, C.white)
  }

  // Ink: the outside edge (8-neighbour), and seams on the part behind (4-neighbour).
  const ink = new Uint8Array(AW * AH)
  for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
    const r = region[y * AW + x]
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nr = at(x + dx, y + dy)
      if (!r && nr) ink[y * AW + x] = 1
      if (r && nr && (dx === 0 || dy === 0) && GROUP[nr] !== GROUP[r] && ORDER[GROUP[nr]] > ORDER[GROUP[r]]) ink[y * AW + x] = 1
    }
  }

  const data = Buffer.alloc(AW * AH * 4)
  for (let i = 0; i < AW * AH; i++) {
    const c = ink[i] ? C.ink : colour[i]
    if (!c) continue
    data[i * 4] = c[0]; data[i * 4 + 1] = c[1]; data[i * 4 + 2] = c[2]; data[i * 4 + 3] = 255
  }
  return data
}

const FRAMES = {
  'gurtle-idle': { eye: 'open' },
  'gurtle-blink': { eye: 'blink' },
  'gurtle-happy': { eye: 'happy', legs: 'jump' },
  'gurtle-worried': { eye: 'worried', drop: true },
  'gurtle-hide': { hidden: true },
  'gurtle-walk-1': { eye: 'open', legs: 'walk1' },
  'gurtle-walk-2': { eye: 'open', legs: 'walk2' },
}

mkdirSync(outDir, { recursive: true })
const rendered = []
for (const [name, opts] of Object.entries(FRAMES)) {
  const data = frame(opts)
  rendered.push(data)
  await sharp(data, { raw: { width: AW, height: AH, channels: 4 } }).png({ compressionLevel: 9 }).toFile(join(outDir, `${name}.png`))
  console.log(`public/gurtle/${name}.png ${AW}x${AH}`)
}

if (process.argv.includes('--preview')) {
  const S = 8
  const n = rendered.length
  const W = (AW * S + 8) * n, H = AH * S
  const sheet = Buffer.alloc(W * H * 4)
  for (let i = 0; i < W * H; i++) { sheet[i * 4] = 250; sheet[i * 4 + 1] = 248; sheet[i * 4 + 2] = 245; sheet[i * 4 + 3] = 255 }
  rendered.forEach((data, f) => {
    for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
      const s = (y * AW + x) * 4
      if (!data[s + 3]) continue
      for (let yy = 0; yy < S; yy++) for (let xx = 0; xx < S; xx++) {
        const d = ((y * S + yy) * W + f * (AW * S + 8) + x * S + xx) * 4
        sheet[d] = data[s]; sheet[d + 1] = data[s + 1]; sheet[d + 2] = data[s + 2]
      }
    }
  })
  const file = join(tmpdir(), 'gurtle-preview.png')
  await sharp(sheet, { raw: { width: W, height: H, channels: 4 } }).png().toFile(file)
  console.log(`preview: ${file}`)
}
