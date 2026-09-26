import type { DevCardType, GameSettings, PlayerColor, PortType, Resource, ResourceCounts, Terrain } from './types'

export const RESOURCES: readonly Resource[] = ['brick', 'lumber', 'wool', 'grain', 'ore']

/** Default target; the game reads state.settings.vpToWin. */
export const VP_TO_WIN = 10
export const MIN_VP_TO_WIN = 8
export const MAX_VP_TO_WIN = 13
/** Public VP at or below which the friendly robber protects a player. */
export const FRIENDLY_ROBBER_MAX_VP = 2
/** Trade proposals the current player may make in one turn. */
export const MAX_OFFERS_PER_TURN = 5

export const DEFAULT_SETTINGS: GameSettings = {
  vpToWin: VP_TO_WIN,
  friendlyRobber: false,
  board: 'balanced',
  botTrades: true,
}
export const MIN_LONGEST_ROAD = 5
export const MIN_LARGEST_ARMY = 3
export const DISCARD_THRESHOLD = 7
export const BANK_PER_RESOURCE = 19
export const MAX_EVENTS = 200

export const PIECES = { roads: 15, settlements: 5, cities: 4 } as const

export const COSTS = {
  road: { brick: 1, lumber: 1, wool: 0, grain: 0, ore: 0 },
  settlement: { brick: 1, lumber: 1, wool: 1, grain: 1, ore: 0 },
  city: { brick: 0, lumber: 0, wool: 0, grain: 2, ore: 3 },
  devCard: { brick: 0, lumber: 0, wool: 1, grain: 1, ore: 1 },
} as const satisfies Record<string, ResourceCounts>

export const TERRAIN_COUNTS: Record<Terrain, number> = {
  lumber: 4,
  wool: 4,
  grain: 4,
  brick: 3,
  ore: 3,
  desert: 1,
}

export const NUMBER_TOKENS: readonly number[] = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]

export const DEV_DECK_COUNTS: Record<DevCardType, number> = {
  knight: 14,
  victoryPoint: 5,
  roadBuilding: 2,
  yearOfPlenty: 2,
  monopoly: 2,
}

export const PORT_TYPES: readonly PortType[] = ['any', 'any', 'any', 'any', 'brick', 'lumber', 'wool', 'grain', 'ore']

export const PLAYER_COLORS: readonly PlayerColor[] = ['red', 'blue', 'white', 'orange']

export const BOT_NAMES: readonly string[] = ['Bram', 'Ilsa', 'Oskar']

/** Dots under a number token: the number of dice combinations that roll it (out of 36). */
export function pips(n: number | null): number {
  return n === null ? 0 : 6 - Math.abs(7 - n)
}
