/**
 * Logical-pixel content box of the board: the union of every vertex point,
 * every harbour plate rect and every pier sprite rect, plus a 3 px margin.
 * Camera fitting uses this box, not the full 279x265 canvas, so the island
 * can be as large as the board area allows.
 */

import { PORT_EDGES, VERTICES } from '@/lib/games/catan/geometry'
import { vertexPoint } from '../board-layout'
import { harborPlateRect, pierSpriteRect } from '../pixel-art'
import type { Rect } from '../pixel-art'

export interface ContentBox {
  x: number
  y: number
  width: number
  height: number
}

const MARGIN = 3

function includeRect(box: { minX: number; minY: number; maxX: number; maxY: number }, rect: Rect): void {
  box.minX = Math.min(box.minX, rect.x)
  box.minY = Math.min(box.minY, rect.y)
  box.maxX = Math.max(box.maxX, rect.x + rect.width - 1)
  box.maxY = Math.max(box.maxY, rect.y + rect.height - 1)
}

function computeContentBox(): ContentBox {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }

  for (const vertex of VERTICES) {
    const p = vertexPoint(vertex.id)
    box.minX = Math.min(box.minX, p.x)
    box.minY = Math.min(box.minY, p.y)
    box.maxX = Math.max(box.maxX, p.x)
    box.maxY = Math.max(box.maxY, p.y)
  }

  for (const edge of PORT_EDGES) {
    // Cover both harbour plate widths so any shuffled port setup fits.
    includeRect(box, harborPlateRect(edge, 'any'))
    includeRect(box, harborPlateRect(edge, 'brick'))
    includeRect(box, pierSpriteRect(edge))
  }

  return {
    x: box.minX - MARGIN,
    y: box.minY - MARGIN,
    width: box.maxX - box.minX + 1 + MARGIN * 2,
    height: box.maxY - box.minY + 1 + MARGIN * 2,
  }
}

export const CONTENT_BOX: ContentBox = computeContentBox()
