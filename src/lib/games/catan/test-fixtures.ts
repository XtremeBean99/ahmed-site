/** Deterministic hand-built states for unit tests. Independent of board.ts so modules test in isolation. */
import { BANK_PER_RESOURCE, DEV_DECK_COUNTS, PIECES, PLAYER_COLORS, PORT_TYPES, RESOURCES } from './constants'
import { EDGES, PORT_EDGES } from './geometry'
import { emptyResources } from './helpers'
import type { DevCardType, GameState, Phase, PlayerId, ResourceCounts, Terrain } from './types'

const TERRAINS: Terrain[] = [
  'ore', 'wool', 'lumber',
  'grain', 'brick', 'wool', 'brick',
  'grain', 'lumber', 'desert', 'lumber', 'ore',
  'lumber', 'ore', 'grain', 'wool',
  'brick', 'grain', 'wool',
]
const NUMBERS: (number | null)[] = [
  10, 2, 9,
  12, 6, 4, 10,
  9, 11, null, 3, 8,
  8, 3, 4, 5,
  5, 6, 11,
]
export const FIXTURE_DESERT = 9

export function makeTestState(options: { playerCount?: 3 | 4; phase?: Phase; current?: PlayerId } = {}): GameState {
  const playerCount = options.playerCount ?? 4
  const devDeck: DevCardType[] = []
  for (const [card, count] of Object.entries(DEV_DECK_COUNTS) as [DevCardType, number][]) {
    for (let i = 0; i < count; i++) devDeck.push(card)
  }
  return {
    version: 1,
    rng: 12345,
    tiles: TERRAINS.map((terrain, i) => ({ terrain, number: NUMBERS[i] })),
    ports: PORT_EDGES.map((edge, i) => ({ edge, type: PORT_TYPES[i] })),
    robber: FIXTURE_DESERT,
    buildings: Array(54).fill(null),
    roads: Array(72).fill(null),
    players: Array.from({ length: playerCount }, (_, id) => ({
      id,
      name: id === 0 ? 'You' : `Bot ${id}`,
      color: PLAYER_COLORS[id],
      isBot: id !== 0,
      resources: emptyResources(),
      devCards: [],
      newDevCards: [],
      knightsPlayed: 0,
      roadsLeft: PIECES.roads,
      settlementsLeft: PIECES.settlements,
      citiesLeft: PIECES.cities,
      longestRoad: 0,
    })),
    current: options.current ?? 0,
    phase: options.phase ?? { kind: 'main' },
    bank: Object.fromEntries(RESOURCES.map((r) => [r, BANK_PER_RESOURCE])) as ResourceCounts,
    devDeck,
    devCardPlayedThisTurn: false,
    dice: null,
    longestRoadHolder: null,
    largestArmyHolder: null,
    turn: 1,
    events: [],
    eventSeq: 0,
  }
}

/** Moves cards from the bank to a player. */
export function give(state: GameState, player: PlayerId, cards: Partial<ResourceCounts>): void {
  for (const r of RESOURCES) {
    const n = cards[r] ?? 0
    state.bank[r] -= n
    state.players[player].resources[r] += n
  }
}

export function res(cards: Partial<ResourceCounts>): ResourceCounts {
  return { ...emptyResources(), ...cards }
}

export function putSettlement(state: GameState, player: PlayerId, vertex: number): void {
  state.buildings[vertex] = { owner: player, kind: 'settlement' }
  state.players[player].settlementsLeft -= 1
}

export function putCity(state: GameState, player: PlayerId, vertex: number): void {
  state.buildings[vertex] = { owner: player, kind: 'city' }
  state.players[player].citiesLeft -= 1
}

export function putRoad(state: GameState, player: PlayerId, edge: number): void {
  state.roads[edge] = player
  state.players[player].roadsLeft -= 1
}

/** Places roads along a vertex path, e.g. putRoadPath(s, 0, [3, 4, 9]). */
export function putRoadPath(state: GameState, player: PlayerId, vertices: number[]): void {
  for (let i = 0; i + 1 < vertices.length; i++) {
    const edge = EDGES.findIndex((e) => e.vertices.includes(vertices[i]) && e.vertices.includes(vertices[i + 1]))
    if (edge < 0) throw new Error(`vertices ${vertices[i]} and ${vertices[i + 1]} are not adjacent`)
    putRoad(state, player, edge)
  }
}

/** Sum of each resource across bank and hands; always BANK_PER_RESOURCE in a consistent state. */
export function resourceTotals(state: GameState): ResourceCounts {
  const totals = { ...state.bank }
  for (const p of state.players) for (const r of RESOURCES) totals[r] += p.resources[r]
  return totals
}
