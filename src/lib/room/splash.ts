/**
 * Timing for the Xtreme Bean splash (XtremeSplash.tsx). The sheet holds the 28 hand-drawn
 * frames (scripts/extract-xtreme.mjs, which can also generate in-betweens; TWEENS there
 * is 0), so keyframe k (1-based) is frame k - 1.
 *
 * A visitor sees the whole animation on their first visit and again once a day; in
 * between, a short cut that starts on the white logo (keyframe 24) and plays its fade into
 * colour.
 */
export const SPLASH_TOTAL_FRAMES = 28
export const SPLASH_FRAME_MS = 120
export const SPLASH_FULL_EVERY_MS = 24 * 60 * 60 * 1000
/** The first frame is held at least this long, and longer while the room is still loading, up to the cap. */
export const SPLASH_READY_CAP_MS = 4000

export interface SplashPlan {
  kind: 'full' | 'short'
  startFrame: number
  firstHoldMs: number
  lastHoldMs: number
}

const FULL: SplashPlan = { kind: 'full', startFrame: 0, firstHoldMs: 1500, lastHoldMs: 1500 }
const SHORT: SplashPlan = { kind: 'short', startFrame: 24 - 1, firstHoldMs: 250, lastHoldMs: 800 }

/** `lastFullAt` is when the visitor last saw the whole animation (ms epoch, 0 = never). */
export function splashPlan(lastFullAt: number, now: number): SplashPlan {
  const since = now - lastFullAt
  // A clock set back (since < 0) or a garbage value counts as "long ago".
  return lastFullAt > 0 && since >= 0 && since < SPLASH_FULL_EVERY_MS ? SHORT : FULL
}
