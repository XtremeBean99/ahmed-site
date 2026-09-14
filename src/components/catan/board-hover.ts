/**
 * Pure hit-testing for board hover descriptions. All coordinates are logical
 * board pixels (the 279x265 canvas before integer scaling). Priority order:
 * building > robber > road > harbour > hex > null (open sea).
 */

import type { GameState } from '@/lib/games/catan/types'
import { BOARD_HEIGHT, BOARD_WIDTH, edgeEndpoints, hexCenter, hexAtPixel, vertexPoint } from './board-layout'
import { harborPlateRect } from './pixel-art'
import type { Rect } from './pixel-art'
import { SPRITES } from './sprites'

export type HoverTarget =
  | { kind: 'hex'; hex: number }
  | { kind: 'robber'; hex: number }
  | { kind: 'harbor'; port: number }
  | { kind: 'building'; vertex: number }
  | { kind: 'road'; edge: number }

function insideRect(x: number, y: number, rect: Rect): boolean {
  return x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

function distanceSqToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const t = lenSq === 0 ? 0 : Math.min(Math.max(((px - ax) * dx + (py - ay) * dy) / lenSq, 0), 1)
  const qx = ax + t * dx - px
  const qy = ay + t * dy - py
  return qx * qx + qy * qy
}

function edgeOrientation(edge: number): 'vertical' | 'rising' | 'falling' {
  const [a, b] = edgeEndpoints(edge)
  let dx = b.x - a.x
  let dy = b.y - a.y
  if (dx < 0) {
    dx = -dx
    dy = -dy
  }
  if (dx === 0) return 'vertical'
  return dy < 0 ? 'rising' : 'falling'
}

function pierRect(edge: number): Rect {
  const [a, b] = edgeEndpoints(edge)
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  const cx = (BOARD_WIDTH - 1) / 2
  const cy = (BOARD_HEIGHT - 1) / 2
  let dx = mx - cx
  let dy = my - cy
  const len = Math.hypot(dx, dy)
  if (len < 1) {
    dx = 0
    dy = -1
  } else {
    dx /= len
    dy /= len
  }
  const p1 = { x: Math.round(a.x + dx * 2), y: Math.round(a.y + dy * 2) }
  const p2 = { x: Math.round(b.x + dx * 2), y: Math.round(b.y + dy * 2) }
  const target = { x: Math.floor((p1.x + p2.x) / 2), y: Math.floor((p1.y + p2.y) / 2) }
  const meta = SPRITES[`pier-${edgeOrientation(edge)}`]
  return { x: target.x - meta.anchorX, y: target.y - meta.anchorY, width: meta.width, height: meta.height }
}

function robberRect(hex: number): Rect {
  const meta = SPRITES.robber
  const center = hexCenter(hex)
  return { x: center.x - meta.anchorX, y: center.y - meta.anchorY, width: meta.width, height: meta.height }
}

export function hoverTargetAt(state: GameState, x: number, y: number): HoverTarget | null {
  if (x < 0 || y < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT) return null

  for (let vertex = 0; vertex < state.buildings.length; vertex++) {
    if (state.buildings[vertex] === null) continue
    const p = vertexPoint(vertex)
    const dx = x - p.x
    const dy = y - p.y
    if (dx * dx + dy * dy <= 25) return { kind: 'building', vertex }
  }

  if (insideRect(x, y, robberRect(state.robber))) return { kind: 'robber', hex: state.robber }

  for (let edge = 0; edge < state.roads.length; edge++) {
    if (state.roads[edge] === null) continue
    const [a, b] = edgeEndpoints(edge)
    if (distanceSqToSegment(x, y, a.x, a.y, b.x, b.y) <= 9) return { kind: 'road', edge }
  }

  for (let port = 0; port < state.ports.length; port++) {
    const info = state.ports[port]
    if (insideRect(x, y, harborPlateRect(info.edge, info.type)) || insideRect(x, y, pierRect(info.edge))) {
      return { kind: 'harbor', port }
    }
  }

  const hex = hexAtPixel(x, y)
  if (hex !== null) return { kind: 'hex', hex }
  return null
}
