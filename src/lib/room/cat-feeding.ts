/**
 * Feeding the cat (RoomCat). A click on the bowl fills it; the cat sits up, walks along
 * the bed to its edge, crouches, jumps down, walks to the bowl and eats, then does it all
 * in reverse and curls up where it was. Positions are the cat sprite's top-left in stage
 * px (100x64, paws on its bottom row of art at +60).
 */
export interface Point { x: number; y: number }

/** The bowl on the floor between the side table and the bed (sprite top-left, 52x30). */
export const CAT_BOWL = { x: 800, y: 640, w: 52, h: 30 } as const
/** Crouched at the bowl: its head over the rim, only the muzzle dipping in behind it. */
export const CAT_EAT_AT: Point = { x: CAT_BOWL.x + 6, y: CAT_BOWL.y - 56 }
/** Standing at the left edge of the mattress, ready to jump down. */
export const CAT_BED_EDGE: Point = { x: 862, y: 434 }
/** Where it lands on the floor, beside the bed. */
export const CAT_FLOOR: Point = { x: 840, y: 580 }

export const CAT_EAT_MS = 4800
export const CAT_CHEW_MS = 320
const WAKE_MS = 450
const CROUCH_MS = 280
const LAND_MS = 200
const LEAP_MS = 460
const TURN_MS = 220
const WALK_SPEED = 62 // stage px per second
/** Stage px the cat moves per walking frame, so its paws keep pace with the floor. */
const STRIDE = 7
const WALK_FRAMES = 4

export type CatSprite = 'awake' | 'walk-1' | 'walk-2' | 'walk-3' | 'walk-4' | 'crouch' | 'leap' | 'eat-1' | 'eat-2'

type Segment =
  | { kind: 'hold'; sprite: 'awake' | 'crouch'; at: Point; ms: number; turn?: boolean }
  | { kind: 'walk'; from: Point; to: Point; ms: number }
  | { kind: 'leap'; from: Point; to: Point; ms: number; up: boolean }
  | { kind: 'eat'; at: Point; ms: number }

export interface CatPose {
  at: Point
  sprite: CatSprite
  facingRight: boolean
  /** 2 full, 1 half, 0 empty */
  food: 0 | 1 | 2
  eating: boolean
  done: boolean
}

const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)
const walk = (from: Point, to: Point): Segment => ({ kind: 'walk', from, to, ms: Math.max(1, (dist(from, to) / WALK_SPEED) * 1000) })

/** The whole outing from `spot` on the bed; `reduce` skips the walking and jumping. */
export function feedingTimeline(spot: Point, reduce = false): Segment[] {
  if (reduce) return [{ kind: 'eat', at: CAT_EAT_AT, ms: CAT_EAT_MS }]
  return [
    { kind: 'hold', sprite: 'awake', at: spot, ms: WAKE_MS },
    walk(spot, CAT_BED_EDGE),
    { kind: 'hold', sprite: 'crouch', at: CAT_BED_EDGE, ms: CROUCH_MS },
    { kind: 'leap', from: CAT_BED_EDGE, to: CAT_FLOOR, ms: LEAP_MS, up: false },
    { kind: 'hold', sprite: 'crouch', at: CAT_FLOOR, ms: LAND_MS },
    walk(CAT_FLOOR, CAT_EAT_AT),
    { kind: 'eat', at: CAT_EAT_AT, ms: CAT_EAT_MS },
    // backs out of the bowl and turns round before setting off
    { kind: 'hold', sprite: 'crouch', at: CAT_EAT_AT, ms: TURN_MS, turn: true },
    walk(CAT_EAT_AT, CAT_FLOOR),
    { kind: 'hold', sprite: 'crouch', at: CAT_FLOOR, ms: CROUCH_MS },
    { kind: 'leap', from: CAT_FLOOR, to: CAT_BED_EDGE, ms: LEAP_MS, up: true },
    { kind: 'hold', sprite: 'crouch', at: CAT_BED_EDGE, ms: LAND_MS },
    walk(CAT_BED_EDGE, spot),
  ]
}

export const timelineMs = (segments: Segment[]) => segments.reduce((sum, s) => sum + s.ms, 0)

const snap = (v: number) => Math.round(v / 2) * 2
const lerp = (a: Point, b: Point, t: number): Point => ({ x: snap(a.x + (b.x - a.x) * t), y: snap(a.y + (b.y - a.y) * t) })

/** Where the cat is and how it looks `elapsed` ms into the outing. */
export function feedingPose(segments: Segment[], elapsed: number): CatPose {
  let t0 = 0
  let facingRight = false
  let food: 0 | 1 | 2 = 2
  let walked = 0
  for (const seg of segments) {
    const into = elapsed - t0
    if (seg.kind === 'walk' || seg.kind === 'leap') {
      const dx = seg.to.x - seg.from.x
      if (Math.abs(dx) > 4) facingRight = dx > 0
    }
    if (into < seg.ms) {
      const k = Math.max(0, into / seg.ms)
      if (seg.kind === 'hold') {
        // A turn faces the way the next move goes, from its first moment.
        const next = seg.turn ? segments.slice(segments.indexOf(seg) + 1).find((s) => s.kind === 'walk' || s.kind === 'leap') : undefined
        const facing = next && (next.kind === 'walk' || next.kind === 'leap') ? next.to.x > next.from.x : facingRight
        return { at: seg.at, sprite: seg.sprite, facingRight: facing, food, eating: false, done: false }
      }
      if (seg.kind === 'eat') {
        const left: 0 | 1 | 2 = k < 0.5 ? 2 : 1
        const sprite = Math.floor(into / CAT_CHEW_MS) % 2 ? 'eat-2' : 'eat-1'
        return { at: seg.at, sprite, facingRight: false, food: left, eating: true, done: false }
      }
      if (seg.kind === 'walk') {
        const d = walked + dist(seg.from, seg.to) * k
        const sprite = `walk-${(Math.floor(d / STRIDE) % WALK_FRAMES) + 1}` as CatSprite
        return { at: lerp(seg.from, seg.to, k), sprite, facingRight, food, eating: false, done: false }
      }
      // Leap: a parabola, higher when jumping up onto the bed.
      const p = lerp(seg.from, seg.to, k)
      const lift = (seg.up ? 30 : 14) * 4 * k * (1 - k)
      return { at: { x: p.x, y: snap(p.y - lift) }, sprite: 'leap', facingRight, food, eating: false, done: false }
    }
    if (seg.kind === 'walk') walked += dist(seg.from, seg.to)
    if (seg.kind === 'eat') food = 0
    t0 += seg.ms
  }
  const last = segments[segments.length - 1]
  const end = last.kind === 'walk' || last.kind === 'leap' ? last.to : last.at
  return { at: end, sprite: 'awake', facingRight, food: 0, eating: false, done: true }
}
