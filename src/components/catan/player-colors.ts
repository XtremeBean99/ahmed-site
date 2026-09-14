import type { PlayerColor } from '@/lib/games/catan/types'

/** CSS hex colours matching the board sprite tint key. */
export const PLAYER_HEX: Record<PlayerColor, string> = {
  red: '#c0392b',
  blue: '#2e6fb7',
  white: '#e8e0d0',
  orange: '#e07b2a',
}
