import { DESK_SHELF_SPRITES } from './desk-shelf-sprites'

/**
 * The shelf as seen from the desk close-up. The close-up art only shows the
 * underside of the shelf's bottom board (its top 60 rows), so the desk view
 * draws the rest of the shelf ABOVE the stage (`desk-shelf-top*.png`, rows
 * -EXT_H..-1, drawn by scripts/draw-desk-shelf.mjs) and "looking up" pans the
 * camera down by LOOK_UP px to show it. At rest only the bottoms of the items
 * show above the lip; the lip (close-up rows 24..61) is painted again over the
 * items so their feet sit behind it.
 *
 * The items are drawn for this view (straight on, from below) by
 * scripts/draw-desk-shelf-items.mjs, one sprite each, books included.
 */
export const DESK_SHELF = {
  /** Height of the drawn extension; must match EXT_H in scripts/draw-desk-shelf.mjs. */
  extH: 270,
  /** How far looking up pans the desk down. */
  lookUp: 270,
  /** The shelf's front lip in the close-up, painted over the items' feet. */
  lip: { x: 36, y: 24, w: 897, h: 38 },
  /** The visible shelf strip at rest (interior rows 0..lip): the look-up hotspot. */
  peek: { x: 36, y: 0, w: 897, h: 62 },
} as const

export type DeskShelfKind = (typeof DESK_SHELF_SPRITES)[number]['kind']

export interface DeskShelfItem {
  /** Book id, desk app id, or 'catan' / 'vhs'. */
  id: string
  kind: DeskShelfKind
  /** Rest, then the two-step highlight. */
  frames: string[]
  x: number
  y: number
  w: number
  h: number
  /** Pixel mask local to the box, for CSS clip-path. */
  hit: string
}

/** The shelf's items in render order (later stands in front). */
export const DESK_SHELF_ITEMS: DeskShelfItem[] = DESK_SHELF_SPRITES.map((s) => ({
  ...s,
  frames: [1, 2, 3].map((i) => `/room/desk-shelf-${s.id}-${i}.png`),
}))

/** The iPod on the desk close-up, right of the mouse pad below the right speaker (2x the room sprite). */
export const DESK_IPOD = { x: 1208, y: 572, w: 198, h: 84 }
