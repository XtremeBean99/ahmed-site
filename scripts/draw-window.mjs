// Draws the city seen through the room's upper-right window, as pixel art, for every
// lighting state (dawn, day, dusk, night) and weather (clear, rain, snow).
//
//   node scripts/draw-window.mjs
//
// Everything is cut to the two panes of glass in the background art (found by flood fill
// between the frame's black lines), so the hand-drawn frame stays and the view replaces
// whatever was painted on the glass. Output in public/room/window/ (RoomWindow.tsx):
//   <light>-<weather>.png   the still view: sky, sun or moon, clouds, three layers of
//                           buildings with their windows, snow on the roofs
//   twinkle-1..2.png        night only: stars, an antenna's red light, a few windows
//   rain-1..4.png, snow-1..6.png         falling drops and flakes, looped
//   rain-heavy-*.png, snow-heavy-*.png   extra drops and flakes laid over those
// None of it is lighting-graded: each state is drawn in its own palette.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room', 'window')
const bgPath = join(__dirname, '..', 'assets', 'pixel-art', 'background', 'background.png')

// The view's box on the stage; RoomWindow.tsx positions the images here.
export const VIEW = { x: 1211, y: 79, w: 197, h: 324 }
const { w: W, h: H } = VIEW
// Seeds inside the upper and lower panes, in stage coordinates.
const PANE_SEEDS = [[1260, 90], [1300, 250]]

const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))

// Deterministic noise so every run draws the same city.
function rand(seed) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const dither = (x, y) => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16

// ---------------------------------------------------------------- the glass

async function glassMask() {
  const { data, info } = await sharp(bgPath).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const ink = (x, y) => {
    const i = (y * info.width + x) * 3
    return Math.max(data[i], data[i + 1], data[i + 2]) <= 40
  }
  const mask = new Uint8Array(W * H)
  for (const [sx, sy] of PANE_SEEDS) {
    const stack = [[sx, sy]]
    const seen = new Set([sy * info.width + sx])
    while (stack.length) {
      const [x, y] = stack.pop()
      const vx = x - VIEW.x, vy = y - VIEW.y
      if (vx >= 0 && vy >= 0 && vx < W && vy < H) mask[vy * W + vx] = 1
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        const k = ny * info.width + nx
        if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height || seen.has(k) || ink(nx, ny)) continue
        seen.add(k)
        stack.push([nx, ny])
      }
    }
  }
  return mask
}

// ---------------------------------------------------------------- palettes

// Sky bands top to horizon; three building layers (far, mid, near); window colours.
const PALETTES = {
  dawn: {
    sky: ['#5f5b9c', '#8a72a8', '#c58fb0', '#eea48c', '#ffcf9e'],
    sun: { at: [40, 142], r: 10, core: '#fff1c4', rim: '#ffc27a' },
    cloud: ['#f6c3b4', '#d99aa6', '#a87c9e'],
    far: '#a68aaa', mid: '#7f6a92', near: '#5a4b6e', edgeLight: '#d9a3a6', edgeDark: '#463a59',
    lit: ['#ffd98a', '#ffe9b0'], dark: '#4e4064', litShare: 0.18,
  },
  day: {
    sky: ['#4f93d6', '#64a6e0', '#80b9e8', '#a3cdef', '#c9e3f5'],
    sun: { at: [40, 26], r: 8, core: '#fffbe0', rim: '#ffe48a' },
    cloud: ['#ffffff', '#e4eff8', '#bcd2e6'],
    far: '#a9bccd', mid: '#8499ae', near: '#5f7189', edgeLight: '#c7d6e3', edgeDark: '#4c5c72',
    lit: ['#cfe4f2', '#9fc3dd'], dark: '#5a7593', litShare: 0.5,
  },
  dusk: {
    sky: ['#3f3570', '#6a4a84', '#a65a7c', '#e07a5f', '#f6b26b'],
    sun: { at: [96, 150], r: 12, core: '#ffd27a', rim: '#ff8a4c' },
    cloud: ['#f0a07a', '#c06a74', '#7e4a6e'],
    far: '#8a6a8c', mid: '#634a72', near: '#43345a', edgeLight: '#e08a70', edgeDark: '#33284a',
    lit: ['#ffcf7a', '#ffe3a0'], dark: '#3a2d50', litShare: 0.45,
  },
  night: {
    sky: ['#0f1230', '#151a3e', '#1c2250', '#26295c', '#35336a'],
    moon: { at: [92, 24], r: 8, core: '#f6f1d2', shade: '#cfc8a4' },
    cloud: ['#3a3a6a', '#2a2b55', '#20214a'],
    far: '#2a2e58', mid: '#1d2145', near: '#13162f', edgeLight: '#3a3f72', edgeDark: '#0d0f22',
    lit: ['#ffd27a', '#ffe7a8', '#8fb3ff'], dark: '#181b38', litShare: 0.55,
  },
}

// Overcast versions of the sky for rain and snow, still tinted by the time of day.
const OVERCAST = { rain: ['#6f7486', '#888b9a'], snow: ['#b9bccb', '#d6d8e2'] }
const WEATHER_TINT = { rain: 0.72, snow: 0.6 }

// ---------------------------------------------------------------- the city

// Rooflines: x span, top (in view px), plus which layer. Generated once, the same for
// every state, so the city does not change when the light does.
function buildCity() {
  const r = rand(7)
  const layers = { far: [], mid: [], near: [] }
  // Far: a dense hazy band of towers.
  for (let x = -4; x < W; ) {
    const w = 8 + Math.floor(r() * 12)
    layers.far.push({ x, w, top: 128 + Math.floor(r() * 34) - (r() < 0.15 ? 22 : 0), spire: r() < 0.12 })
    x += w - 1
  }
  // Mid: fewer, wider, taller blocks with window grids.
  for (let x = -6; x < W; ) {
    const w = 18 + Math.floor(r() * 18)
    layers.mid.push({
      x, w,
      top: 150 + Math.floor(r() * 70),
      stepped: r() < 0.4,
      style: r() < 0.35 ? 'bands' : 'grid',
      roofBox: r() < 0.6,
      aerial: r() < 0.4,
    })
    x += w + Math.floor(r() * 8) - 3
  }
  // Near: a tall block on the right reaching into the upper pane (like the original art)
  // with a water tower, and a low one on the left.
  layers.near.push({ x: 150, w: 60, top: 60, tower: true })
  layers.near.push({ x: -4, w: 30, top: 214 })
  return layers
}

// ---------------------------------------------------------------- drawing

function makeCanvas() { return { px: new Array(W * H).fill(null) } }
function set(c, x, y, col) { if (x >= 0 && y >= 0 && x < W && y < H) c.px[y * W + x] = col }
function get(c, x, y) { return x >= 0 && y >= 0 && x < W && y < H ? c.px[y * W + x] : null }
function rect(c, x0, y0, w, h, col) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(c, x, y, col) }
function disc(c, cx, cy, r, colFn) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
    if (d <= r) set(c, x, y, colFn(d / r, x, y))
  }
}

function drawSky(c, bands) {
  // Banded gradient with a 4x4 ordered dither between neighbouring bands.
  const horizon = 190
  for (let y = 0; y < H; y++) {
    const t = Math.min(1, Math.max(0, y / horizon)) * (bands.length - 1)
    const i = Math.min(bands.length - 2, Math.floor(t))
    const f = t - i
    // Solid bands, dithered only across the middle of each change.
    const g = Math.min(1, Math.max(0, (f - 0.3) / 0.4))
    for (let x = 0; x < W; x++) set(c, x, y, hex(g > dither(x, y) ? bands[i + 1] : bands[i]))
  }
}

function drawCloud(c, cx, cy, w, cols) {
  // A flat-bottomed puff: three overlapping ellipses, lit top, shaded base.
  const blobs = [[0, 0, w, 4], [-w * 0.45, 0.5, w * 0.45, 3.5], [w * 0.15, -2.5, w * 0.45, 4.5], [w * 0.55, 0.5, w * 0.35, 3]]
  for (let y = Math.floor(cy - 8); y <= cy + 5; y++) for (let x = Math.floor(cx - w * 1.2); x <= cx + w * 1.2; x++) {
    if (y > cy + 3) continue
    const inside = blobs.some(([bx, by, rx, ry]) => ((x + 0.5 - cx - bx) / rx) ** 2 + ((y + 0.5 - cy - by) / ry) ** 2 <= 1)
    if (!inside) continue
    const v = (y - (cy - 6)) / 9
    set(c, x, y, hex(v < 0.35 ? cols[0] : v < 0.75 ? cols[1] : cols[2]))
  }
}

const CLOUDS = [[46, 14, 16], [138, 34, 20], [84, 58, 12], [30, 122, 11], [118, 112, 14]]

function drawBuildings(c, city, pal, light, weather) {
  const r = rand(11)
  const roofSnow = weather === 'snow'
  const col = (name) => hex(pal[name])
  // Far towers: flat silhouettes, the top of the sun-side edge catching the light.
  for (const b of city.far) {
    rect(c, b.x, b.top, b.w, H - b.top, col('far'))
    if (b.spire) rect(c, b.x + Math.floor(b.w / 2), b.top - 6, 1, 6, col('far'))
    const sunLeft = light === 'dawn'
    rect(c, sunLeft ? b.x : b.x + b.w - 1, b.top, 1, 10, mix(col('far'), col('edgeLight'), 0.5))
    if (roofSnow) rect(c, b.x, b.top, b.w, 1, hex('#eef0f6'))
    // A few far windows as single lit pixels at night and dusk.
    if ((light === 'night' || light === 'dusk') && r() < 0.45) {
      for (let y = b.top + 3; y < H; y += 4) for (let x = b.x + 2; x < b.x + b.w - 2; x += 3) {
        if (r() < 0.3) set(c, x, y, mix(col('far'), hex(pal.lit[0]), 0.55))
      }
    }
  }
  // Mid blocks: shaded side, window grid, optional setback.
  for (const b of city.mid) {
    const top = b.top
    rect(c, b.x, top, b.w, H - top, col('mid'))
    if (b.stepped) rect(c, b.x + 4, top - 8, b.w - 8, 8, col('mid'))
    rect(c, b.x + b.w - 3, top, 3, H - top, mix(col('mid'), col('edgeDark'), 0.6))
    // Window styles: a grid of small windows, or long horizontal bands (office floors).
    if (b.style === 'bands') {
      for (let y = top + 4; y < H - 2; y += 6) {
        const lit = r() < pal.litShare
        rect(c, b.x + 2, y, b.w - 6, 2, lit ? hex(pal.lit[0]) : col('dark'))
        if (lit) for (let x = b.x + 4; x < b.x + b.w - 5; x += 5) set(c, x, y, col('dark')) // mullions
      }
    } else {
      for (let y = top + 4; y < H - 2; y += 5) for (let x = b.x + 3; x < b.x + b.w - 5; x += 4) {
        const lit = r() < pal.litShare
        const c2 = lit ? hex(pal.lit[Math.floor(r() * pal.lit.length)]) : col('dark')
        rect(c, x, y, 2, 3, c2)
      }
    }
    // rooftop plant: a box or two and the odd aerial
    if (b.roofBox) rect(c, b.x + 3, top - (b.stepped ? 11 : 3), 5, 3, mix(col('mid'), col('edgeDark'), 0.4))
    if (b.aerial) rect(c, b.x + b.w - 6, top - (b.stepped ? 16 : 8), 1, b.stepped ? 8 : 8, col('edgeDark'))
    if (roofSnow) {
      rect(c, b.x, top, b.w, 2, hex('#f4f6fb'))
      if (b.stepped) rect(c, b.x + 4, top - 8, b.w - 8, 2, hex('#f4f6fb'))
    }
  }
  // Near buildings: darker, bigger windows with sills, a rooftop water tower.
  for (const b of city.near) {
    rect(c, b.x, b.top, b.w, H - b.top, col('near'))
    rect(c, b.x, b.top, 2, H - b.top, mix(col('near'), col('edgeLight'), 0.35))
    for (let y = b.top + 8; y < H - 4; y += 12) for (let x = b.x + 6; x < b.x + b.w - 8; x += 10) {
      const lit = r() < pal.litShare
      const c2 = lit ? hex(pal.lit[Math.floor(r() * pal.lit.length)]) : col('dark')
      rect(c, x, y, 5, 7, c2)
      if (lit) rect(c, x, y + 5, 5, 2, mix(c2, col('near'), 0.35)) // a blind half down
      rect(c, x - 1, y + 7, 7, 1, col('edgeDark')) // sill
    }
    if (b.tower) {
      // water tower on legs, and an antenna
      const tx = b.x + 12
      rect(c, tx, b.top - 16, 12, 10, col('edgeDark'))
      rect(c, tx - 1, b.top - 18, 14, 3, col('edgeDark'))
      rect(c, tx + 5, b.top - 21, 2, 3, col('edgeDark'))
      for (const lx of [tx + 1, tx + 10]) rect(c, lx, b.top - 6, 1, 6, col('edgeDark'))
      rect(c, b.x + 44, b.top - 26, 1, 26, col('edgeDark'))
      rect(c, b.x + 43, b.top - 14, 3, 1, col('edgeDark'))
      if (roofSnow) {
        rect(c, tx - 1, b.top - 19, 14, 1, hex('#f4f6fb'))
        rect(c, b.x, b.top, b.w, 2, hex('#f4f6fb'))
      }
    }
    if (roofSnow && !b.tower) rect(c, b.x, b.top, b.w, 2, hex('#f4f6fb'))
  }
}

function drawGlassStreaks(c) {
  // Two faint diagonal reflections so it reads as glass, blended into whatever is behind.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = x + y * 0.7
    const band = (d > 70 && d < 74) || (d > 80 && d < 82)
    const p = get(c, x, y)
    if (band && p) set(c, x, y, mix(p, [255, 255, 255], 0.14))
  }
}

function drawView(city, light, weather) {
  const pal = PALETTES[light]
  const c = makeCanvas()
  let bands = pal.sky
  if (weather !== 'clear') {
    const [a, b] = OVERCAST[weather]
    bands = pal.sky.map((s, i) => '#' + mix(hex(s), mix(hex(a), hex(b), i / (pal.sky.length - 1)), WEATHER_TINT[weather]).map((v) => v.toString(16).padStart(2, '0')).join(''))
  }
  drawSky(c, bands)
  if (weather === 'clear') {
    if (pal.sun) {
      const { at: [sx, sy], r, core, rim } = pal.sun
      disc(c, sx, sy, r, (d) => hex(d < 0.62 ? core : rim))
    }
    if (pal.moon) {
      const { at: [mx, my], r, core, shade } = pal.moon
      // a crescent: the disc minus a disc offset up-left, with two craters
      disc(c, mx, my, r, (d, x, y) => {
        if (Math.hypot(x + 0.5 - (mx - 4), y + 0.5 - (my - 2)) < r * 0.85) return null
        return hex(d > 0.8 ? shade : core)
      })
    }
    const cloudCols = pal.cloud
    for (const [x, y, w] of CLOUDS) drawCloud(c, x, y, w, cloudCols)
  } else {
    // a lid of low cloud
    const cols = weather === 'rain' ? ['#8d91a2', '#7a7e90', '#666a7c'] : ['#e2e4ec', '#cfd2dc', '#b8bcc9']
    const tinted = cols.map((s) => '#' + mix(hex(s), hex(pal.sky[1]), 0.3).map((v) => v.toString(16).padStart(2, '0')).join(''))
    for (let i = 0; i < 9; i++) drawCloud(c, (i * 53) % (W + 30) - 10, 8 + ((i * 29) % 70), 14 + (i % 3) * 5, tinted)
  }
  drawBuildings(c, city, pal, light, weather)
  drawGlassStreaks(c)
  return c
}

// Night extras on their own layer, two frames: stars, the antenna's red light, windows
// that switch on and off.
function drawTwinkle(city, frame) {
  const c = makeCanvas()
  const r = rand(23)
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * W), y = Math.floor(r() * 120)
    const bright = r() < 0.4
    if ((i + frame) % 3 === 0) continue
    set(c, x, y, hex(bright ? '#fffbe8' : '#b9b7d8'))
    if (bright && (i + frame) % 2) { set(c, x - 1, y, hex('#6b6a9a')); set(c, x + 1, y, hex('#6b6a9a')) }
  }
  const tower = city.near.find((b) => b.tower)
  if (frame === 0) { set(c, tower.x + 44, tower.top - 27, hex('#ff4a4a')); set(c, tower.x + 44, tower.top - 28, hex('#ff9a8a')) }
  // a couple of near windows flicking
  const wx = tower.x + 6 + 10 * (frame ? 2 : 3), wy = tower.top + 8 + 12 * (frame ? 4 : 6)
  rect(c, wx, wy, 5, 5, hex('#ffd27a'))
  return c
}

function drawPrecip(kind, frame, heavy) {
  const c = makeCanvas()
  const frames = kind === 'rain' ? 4 : 6
  const r = rand(kind === 'rain' ? (heavy ? 31 : 29) : heavy ? 41 : 37)
  const count = kind === 'rain' ? (heavy ? 110 : 80) : heavy ? 110 : 80
  for (let i = 0; i < count; i++) {
    const x0 = Math.floor(r() * (W + 40)) - 20
    const y0 = Math.floor(r() * H)
    if (kind === 'rain') {
      // a 6 px streak leaning left, 9 px further down each frame, wrapping
      const y = (y0 + frame * Math.floor(H / frames / 9) * 9) % H
      const x = x0 - Math.floor((frame * 4) / 2)
      for (let k = 0; k < 6; k++) set(c, x - (k >> 1), y + k, hex(k < 2 ? '#aebfdc' : '#e4ecf8'))
    } else {
      // flakes drift down 3 px a frame and sway
      const y = (y0 + frame * 3) % H
      const x = x0 + Math.round(Math.sin((frame / frames) * Math.PI * 2 + i) * 1.4)
      set(c, x, y, hex('#ffffff'))
      if (i % 3 === 0) { set(c, x + 1, y, hex('#e6eaf4')); set(c, x, y + 1, hex('#e6eaf4')); set(c, x + 1, y + 1, hex('#d4dae8')) }
    }
  }
  return c
}

async function save(c, mask, name) {
  const buf = Buffer.alloc(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    const p = c.px[i]
    if (!p || !mask[i]) continue
    buf[i * 4] = p[0]; buf[i * 4 + 1] = p[1]; buf[i * 4 + 2] = p[2]; buf[i * 4 + 3] = 255
  }
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toFile(join(outDir, name))
}

async function main() {
  await mkdir(outDir, { recursive: true })
  const mask = await glassMask()
  const city = buildCity()
  for (const light of Object.keys(PALETTES)) {
    for (const weather of ['clear', 'rain', 'snow']) await save(drawView(city, light, weather), mask, `${light}-${weather}.png`)
  }
  for (const f of [0, 1]) await save(drawTwinkle(city, f), mask, `twinkle-${f + 1}.png`)
  for (const [kind, n] of [['rain', 4], ['snow', 6]]) {
    for (let f = 0; f < n; f++) {
      await save(drawPrecip(kind, f, false), mask, `${kind}-${f + 1}.png`)
      await save(drawPrecip(kind, f, true), mask, `${kind}-heavy-${f + 1}.png`)
    }
  }
  console.log(`window: 12 views + twinkle + rain/snow frames, ${W}x${H} at stage (${VIEW.x},${VIEW.y})`)
}

await main()
