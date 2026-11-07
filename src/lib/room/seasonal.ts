// src/lib/room/seasonal.ts
//
// Seasonal decorations: which set is up on the visitor's own date, and where
// each piece sits in the room. Pure and tested; decor-art.ts draws the pieces
// and RoomDecor.tsx puts them in the room.

import type { CalendarDate } from './calendar'

export type DecorId = 'halloween' | 'christmas' | 'valentines'

interface MonthDay { month: number; day: number }

/** When each set is up, inclusive, visitor-local. A window may wrap past New Year. */
export const DECOR_WINDOWS: { id: DecorId; from: MonthDay; to: MonthDay }[] = [
  { id: 'valentines', from: { month: 1, day: 7 }, to: { month: 1, day: 14 } },
  { id: 'halloween', from: { month: 9, day: 17 }, to: { month: 10, day: 1 } },
  // Up on 1 December, down after Twelfth Night.
  { id: 'christmas', from: { month: 11, day: 1 }, to: { month: 0, day: 6 } },
]

const key = ({ month, day }: MonthDay) => month * 100 + day

export function decorFor(today: CalendarDate): DecorId | null {
  const k = key(today)
  for (const w of DECOR_WINDOWS) {
    const from = key(w.from), to = key(w.to)
    if (from <= to ? k >= from && k <= to : k >= from || k <= to) return w.id
  }
  return null
}

const DECOR_IDS: DecorId[] = ['halloween', 'christmas', 'valentines']

/**
 * `?decor=halloween|christmas|valentines` forces a set and `?decor=none` takes
 * everything down; undefined means no (valid) override, so use the date.
 */
export function decorOverride(search: string): DecorId | null | undefined {
  const v = new URLSearchParams(search).get('decor')
  if (v === 'none') return null
  return DECOR_IDS.find((id) => id === v)
}

// ── Placement (stage pixels, measured off background.png) ───────────────────

/**
 * The shelf's front lip, the dark line between its top and its front face:
 * y 149 at x 100 falling to y 115 at x 500. Garlands hang from pins on it.
 */
export function shelfLipY(x: number): number {
  return 157.6 - 0.085 * x
}

/** Pin positions along the lip, left end to right end of the shelf front. */
export const SHELF_PINS = [44, 135, 226, 317, 408, 499, 588]

/** How far a garland sags below the lip midway between two pins. */
export const GARLAND_SAG = 9

/** Canvas rect covering the shelf front and whatever hangs off it. */
export const GARLAND_RECT = { x: 36, y: 100, w: 560, h: 70 }

/** Base centre of the jack-o'-lantern on the windowsill, left of the bonsai. */
export const PUMPKIN_BASE = { x: 1192, y: 387 }

/** Canvas rect for the jack-o'-lantern, with room for its shadow and the hover outline. */
export const PUMPKIN_RECT = { x: PUMPKIN_BASE.x - 21, y: PUMPKIN_BASE.y - 33, w: 46, h: 38 }

/** The shelf's inside top-right corner, where the cobweb is spun. */
export const COBWEB_CORNER = { x: 540, y: 124 }

/** Canvas rect for the cobweb, hanging left and down from the corner. */
export const COBWEB_RECT = { x: COBWEB_CORNER.x - 26, y: COBWEB_CORNER.y - 4, w: 30, h: 30 }

/** Point on a garland hanging between pins a and b; t runs 0..1 from a to b. */
export function garlandPoint(a: number, b: number, t: number): { x: number; y: number } {
  const x = a + (b - a) * t
  return { x, y: shelfLipY(x) + 4 * GARLAND_SAG * t * (1 - t) }
}
