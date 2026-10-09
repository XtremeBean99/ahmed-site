import { ROOM_OBJECTS, SHELF_GAMES } from './objects'

/**
 * The shelf as seen from the desk close-up. The close-up art only shows the
 * underside of the shelf's bottom board (its top 60 rows), so the desk view
 * draws the rest of the shelf ABOVE the stage (`desk-shelf-top*.png`, rows
 * -EXT_H..-1, drawn by scripts/draw-desk-shelf.mjs) and "looking up" pans the
 * camera down by LOOK_UP px to show it. At rest only the bottoms of the items
 * show above the lip; the lip (close-up rows 24..61) is painted again over the
 * items so their feet sit behind it.
 *
 * The items are the room's own shelf sprites drawn at 2x: same frames, same
 * hit masks scaled up, so a change to the room art follows here for free.
 */
export const DESK_SHELF = {
  /** Height of the drawn extension; must match EXT_H in scripts/draw-desk-shelf.mjs. */
  extH: 300,
  /** How far looking up pans the desk down. */
  lookUp: 300,
  /** The shelf's front lip in the close-up, painted over the items' feet. */
  lip: { x: 36, y: 24, w: 897, h: 38 },
  /** Interior span between the side boards. */
  inner: { x0: 62, x1: 906 },
  /** The visible shelf strip at rest (interior rows 0..lip): the look-up hotspot. */
  peek: { x: 36, y: 0, w: 897, h: 62 },
} as const

const SCALE = 2
/** Room-view front lip of the shelf floor: y 242 at x 300, rising 0.135 px per px. */
const roomLip = (x: number) => 242 - 0.135 * (x - 300)
/** Close-up row the frontmost item's box bottom lands on (its 2 px pad sits behind the lip). */
const FEET_Y = 28
/** Deeper items sit lower behind the lip, as they would seen from below. */
const DEPTH_DROP = 0.6

export type DeskShelfKind = 'catan' | 'books' | 'vhs' | 'game'

export interface DeskShelfItem {
  id: string
  kind: DeskShelfKind
  /** The room sprite's frames, drawn at 2x. */
  frames: string[]
  x: number
  y: number
  w: number
  h: number
  /** The room hit mask scaled to the 2x box (games only). */
  hit?: string
}

/** Scales every number in an M/h/v/z SVG path. */
export function scalePath(path: string, k: number): string {
  return path.replace(/-?\d+(\.\d+)?/g, (n) => String(Number(n) * k))
}

interface RoomBox { id: string; kind: DeskShelfKind; frames: string[]; x: number; y: number; w: number; h: number; hit?: string }

function roomBoxes(): RoomBox[] {
  const obj = (id: string) => ROOM_OBJECTS.find((o) => o.id === id)!
  const pick = (id: 'catan' | 'books' | 'vhs'): RoomBox => {
    const o = obj(id)
    return { id, kind: id, frames: o.frames, x: o.x, y: o.y, w: o.w, h: o.h }
  }
  return [
    pick('catan'),
    pick('books'),
    pick('vhs'),
    ...SHELF_GAMES.map((g) => ({ id: g.app, kind: 'game' as const, frames: g.frames, x: g.x, y: g.y, w: g.w, h: g.h, hit: g.hit })),
  ]
}

/**
 * Lays the room's shelf out on the close-up shelf, in the room's render order
 * (later stands in front). Catan, the books and the VHS keep their exact 2x
 * spacing (the books overlap the Catan boxes by design); the games after them
 * are squeezed so the row ends at the right side board. Feet keep the room's
 * depth order.
 */
export function deskShelfItems(): DeskShelfItem[] {
  const boxes = roomBoxes()
  const left = Math.min(...boxes.map((b) => b.x))
  const pivot = boxes.find((b) => b.kind === 'vhs')!.x
  const last = boxes.reduce((a, b) => (b.x > a.x ? b : a))
  const pivotX = DESK_SHELF.inner.x0 + (pivot - left) * SCALE
  const squeeze = Math.min(SCALE, (DESK_SHELF.inner.x1 - last.w * SCALE - pivotX) / (last.x - pivot))
  const deskX = (x: number) => (x <= pivot ? DESK_SHELF.inner.x0 + (x - left) * SCALE : pivotX + (x - pivot) * squeeze)
  const front = (b: RoomBox) => b.y + b.h - roomLip(b.x + b.w / 2)
  const frontmost = Math.max(...boxes.map(front))
  return boxes.map((b) => {
    const w = b.w * SCALE
    const h = b.h * SCALE
    const feet = FEET_Y + Math.round((frontmost - front(b)) * DEPTH_DROP)
    return {
      id: b.id,
      kind: b.kind,
      frames: b.frames,
      x: Math.round(deskX(b.x)),
      y: feet - h,
      w,
      h,
      hit: b.hit ? scalePath(b.hit, SCALE) : undefined,
    }
  })
}

/** The iPod on the desk close-up, right of the mouse pad below the right speaker (2x the room sprite). */
export const DESK_IPOD = { x: 1208, y: 572, w: 198, h: 84 }
