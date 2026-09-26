/** Shared pixel sizes for the three Catan game layouts. */

export const TOP_BAR_HEIGHT = 40
export const TOP_BAR_STACK_HEIGHT = 44
export const OPPONENT_STRIP_HEIGHT = 48
export const OPPONENT_STRIP_STACK_HEIGHT = 52
export const HAND_STRIP_HEIGHT = 84
export const STACK_ACTION_BAR_HEIGHT = 56
export const LOG_DRAWER_WIDTH = 320

/** Wide layout column widths: larger on 1360 px and up, tighter below. */
export function wideColumnWidths(viewportWidth: number): { left: number; right: number } {
  return viewportWidth >= 1360 ? { left: 260, right: 300 } : { left: 230, right: 270 }
}

/** The board region width remaining after the side columns, clamped to a sane minimum. */
export function boardRegionWidth(viewportWidth: number): number {
  const { left, right } = wideColumnWidths(viewportWidth)
  return Math.max(320, viewportWidth - left - right)
}
