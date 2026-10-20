// Animates the One Punch Man poster for hover, from the layers of the hand-drawn
// assets/pixel-art/poster/saitama.ase (read here directly: bg, g = the sunburst, saitama,
// text, frame, "Layer 1" = the cape, "Layer 2" = the fist that breaks out of the poster).
//
//   node scripts/draw-saitama.mjs && npm run lighting
//
// Writes public/room/saitama-1..26.png into a box 16 px wider on the left than the art,
// for the punch. objects.ts plays them at 50 ms (SAITAMA_LOOP_FROM loops 15-26):
//   1      at rest, exactly the poster as drawn
//   2-3    the room's #f6da9c highlight grown 1 then 2 px
//   4-12   the punch: the hand-drawn fist grows out of his raised hand and through the
//          poster's edge, drawn in front of the frame and the cape
//   13-14  impact: the fist overshoots and recoils, the poster jolts, a burst off the fist
//   15-26  idle loop: the sunburst boils and light streaks fly out behind him, power
//          ticks flicker round the fist, a shine twinkles on his head
// Layers are composited bottom to top: bg, sunburst, streaks, saitama, text, frame, cape,
// fist. The cape's colours come from the exported saitama-1.png (the .ase has an older
// shading), so frame 1 matches the poster as it always looked.
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '..', 'assets', 'pixel-art', 'poster')
const outDir = join(__dirname, '..', 'public', 'room')

// The sprite box on the stage (objects.ts). The .ase canvas is in stage coordinates.
const BOX = { left: 745, top: 76, width: 193, height: 243 }
const W = BOX.width
const H = BOX.height

const HIGHLIGHT = [0xf6, 0xda, 0x9c]
const BURST = [255, 246, 206]
const BURST_RIM = [255, 211, 77]
const STREAK = [255, 236, 200]
const SHINE = [255, 252, 240]
const SHINE_RIM = [255, 226, 190]

const LOOP = 12
// Box coordinates: the sunburst's centre behind him, and the shine on his head.
const BURST_CENTRE = [138, 132]
const HEAD_SHINE = [113, 45]

// ---------------------------------------------------------------- reading the .ase

const LAYER = { bg: 1, g: 2, saitama: 3, text: 4, frame: 5, fist: 6, cape: 7 }

function readAse(path) {
  const d = readFileSync(path)
  const frames = d.readUInt16LE(6)
  let off = 128
  const out = []
  for (let f = 0; f < frames; f++) {
    const size = d.readUInt32LE(off)
    const chunks = d.readUInt32LE(off + 12) || d.readUInt16LE(off + 6)
    let p = off + 16
    const cels = {}
    for (let c = 0; c < chunks; c++) {
      const csize = d.readUInt32LE(p)
      const type = d.readUInt16LE(p + 4)
      if (type === 0x2005) {
        const layer = d.readUInt16LE(p + 6)
        const x = d.readInt16LE(p + 8), y = d.readInt16LE(p + 10)
        const celType = d.readUInt16LE(p + 13)
        if (celType === 2 && layer) {
          const w = d.readUInt16LE(p + 22), h = d.readUInt16LE(p + 24)
          cels[layer] = { x, y, w, h, data: inflateSync(d.subarray(p + 26, p + csize)) }
        }
      }
      p += csize
    }
    out.push(cels)
    off += size
  }
  return out
}

// ---------------------------------------------------------------- canvas helpers

const blank = () => Buffer.alloc(W * H * 4)
const idx = (x, y) => (y * W + x) * 4
const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H

/** A cel as a full-box layer (stage coords -> box coords). */
function celLayer(cel) {
  const buf = blank()
  if (!cel) return buf
  for (let y = 0; y < cel.h; y++) for (let x = 0; x < cel.w; x++) {
    const bx = cel.x + x - BOX.left, by = cel.y + y - BOX.top
    if (!inside(bx, by)) continue
    const s = (y * cel.w + x) * 4
    if (cel.data[s + 3]) cel.data.copy(buf, idx(bx, by), s, s + 4)
  }
  return buf
}

function over(dst, src) {
  for (let i = 0; i < W * H; i++) if (src[i * 4 + 3]) src.copy(dst, i * 4, i * 4, i * 4 + 4)
  return dst
}
function put(buf, x, y, c) {
  if (!inside(x, y)) return
  const i = idx(x, y)
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255
}
function mix(buf, x, y, c, t) {
  if (!inside(x, y)) return
  const i = idx(x, y)
  for (let k = 0; k < 3; k++) buf[i + k] = Math.round(buf[i + k] + (c[k] - buf[i + k]) * t)
}
function shifted(buf, dx, dy) {
  const out = blank()
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y)
    if (buf[i + 3] && inside(x + dx, y + dy)) buf.copy(out, idx(x + dx, y + dy), i, i + 4)
  }
  return out
}

// ---------------------------------------------------------------- the layers

const ase = readAse(join(srcDir, 'saitama.ase'))
const exported = await sharp(join(srcDir, 'saitama-1.png')).extract(BOX).ensureAlpha().raw().toBuffer()

const bg = celLayer(ase[0][LAYER.bg]) // the brown, with the poster's own edge
const saitama = celLayer(ase[0][LAYER.saitama])
const text = celLayer(ase[0][LAYER.text])
const frameLine = celLayer(ase[0][LAYER.frame])
// The cape's shape from the .ase, its colours from the exported poster.
const cape = celLayer(ase[0][LAYER.cape])
for (let i = 0; i < W * H; i++) if (cape[i * 4 + 3]) exported.copy(cape, i * 4, i * 4, i * 4 + 4)
// The sunburst as drawn in the .ase: calm in frames 1-3, then four energetic variants.
const sunbursts = [0, 3, 4, 5, 6].map((f) => celLayer(ase[f][LAYER.g]))
// The fist breaking out, frames 4-12 of the .ase, growing as it comes.
const fists = [3, 4, 5, 6, 7, 8, 9, 10, 11].map((f) => ({ layer: celLayer(ase[f][LAYER.fist]), cel: ase[f][LAYER.fist] }))

// The poster's interior (the brown, not its dark edge): the sunburst never spills past it.
const interior = new Uint8Array(W * H)
for (let i = 0; i < W * H; i++) {
  interior[i] = bg[i * 4 + 3] && Math.max(bg[i * 4], bg[i * 4 + 1], bg[i * 4 + 2]) > 40 ? 1 : 0
}
for (const buf of sunbursts) for (let i = 0; i < W * H; i++) if (!interior[i]) buf[i * 4 + 3] = 0

// His raised fist becomes the fist that breaks out, so it leaves his body when the punch
// starts: the glove's reds in the upper left of the saitama layer, and their ink.
const saitamaNoFist = Buffer.from(saitama)
{
  const isGlove = (i) => {
    const r = saitama[i * 4], g = saitama[i * 4 + 1], b = saitama[i * 4 + 2]
    return saitama[i * 4 + 3] && r > 70 && r > g * 1.8 && r > b * 1.6
  }
  const region = (x, y) => x >= 45 && x <= 98 && y >= 60 && y <= 115
  const glove = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (region(x, y) && isGlove(y * W + x)) glove[y * W + x] = 1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x
    if (!region(x, y) || !saitama[i * 4 + 3]) continue
    const near = glove[i] || [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => glove[(y + dy) * W + x + dx])
    if (near) saitamaNoFist[i * 4 + 3] = 0
  }
}

// ---------------------------------------------------------------- motion

// Light streaks flying outward from behind him, over the background only.
const STREAKS = Array.from({ length: 16 }, (_, i) => ({ angle: (i / 16) * Math.PI * 2 + (i % 3) * 0.11, offset: (i * 5) % LOOP }))
function streaks(buf, t) {
  for (const { angle, offset } of STREAKS) {
    const r = 18 + ((t + offset) % LOOP) * 9
    for (let k = 0; k < 8; k++) {
      const x = Math.round(BURST_CENTRE[0] + Math.cos(angle) * (r + k))
      const y = Math.round(BURST_CENTRE[1] + Math.sin(angle) * (r + k))
      if (inside(x, y) && interior[y * W + x]) mix(buf, x, y, STREAK, k < 3 ? 0.25 : 0.5)
    }
  }
}

function burst(buf, [cx, cy], r0, len, angles) {
  for (const a of angles) {
    const rad = (a * Math.PI) / 180
    const dx = Math.cos(rad), dy = Math.sin(rad)
    for (let k = 0; k <= len; k++) put(buf, Math.round(cx + dx * (r0 + k)), Math.round(cy + dy * (r0 + k)), BURST)
    put(buf, Math.round(cx + dx * (r0 + len + 1)), Math.round(cy + dy * (r0 + len + 1)), BURST_RIM)
  }
}

function sparkle(buf, [x, y], size) {
  if (!size) return
  put(buf, x, y, SHINE)
  for (let k = 1; k <= size; k++) {
    const c = k === size ? SHINE_RIM : SHINE
    for (const [dx, dy] of [[k, 0], [-k, 0], [0, k], [0, -k]]) put(buf, x + dx, y + dy, c)
  }
  if (size >= 2) for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) put(buf, x + dx, y + dy, SHINE_RIM)
}

function highlight(buf, n) {
  const out = Buffer.from(buf)
  let edge = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) edge[i] = buf[i * 4 + 3] ? 1 : 0
  for (let step = 0; step < n; step++) {
    const next = Uint8Array.from(edge)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (edge[y * W + x]) continue
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) && edge[(y + dy) * W + x + dx])) {
        next[y * W + x] = 1
        put(out, x, y, HIGHLIGHT)
      }
    }
    edge = next
  }
  return out
}

/** One composited frame. */
function compose({ t, sunburst, fist = null, fistDx = 0, hl = 2 }) {
  const buf = blank()
  over(buf, bg)
  over(buf, sunbursts[sunburst])
  if (t) streaks(buf, t)
  over(buf, fist ? saitamaNoFist : saitama)
  over(buf, text)
  over(buf, frameLine)
  over(buf, cape)
  if (fist) over(buf, shifted(fist.layer, fistDx, 0))
  return hl ? highlight(buf, hl) : buf
}

// ---------------------------------------------------------------- frames

const frames = []
frames.push(compose({ t: 0, sunburst: 0, hl: 0 })) // 1: rest
frames.push(compose({ t: 1, sunburst: 0, hl: 1 })) // 2
frames.push(compose({ t: 2, sunburst: 0 })) // 3
// 4-12: the punch; the sunburst flares through the energetic variants
fists.forEach((fist, i) => frames.push(compose({ t: 3 + i, sunburst: 1 + (i % 4), fist })))
// 13-14: impact
const last = fists[fists.length - 1]
const fistCentre = [last.cel.x - BOX.left + 14, last.cel.y - BOX.top + 26]
const impacts = [
  { dx: -2, jolt: -1, r0: 17, len: 7, angles: [125, 145, 165, 185, 205, 225, 245] },
  { dx: -1, jolt: 1, r0: 19, len: 4, angles: [135, 160, 185, 210, 235] },
]
impacts.forEach(({ dx, jolt, r0, len, angles }, i) => {
  const f = compose({ t: 12 + i, sunburst: 3 + (i % 2), fist: last, fistDx: dx })
  burst(f, [fistCentre[0] + dx, fistCentre[1]], r0, len, angles)
  frames.push(shifted(f, jolt, 0))
})
// 15-26: idle loop
for (let k = 0; k < LOOP; k++) {
  const step = Math.floor(k / 3)
  const f = compose({ t: 14 + k, sunburst: [3, 4, 2, 4][step], fist: last })
  burst(f, fistCentre, 21, 2, step % 2 ? [140, 195, 240] : [165, 215, 120])
  sparkle(f, HEAD_SHINE, [2, 3, 2, 0][step])
  frames.push(f)
}

for (const [i, buf] of frames.entries()) {
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(join(outDir, `saitama-${i + 1}.png`))
}
console.log(`saitama: ${frames.length} frames, ${W}x${H} at stage (${BOX.left},${BOX.top}); loop from frame ${frames.length - LOOP + 1}`)
