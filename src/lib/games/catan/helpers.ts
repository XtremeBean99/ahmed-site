import { MAX_EVENTS, RESOURCES } from './constants'
import { EDGES, HEXES, VERTICES } from './geometry'
import type { GameEventInput, GameState, PlayerId, PortType, Resource, ResourceCounts } from './types'

// --- Resource arithmetic ---

export function emptyResources(): ResourceCounts {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }
}

export function totalCards(counts: ResourceCounts): number {
  return RESOURCES.reduce((sum, r) => sum + counts[r], 0)
}

export function hasResources(have: ResourceCounts, cost: ResourceCounts): boolean {
  return RESOURCES.every((r) => have[r] >= cost[r])
}

export function addResources(target: ResourceCounts, delta: ResourceCounts): void {
  for (const r of RESOURCES) target[r] += delta[r]
}

export function subtractResources(target: ResourceCounts, delta: ResourceCounts): void {
  for (const r of RESOURCES) target[r] -= delta[r]
}

/** Shape check for resource payloads arriving from the UI or a saved game. */
export function isResourceCounts(value: unknown): value is ResourceCounts {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    Object.keys(v).every((k) => (RESOURCES as readonly string[]).includes(k)) &&
    RESOURCES.every((r) => Number.isInteger(v[r]) && (v[r] as number) >= 0)
  )
}

export function isResource(value: unknown): value is Resource {
  return typeof value === 'string' && (RESOURCES as readonly string[]).includes(value)
}

/** Player pays the bank. Caller has checked affordability. */
export function payToBank(state: GameState, player: PlayerId, cost: ResourceCounts): void {
  subtractResources(state.players[player].resources, cost)
  addResources(state.bank, cost)
}

/** Bank pays the player. Caller has checked the bank can cover it. */
export function payFromBank(state: GameState, player: PlayerId, amount: ResourceCounts): void {
  subtractResources(state.bank, amount)
  addResources(state.players[player].resources, amount)
}

// --- Id guards ---

export const isVertexId = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < VERTICES.length
export const isEdgeId = (e: unknown): e is number => Number.isInteger(e) && (e as number) >= 0 && (e as number) < EDGES.length
export const isHexId = (h: unknown): h is number => Number.isInteger(h) && (h as number) >= 0 && (h as number) < HEXES.length
export const isPlayerId = (state: GameState, p: unknown): p is PlayerId =>
  Number.isInteger(p) && (p as number) >= 0 && (p as number) < state.players.length

// --- Placement legality (board rules only: no phase, piece or resource checks unless stated) ---

/** Empty vertex whose neighbours are all empty (the distance rule). */
export function satisfiesDistanceRule(state: GameState, vertex: number): boolean {
  return state.buildings[vertex] === null && VERTICES[vertex].neighbors.every((n) => state.buildings[n] === null)
}

/** A normal (non-setup) settlement spot: distance rule plus one of the player's roads touching it. */
export function canPlaceSettlement(state: GameState, player: PlayerId, vertex: number): boolean {
  return (
    satisfiesDistanceRule(state, vertex) && VERTICES[vertex].edges.some((e) => state.roads[e] === player)
  )
}

/**
 * A normal (non-setup) road spot: empty edge with an endpoint that holds the player's building, or
 * that the player's road reaches without an opposing building on it.
 */
export function canPlaceRoad(state: GameState, player: PlayerId, edge: number): boolean {
  if (state.roads[edge] !== null) return false
  return EDGES[edge].vertices.some((v) => {
    const b = state.buildings[v]
    if (b) return b.owner === player
    return VERTICES[v].edges.some((e) => e !== edge && state.roads[e] === player)
  })
}

export function legalSetupSettlements(state: GameState): number[] {
  return VERTICES.filter((v) => satisfiesDistanceRule(state, v.id)).map((v) => v.id)
}

/** Empty edges touching the settlement placed in this setup step. */
export function legalSetupRoads(state: GameState): number[] {
  if (state.phase.kind !== 'setup' || state.phase.lastSettlement === null) return []
  return VERTICES[state.phase.lastSettlement].edges.filter((e) => state.roads[e] === null)
}

/** Includes the piece-limit check. */
export function legalRoads(state: GameState, player: PlayerId): number[] {
  if (state.players[player].roadsLeft === 0) return []
  return EDGES.filter((e) => canPlaceRoad(state, player, e.id)).map((e) => e.id)
}

/** Includes the piece-limit check. */
export function legalSettlements(state: GameState, player: PlayerId): number[] {
  if (state.players[player].settlementsLeft === 0) return []
  return VERTICES.filter((v) => canPlaceSettlement(state, player, v.id)).map((v) => v.id)
}

/** Includes the piece-limit check. */
export function legalCities(state: GameState, player: PlayerId): number[] {
  if (state.players[player].citiesLeft === 0) return []
  return VERTICES.filter((v) => {
    const b = state.buildings[v.id]
    return b !== null && b.owner === player && b.kind === 'settlement'
  }).map((v) => v.id)
}

// --- Harbours and the robber ---

export function playerPortTypes(state: GameState, player: PlayerId): Set<PortType> {
  const types = new Set<PortType>()
  for (const port of state.ports) {
    if (EDGES[port.edge].vertices.some((v) => state.buildings[v]?.owner === player)) types.add(port.type)
  }
  return types
}

/** How many of `resource` the player gives the bank for one card. */
export function maritimeRate(state: GameState, player: PlayerId, resource: Resource): 2 | 3 | 4 {
  const types = playerPortTypes(state, player)
  if (types.has(resource)) return 2
  if (types.has('any')) return 3
  return 4
}

/** Opponents of `player` with a building on `hex` and at least one resource card. */
export function robberVictims(state: GameState, hex: number, player: PlayerId): PlayerId[] {
  const owners = new Set<PlayerId>()
  for (const v of HEXES[hex].vertices) {
    const b = state.buildings[v]
    if (b && b.owner !== player && totalCards(state.players[b.owner].resources) > 0) owners.add(b.owner)
  }
  return [...owners].sort((a, b) => a - b)
}

// --- Scoring and turn order ---

/** Victory points; `includeHidden` counts unrevealed victoryPoint cards (true for win checks). */
export function victoryPoints(state: GameState, player: PlayerId, includeHidden = true): number {
  let vp = 0
  for (const b of state.buildings) {
    if (b?.owner === player) vp += b.kind === 'city' ? 2 : 1
  }
  if (state.longestRoadHolder === player) vp += 2
  if (state.largestArmyHolder === player) vp += 2
  if (includeHidden) {
    const p = state.players[player]
    vp += [...p.devCards, ...p.newDevCards].filter((c) => c === 'victoryPoint').length
  }
  return vp
}

/** Seat order for a setup round: forward in round 1, reversed in round 2. */
export function setupOrder(playerCount: number, round: 1 | 2): PlayerId[] {
  const order = Array.from({ length: playerCount }, (_, i) => i)
  return round === 1 ? order : order.reverse()
}

export function pushEvent(state: GameState, event: GameEventInput): void {
  state.eventSeq += 1
  state.events.push({ ...event, seq: state.eventSeq, turn: state.turn })
  if (state.events.length > MAX_EVENTS) state.events.splice(0, state.events.length - MAX_EVENTS)
}
