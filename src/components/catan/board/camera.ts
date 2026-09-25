/**
 * Pure camera maths for the board view. Coordinates:
 * - k: integer device-pixel scale (one logical board pixel = k device pixels)
 * - scale: CSS px per logical px = k / dpr
 * - offsetX/Y: CSS px from the board area's top-left to the board canvas origin
 *
 * The camera fits the content box (board/content.ts), not the full canvas.
 */

import { CONTENT_BOX } from './content'

export interface Camera {
  k: number
  scale: number
  offsetX: number
  offsetY: number
}

export type FitScale = Camera

export const MAX_EMPTY_SEA = 24

function snap(value: number, dpr: number): number {
  return Math.round(value * dpr) / dpr
}

/** Largest integer k that fits the content box in the viewport. */
export function maxFitK(areaW: number, areaH: number, dpr: number): number {
  if (areaW <= 0 || areaH <= 0) return 1
  return Math.max(1, Math.floor(Math.min((areaW * dpr) / CONTENT_BOX.width, (areaH * dpr) / CONTENT_BOX.height)))
}

/**
 * Fit camera: integer device-pixel scale, content box centred, translation
 * snapped to device pixels.
 */
export function fitScale(areaW: number, areaH: number, dpr: number): FitScale {
  const k = maxFitK(areaW, areaH, dpr)
  const scale = k / dpr
  const offsetX = snap(areaW / 2 - (CONTENT_BOX.x + CONTENT_BOX.width / 2) * scale, dpr)
  const offsetY = snap(areaH / 2 - (CONTENT_BOX.y + CONTENT_BOX.height / 2) * scale, dpr)
  return { k, scale, offsetX, offsetY }
}

export function kRange(areaW: number, areaH: number, dpr: number): { k0: number; maxK: number } {
  const k0 = maxFitK(areaW, areaH, dpr)
  return { k0, maxK: 3 * k0 }
}

/**
 * Clamp a camera so the viewport never shows more than MAX_EMPTY_SEA CSS px of
 * empty sea beyond the content box on an axis where the content is larger than
 * the viewport, and centres the content on an axis where it is smaller.
 */
export function clampPan(k: number, offsetX: number, offsetY: number, areaW: number, areaH: number, dpr: number): Camera {
  const scale = k / dpr
  const contentW = CONTENT_BOX.width * scale
  const contentH = CONTENT_BOX.height * scale

  let contentLeft = offsetX + CONTENT_BOX.x * scale
  if (contentW > areaW) {
    contentLeft = Math.min(Math.max(contentLeft, areaW - contentW - MAX_EMPTY_SEA), MAX_EMPTY_SEA)
  } else {
    contentLeft = (areaW - contentW) / 2
  }

  let contentTop = offsetY + CONTENT_BOX.y * scale
  if (contentH > areaH) {
    contentTop = Math.min(Math.max(contentTop, areaH - contentH - MAX_EMPTY_SEA), MAX_EMPTY_SEA)
  } else {
    contentTop = (areaH - contentH) / 2
  }

  return {
    k,
    scale,
    offsetX: snap(contentLeft - CONTENT_BOX.x * scale, dpr),
    offsetY: snap(contentTop - CONTENT_BOX.y * scale, dpr),
  }
}

/**
 * New camera after zooming to newK while keeping the logical point under the
 * viewport point (viewX, viewY) fixed, then clamping the pan.
 */
export function zoomAtPoint(
  k: number,
  offsetX: number,
  offsetY: number,
  areaW: number,
  areaH: number,
  dpr: number,
  viewX: number,
  viewY: number,
  newK: number,
): Camera {
  const scale = k / dpr
  const nextScale = newK / dpr
  const logicalX = (viewX - offsetX) / scale
  const logicalY = (viewY - offsetY) / scale
  return clampPan(newK, viewX - logicalX * nextScale, viewY - logicalY * nextScale, areaW, areaH, dpr)
}
