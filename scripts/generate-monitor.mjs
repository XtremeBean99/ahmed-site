import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'room')
const sourceDir = join(__dirname, '..', '..', 'pixel-art', 'monitor')

// Monitor design (pixel art, matching background palette)
// Background palette reference (sampled from background.png):
// - Warm brown desk: #6b4d3a, #5a3d2a, #4a3020
// - Lamp light: warm yellow/amber
// - Dark wood/floor: #3a2820, #2a1a10
// - Wall: warm grey-brown

// Canvas size for the sprite
const W = 240
const H = 200

// Colors (matching the warm dusk palette)
const COLORS = {
  bezelDark:  [0x2a, 0x22, 0x20, 0xff], // dark grey-brown
  bezelMid:   [0x3a, 0x30, 0x2e, 0xff], // mid grey-brown
  bezelLight: [0x4a, 0x3e, 0x3a, 0xff], // lighter edge highlight
  screenOff:  [0x18, 0x16, 0x18, 0xff], // very dark screen
  screenRefl: [0x22, 0x20, 0x28, 0xc0], // faint reflection
  screenOn:   [0x1a, 0x1e, 0x3a, 0xff], // subtle lit screen
  screenGlow: [0x2a, 0x30, 0x5a, 0x80], // soft glow on desktop
  standDark:  [0x20, 0x1a, 0x18, 0xff],
  standMid:   [0x30, 0x28, 0x24, 0xff],
  standLight: [0x3e, 0x34, 0x30, 0xff],
}

function setPixel(buf, x, y, color) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const i = (y * W + x) * 4
  buf[i] = color[0]
  buf[i + 1] = color[1]
  buf[i + 2] = color[2]
  buf[i + 3] = color[3]
}

function fillRect(buf, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(buf, x + dx, y + dy, color)
    }
  }
}

function drawHLine(buf, x1, x2, y, color) {
  for (let x = x1; x <= x2; x++) setPixel(buf, x, y, color)
}

function drawVLine(buf, x, y1, y2, color) {
  for (let y = y1; y <= y2; y++) setPixel(buf, x, y, color)
}

/**
 * Draw a pixel-art flat panel LED monitor.
 * Perspective: front-facing flat panel, slight 3D depth on bezel edges.
 * 
 * Layout (within 240x200 canvas):
 *   - Screen area: x 25-215, y 15-130 (190x115)
 *   - Bezel: 3px around screen
 *   - Bottom bezel thicker: ~12px (has brand/logoless area)  
 *   - Stand neck: x 110-130, y 145-175
 *   - Stand base: x 70-170, y 175-185
 */
function drawMonitor(buf, state) {
  const screenX = 22, screenY = 12
  const screenW = 196, screenH = 116
  const bezelW = 3
  const bottomBezelH = 12

  // --- Bezel ---
  // Outer edge (1px darker outline)
  const bx = screenX - bezelW, by = screenY - bezelW
  const bw = screenW + bezelW * 2, bh = screenH + bezelW + bottomBezelH

  // Fill bezel body
  fillRect(buf, bx, by, bw, bh, COLORS.bezelMid)

  // Bezel outline (1px darker)
  drawHLine(buf, bx, bx + bw - 1, by, COLORS.bezelDark)
  drawHLine(buf, bx, bx + bw - 1, by + bh - 1, COLORS.bezelDark)
  drawVLine(buf, bx, by, by + bh - 1, COLORS.bezelDark)
  drawVLine(buf, bx + bw - 1, by, by + bh - 1, COLORS.bezelDark)

  // Inner bezel highlight (1px lighter inner edge)
  drawHLine(buf, bx + 1, bx + bw - 2, by + 1, COLORS.bezelLight)
  drawVLine(buf, bx + 1, by + 1, by + bh - 2, COLORS.bezelLight)

  // Slight gradient on bezel (top lighter, bottom darker)
  for (let y = by + 2; y < by + bh - 1; y++) {
    const t = (y - by) / bh
    const r = Math.round(COLORS.bezelMid[0] * (1 - t * 0.3))
    const g = Math.round(COLORS.bezelMid[1] * (1 - t * 0.3))
    const b = Math.round(COLORS.bezelMid[2] * (1 - t * 0.3))
    fillRect(buf, bx + 2, y, bw - 4, 1, [r, g, b, 0xff])
  }

  // --- Screen ---
  if (state === 'off') {
    // Dark screen with faint reflection
    fillRect(buf, screenX, screenY, screenW, screenH, COLORS.screenOff)
    // Subtle reflection gradient (top-left to bottom-right darkening)
    for (let y = screenY; y < screenY + screenH; y++) {
      for (let x = screenX; x < screenX + screenW; x++) {
        const dx = (x - screenX) / screenW
        const dy = (y - screenY) / screenH
        // Reflection band
        const refl = Math.max(0, 0.15 - Math.abs(dy - 0.25) * 0.4 - dx * 0.1)
        if (refl > 0) {
          const alpha = Math.round(refl * 0xc0)
          const i = (y * W + x) * 4
          buf[i] = Math.min(0xff, buf[i] + Math.round(refl * 30))
          buf[i + 1] = Math.min(0xff, buf[i + 1] + Math.round(refl * 25))
          buf[i + 2] = Math.min(0xff, buf[i + 2] + Math.round(refl * 40))
        }
      }
    }
  } else {
    // On state: subtly lit screen
    fillRect(buf, screenX, screenY, screenW, screenH, COLORS.screenOn)
    // Soft gradient glow (warmer in center)
    for (let y = screenY; y < screenY + screenH; y++) {
      for (let x = screenX; x < screenX + screenW; x++) {
        const cx = screenX + screenW / 2
        const cy = screenY + screenH / 2
        const dx = (x - cx) / (screenW / 2)
        const dy = (y - cy) / (screenH / 2)
        const dist = Math.sqrt(dx * dx + dy * dy)
        const glow = Math.max(0, 1 - dist) * 0.15
        if (glow > 0) {
          const i = (y * W + x) * 4
          buf[i] = Math.min(0xff, buf[i] + Math.round(glow * 40))
          buf[i + 1] = Math.min(0xff, buf[i + 1] + Math.round(glow * 35))
          buf[i + 2] = Math.min(0xff, buf[i + 2] + Math.round(glow * 50))
        }
      }
    }
    // Subtle inner screen border (1px glow)
    drawHLine(buf, screenX, screenX + screenW - 1, screenY, [0x3a, 0x38, 0x5a, 0x80])
    drawHLine(buf, screenX, screenX + screenW - 1, screenY + screenH - 1, [0x3a, 0x38, 0x5a, 0x80])
    drawVLine(buf, screenX, screenY, screenY + screenH - 1, [0x3a, 0x38, 0x5a, 0x80])
    drawVLine(buf, screenX + screenW - 1, screenY, screenY + screenH - 1, [0x3a, 0x38, 0x5a, 0x80])
  }

  // --- Stand ---
  const standTopY = by + bh + 2
  const standNeckW = 14
  const standNeckH = 28
  const standNeckX = Math.round(W / 2 - standNeckW / 2)

  // Neck (vertical bar connecting to base)
  for (let y = standTopY; y < standTopY + standNeckH; y++) {
    const t = (y - standTopY) / standNeckH
    const width = Math.round(standNeckW - t * 6)
    const offset = Math.round((standNeckW - width) / 2)
    fillRect(buf, standNeckX + offset, y, width, 1, COLORS.standMid)
  }

  // Neck highlight (1px left edge)
  for (let y = standTopY; y < standTopY + standNeckH; y++) {
    const t = (y - standTopY) / standNeckH
    const offset = Math.round((standNeckW - Math.round(standNeckW - t * 6)) / 2)
    if (offset < standNeckW - 1) {
      setPixel(buf, standNeckX + offset, y, COLORS.standLight)
    }
  }

  // Base (wider flat bar on desk)
  const baseY = standTopY + standNeckH
  const baseW = 94
  const baseH = 8
  const baseX = Math.round(W / 2 - baseW / 2)

  // Base body
  fillRect(buf, baseX, baseY, baseW, baseH, COLORS.standDark)
  
  // Base top highlight
  drawHLine(buf, baseX + 1, baseX + baseW - 2, baseY, COLORS.standLight)
  
  // Base slight gradient
  for (let y = baseY + 1; y < baseY + baseH; y++) {
    fillRect(buf, baseX + 1, y, baseW - 2, 1, 
      y < baseY + baseH / 2 ? COLORS.standMid : COLORS.standDark)
  }

  // Base shadow on desk (subtle dark line below base)
  drawHLine(buf, baseX + 4, baseX + baseW - 5, baseY + baseH, [0x10, 0x0c, 0x0a, 0x60])
}

async function createImage(state) {
  const buf = Buffer.alloc(W * H * 4, 0)

  drawMonitor(buf, state)

  return sharp(buf, {
    raw: {
      width: W,
      height: H,
      channels: 4,
    },
  }).png()
}

async function main() {
  await mkdir(outDir, { recursive: true })
  await mkdir(sourceDir, { recursive: true })

  // Generate off state
  const offImg = createImage('off')
  await (await offImg).toFile(join(outDir, 'monitor-off.png'))
  await (await offImg).toFile(join(sourceDir, 'monitor-off.png'))
  console.log('Created monitor-off.png')

  // Generate on state
  const onImg = createImage('on')
  await (await onImg).toFile(join(outDir, 'monitor-on.png'))
  await (await onImg).toFile(join(sourceDir, 'monitor-on.png'))
  console.log('Created monitor-on.png')

  console.log(`\nMonitor sprite dimensions: ${W}x${H}`)
  console.log(`Placement target on stage: x ~320, y ~280 (adjust after composite check)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
