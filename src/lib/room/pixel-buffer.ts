// src/lib/room/pixel-buffer.ts
//
// Shared helpers for room art drawn in code (the calendar, the seasonal
// decorations): an RGBA buffer one pixel per stage pixel, the sprites' hover
// outline, and the lighting grades of scripts/generate-lighting.mjs.

import type { LightingState } from './lighting'

export type RGB = readonly [number, number, number]
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

const HIGHLIGHT = hex('#f6da9c')

/** An RGBA buffer; (ox, oy) shifts the drawing origin inside it. */
export class Layer {
  readonly data: Uint8ClampedArray<ArrayBuffer>
  constructor(readonly w: number, readonly h: number, readonly ox = 0, readonly oy = 0) {
    this.data = new Uint8ClampedArray(w * h * 4)
  }
  private index(x: number, y: number) {
    const px = x + this.ox, py = y + this.oy
    if (px < 0 || py < 0 || px >= this.w || py >= this.h) return -1
    return (py * this.w + px) * 4
  }
  set(x: number, y: number, c: RGB, a = 255) {
    const i = this.index(Math.round(x), Math.round(y))
    if (i < 0) return
    this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = a
  }
  get(x: number, y: number): [number, number, number, number] | null {
    const i = this.index(x, y)
    if (i < 0) return null
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
  }
  rect(x: number, y: number, w: number, h: number, c: RGB) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c)
  }
}

/** Grow the #f6da9c hover outline round every opaque pixel, like the room's sprites. */
export function outline(data: Uint8ClampedArray, W: number, H: number, radius: number) {
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && data[(y * W + x) * 4 + 3] === 255
  const ring: number[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (solid(x, y)) continue
      let hit = false
      for (let dy = -radius; dy <= radius && !hit; dy++) {
        for (let dx = -radius; dx <= radius && !hit; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= radius && solid(x + dx, y + dy)) hit = true
        }
      }
      if (hit) ring.push((y * W + x) * 4)
    }
  }
  for (const i of ring) {
    data[i] = HIGHLIGHT[0]; data[i + 1] = HIGHLIGHT[1]; data[i + 2] = HIGHLIGHT[2]; data[i + 3] = 255
  }
}

// The lighting grades of scripts/generate-lighting.mjs (keep the two in step).
// Dusk is the source art; outline ink is never graded.
const GRADES: Partial<Record<LightingState, { tint: [number, number, number]; bright: number; sat: number }>> = {
  dawn: { tint: [1.08, 0.97, 0.92], bright: 0.95, sat: 0.95 },
  day: { tint: [1.04, 1.02, 0.98], bright: 1.18, sat: 1.0 },
  night: { tint: [0.62, 0.68, 1.0], bright: 0.93, sat: 0.78 },
}
const INK_MAX = 12

export function grade(data: Uint8ClampedArray, light: LightingState) {
  const g = GRADES[light]
  if (!g) return
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    const r = data[i], gr = data[i + 1], b = data[i + 2]
    if (r <= INK_MAX && gr <= INK_MAX && b <= INK_MAX) continue
    const lum = 0.299 * r + 0.587 * gr + 0.114 * b
    data[i] = (lum + (r - lum) * g.sat) * g.tint[0] * g.bright
    data[i + 1] = (lum + (gr - lum) * g.sat) * g.tint[1] * g.bright
    data[i + 2] = (lum + (b - lum) * g.sat) * g.tint[2] * g.bright
  }
}

/** The room's lamp-off dimming (the sprites' `brightness(0.72)`), for art drawn in code. */
export const LAMP_OFF_BRIGHTNESS = 0.72

export function dim(data: Uint8ClampedArray, k = LAMP_OFF_BRIGHTNESS) {
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue
    data[i] *= k; data[i + 1] *= k; data[i + 2] *= k
  }
}
