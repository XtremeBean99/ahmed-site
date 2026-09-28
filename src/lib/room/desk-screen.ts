/** The desk monitor glass, in CSS px before the stage scale. */
export const SCREEN_W = 536
export const SCREEN_H = 308
/** The portrait phone screen: a fixed logical width, a height from the phone. */
export const PORTRAIT_W = 320
export const PORTRAIT_MIN_H = 440
/** Portrait shell chrome in CSS px. */
export const BEZEL = { side: 10, top: 12, chin: 26 } as const
export const MUSIC_BAR_H = 56

/** A portrait viewport where the landscape screen would render below 0.9x. */
export function isPortraitPhone(vw: number, vh: number, mobile: boolean): boolean {
  if (!mobile || vh <= vw) return false
  return Math.min((vw - 12) / SCREEN_W, (vh - 12) / SCREEN_H) < 0.9
}

export interface PortraitGeometry {
  /** CSS px per logical px. */
  scale: number
  /** Logical screen size. */
  w: number
  h: number
  /** Top-left of the scaled screen inside the shell, CSS px. */
  left: number
  top: number
}

/** The 320-wide logical screen inside the bezel and above the music bar, in a box with the safe areas removed. */
export function portraitGeometry(availW: number, availH: number): PortraitGeometry {
  const maxW = Math.max(1, availW - 2 * BEZEL.side)
  const maxH = Math.max(1, availH - BEZEL.top - BEZEL.chin - MUSIC_BAR_H)
  let scale = maxW / PORTRAIT_W
  let h = Math.floor(maxH / scale)
  if (h < PORTRAIT_MIN_H) {
    scale = Math.min(scale, maxH / PORTRAIT_MIN_H)
    h = PORTRAIT_MIN_H
  }
  return { scale, w: PORTRAIT_W, h, left: Math.round((availW - PORTRAIT_W * scale) / 2), top: BEZEL.top }
}
