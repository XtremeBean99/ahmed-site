import type { PlayerColor } from '@/lib/games/catan/types'

/** CSS hex colours matching the board sprite tint key. */
export const PLAYER_HEX: Record<PlayerColor, string> = {
  red: '#c0392b',
  blue: '#2e6fb7',
  white: '#e8e0d0',
  orange: '#e07b2a',
}

/** Lighter variants for player-coloured text on panels (each at least 4.5:1 on COLORS.panel). */
export const PLAYER_TEXT: Record<PlayerColor, string> = {
  red: '#ee7f6e',
  blue: '#7fb0ea',
  white: '#e8e0d0',
  orange: '#ec8a3c',
}
