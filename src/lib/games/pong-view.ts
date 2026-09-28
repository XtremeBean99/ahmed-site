// src/lib/games/pong-view.ts
/**
 * Pure mapping between the Pong engine's 536x280 court and the portrait view,
 * where the court is turned vertical: the engine's x axis becomes the view's
 * vertical axis and its y axis the horizontal one, so the engine's left paddle
 * is the bottom one and the right paddle is the top one. Landscape is the identity.
 */
import { COURT_H, COURT_W } from './pong-engine'

export interface PongViewSize {
  w: number
  h: number
}

export function viewSize(portrait: boolean): PongViewSize {
  return portrait ? { w: COURT_H, h: COURT_W } : { w: COURT_W, h: COURT_H }
}

export function toView(x: number, y: number, portrait: boolean): { x: number; y: number } {
  return portrait ? { x: y, y: COURT_W - x } : { x, y }
}

export function fromView(x: number, y: number, portrait: boolean): { x: number; y: number } {
  return portrait ? { x: COURT_W - y, y: x } : { x, y }
}
