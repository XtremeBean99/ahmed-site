import { CAT_SIZE, ROOM_OBJECTS, SIDE_TABLE_RECT, WINDOW_GLASS, type CatSpot } from './objects'

/** A box on the 1408x768 stage. */
export interface StageRect { x: number; y: number; w: number; h: number }

export const TOUR_STEP_IDS = ['welcome', 'computer', 'shelf', 'window', 'bedside', 'cat', 'music', 'done'] as const
export type TourStepId = (typeof TOUR_STEP_IDS)[number]

const obj = (id: string): StageRect => {
  const o = ROOM_OBJECTS.find((r) => r.id === id)!
  return { x: o.x, y: o.y, w: o.w, h: o.h }
}

/** The whole wall shelf: books, tapes, Catan and the game boxes (measured off background.png). */
const SHELF: StageRect = { x: 28, y: 88, w: 580, h: 200 }
/** The desk speakers' art and the iPod beside them. */
const MUSIC: StageRect = { x: 146, y: 292, w: 435, h: 218 }

/**
 * What each step spotlights, padded a little. The first and last steps have
 * no target: the card sits over the whole room. The cat moves between visits,
 * so its rect comes from where it sleeps today.
 */
export function tourTarget(id: TourStepId, cat: CatSpot): StageRect | null {
  const pad = (r: StageRect, p = 8): StageRect => ({ x: r.x - p, y: r.y - p, w: r.w + p * 2, h: r.h + p * 2 })
  switch (id) {
    case 'computer': return pad(obj('monitor'))
    case 'shelf': return pad(SHELF)
    case 'window': return pad(WINDOW_GLASS)
    case 'bedside': return pad(SIDE_TABLE_RECT)
    case 'cat': return pad({ x: cat.x, y: cat.y, ...CAT_SIZE })
    case 'music': return pad(MUSIC)
    default: return null
  }
}

/** Horizontal centre of a step's target, for panning a phone's view to it. */
export function tourFocusX(id: TourStepId, cat: CatSpot): number | null {
  const r = tourTarget(id, cat)
  return r ? r.x + r.w / 2 : null
}
