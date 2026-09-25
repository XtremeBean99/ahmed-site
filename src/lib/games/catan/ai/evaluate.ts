import { COSTS, MIN_LARGEST_ARMY, MIN_LONGEST_ROAD, RESOURCES, pips } from '../constants'
import { EDGES, HEXES, VERTICES } from '../geometry'
import {
  canPlaceRoad,
  canPlaceSettlement,
  emptyResources,
  legalCities,
  legalRoads,
  legalSettlements,
  playerPortTypes,
  satisfiesDistanceRule,
  totalCards,
  victoryPoints,
} from '../helpers'
import { longestRoadFor } from '../longest-road'
import type { GameState, PlayerId, Resource, ResourceCounts } from '../types'

export type BuildKind = 'city' | 'settlement' | 'road' | 'devCard'

/** How much less a blocked hex is worth when scoring a vertex. */
const ROBBER_HEX_WEIGHT = 0.35
/** Bonus added per resource the candidate vertex produces that the bot currently lacks. */
const DIVERSITY_BONUS = 1.6
/** Value of a road that gains (or keeps a threatened) Longest Road, in vertex-score units. */
export const LR_GAIN_BONUS = 3
export const LR_KEEP_BONUS = 2

export function isEarlyGame(state: GameState): boolean {
  return state.turn <= 4
}

export function resourceWeight(state: GameState, r: Resource): number {
  if (isEarlyGame(state)) {
    switch (r) {
      case 'brick':
      case 'lumber':
        return 1.3
      case 'grain':
        return 1.05
      case 'wool':
        return 1.0
      case 'ore':
        return 0.9
    }
  }
  switch (r) {
    case 'ore':
      return 1.35
    case 'grain':
      return 1.3
    case 'wool':
      return 1.2
    case 'brick':
    case 'lumber':
      return 0.85
  }
}

/** Extra value for resources with few tiles on this board (brick and ore have 3, the rest 4). */
function boardScarcity(state: GameState): ResourceCounts {
  const counts = emptyResources()
  for (const tile of state.tiles) {
    if (tile.terrain !== 'desert') counts[tile.terrain] += 1
  }
  const scarcity = emptyResources()
  for (const r of RESOURCES) scarcity[r] = (4 - counts[r]) * 0.45
  return scarcity
}

export function vertexProduction(state: GameState, vertex: number): ResourceCounts {
  const prod = emptyResources()
  for (const hex of VERTICES[vertex].hexes) {
    const tile = state.tiles[hex]
    if (tile.terrain === 'desert' || tile.number === null) continue
    prod[tile.terrain] += pips(tile.number) * (hex === state.robber ? ROBBER_HEX_WEIGHT : 1)
  }
  return prod
}

export function playerProduction(state: GameState, player: PlayerId): ResourceCounts {
  const prod = emptyResources()
  for (let v = 0; v < VERTICES.length; v++) {
    const building = state.buildings[v]
    if (building?.owner !== player) continue
    for (const hex of VERTICES[v].hexes) {
      const tile = state.tiles[hex]
      if (tile.terrain === 'desert' || tile.number === null) continue
      prod[tile.terrain] += pips(tile.number) * (hex === state.robber ? ROBBER_HEX_WEIGHT : 1)
    }
  }
  return prod
}

export function harbourBonus(state: GameState, vertex: number, prod: ResourceCounts): number {
  let bonus = 0
  for (const port of state.ports) {
    if (!EDGES[port.edge].vertices.includes(vertex)) continue
    if (port.type === 'any') bonus += 1.2
    else bonus += prod[port.type] >= 2.5 ? 2.2 : 0.6
  }
  return bonus
}

interface VertexScoreOptions {
  /** Add the diversity bonus for resources the bot lacks in its current production. */
  diversity: boolean
}

export function vertexValue(
  state: GameState,
  vertex: number,
  bot: PlayerId,
  opts: VertexScoreOptions,
  current: ResourceCounts | null = null,
): number {
  const prod = vertexProduction(state, vertex)
  const scarcity = boardScarcity(state)
  let score = 0
  for (const r of RESOURCES) score += prod[r] * (resourceWeight(state, r) + scarcity[r])
  if (opts.diversity) {
    const existing = current ?? playerProduction(state, bot)
    for (const r of RESOURCES) {
      if (existing[r] < 1 && prod[r] > 0) score += DIVERSITY_BONUS
    }
  }
  score += harbourBonus(state, vertex, prod)
  return score
}

export function publicVp(state: GameState, player: PlayerId): number {
  return victoryPoints(state, player, false)
}

/** The build the bot is currently saving for, used for discards and trade acceptance. */
export function targetBuild(state: GameState, bot: PlayerId): { kind: BuildKind; cost: ResourceCounts } {
  if (state.players[bot].citiesLeft > 0 && legalCities(state, bot).length > 0) {
    return { kind: 'city', cost: COSTS.city }
  }
  if (state.players[bot].settlementsLeft > 0 && legalSettlements(state, bot).length > 0) {
    return { kind: 'settlement', cost: COSTS.settlement }
  }
  if (state.players[bot].roadsLeft > 0 && legalRoads(state, bot).length > 0) {
    return { kind: 'road', cost: COSTS.road }
  }
  return { kind: 'devCard', cost: COSTS.devCard }
}

export function buildKindLegal(state: GameState, bot: PlayerId, kind: BuildKind): boolean {
  switch (kind) {
    case 'city':
      return state.players[bot].citiesLeft > 0 && legalCities(state, bot).length > 0
    case 'settlement':
      return state.players[bot].settlementsLeft > 0 && legalSettlements(state, bot).length > 0
    case 'road':
      return state.players[bot].roadsLeft > 0 && legalRoads(state, bot).length > 0
    case 'devCard':
      return state.devDeck.length > 0
  }
}

export function deficitToBuild(hand: ResourceCounts, cost: ResourceCounts): number {
  let deficit = 0
  for (const r of RESOURCES) deficit += Math.max(0, cost[r] - hand[r])
  return deficit
}

export function givesOnlySurplus(hand: ResourceCounts, cost: ResourceCounts, give: ResourceCounts): boolean {
  for (const r of RESOURCES) {
    if (give[r] > 0 && hand[r] - give[r] < cost[r]) return false
  }
  return true
}

export function receivesLackingResource(hand: ResourceCounts, receive: ResourceCounts): boolean {
  return RESOURCES.some((r) => receive[r] > 0 && hand[r] === 0)
}

// --- Public-information estimates ---------------------------------------------

function clampEstimate(value: number, total: number): number {
  return Math.min(Math.max(value, 0), total)
}

/** How often a dice total has been rolled, from the public event log. */
function recentRollCount(state: GameState, number: number): number {
  let count = 0
  for (const event of state.events) {
    if (event.type === 'roll' && event.dice[0] + event.dice[1] === number) count++
  }
  return count
}

/** Production pips of a resource for a player, weighted by observed rolls. */
function opponentProductionWeight(state: GameState, opponent: PlayerId, resource: Resource): number {
  let weight = 0
  for (let v = 0; v < VERTICES.length; v++) {
    const building = state.buildings[v]
    if (building?.owner !== opponent) continue
    for (const hex of VERTICES[v].hexes) {
      const tile = state.tiles[hex]
      if (tile.terrain !== resource || tile.number === null) continue
      weight += pips(tile.number) * (1 + recentRollCount(state, tile.number)) * (hex === state.robber ? ROBBER_HEX_WEIGHT : 1)
    }
  }
  return weight
}

/** Net resource flow for `player` visible in public events. */
function publicResourceDelta(state: GameState, player: PlayerId, resource: Resource): number {
  let delta = 0
  const human = state.players.findIndex((p) => !p.isBot)
  for (const event of state.events) {
    switch (event.type) {
      case 'setupResources':
        if (event.player === player) delta += event.resources[resource]
        break
      case 'produce':
        delta += event.gains[player][resource]
        break
      case 'discard':
        if (event.player === player) delta -= event.resources[resource]
        break
      case 'built':
        if (event.player === player) delta -= COSTS[event.kind][resource]
        break
      case 'boughtDevCard':
        if (event.player === player) delta -= COSTS.devCard[resource]
        break
      case 'maritimeTrade':
        if (event.player === player) {
          if (event.give === resource) delta -= event.giveCount
          if (event.get === resource) delta += 1
        }
        break
      case 'domesticTrade':
        if (event.player === player) {
          delta -= event.give[resource]
          delta += event.get[resource]
        }
        if (event.partner === player) {
          delta += event.give[resource]
          delta -= event.get[resource]
        }
        break
      case 'yearOfPlenty':
        if (event.player === player) {
          for (const r of event.resources) if (r === resource) delta += 1
        }
        break
      case 'monopoly':
        if (event.player === player) {
          if (event.resource === resource) delta += event.taken
        } else if (event.resource === resource) {
          delta -= event.taken / Math.max(1, state.players.length - 1)
        }
        break
      case 'stole':
        if (event.resource !== null && (event.player === human || event.victim === human)) {
          if (event.player === player) delta += 1
          if (event.victim === player) delta -= 1
        }
        break
    }
  }
  return delta
}

/** Public-info estimate of how many of `resource` one opponent holds. */
export function estimatePlayerHold(state: GameState, player: PlayerId, resource: Resource): number {
  const total = totalCards(state.players[player].resources)
  if (total === 0) return 0
  let weightTotal = 0
  for (const r of RESOURCES) weightTotal += opponentProductionWeight(state, player, r)
  const ownWeight = opponentProductionWeight(state, player, resource)
  const base = weightTotal > 0 ? (total * ownWeight) / weightTotal : total / RESOURCES.length
  return clampEstimate(base + publicResourceDelta(state, player, resource), total)
}

export function opponentsHold(state: GameState, bot: PlayerId, resource: Resource): number {
  let total = 0
  for (let p = 0; p < state.players.length; p++) {
    if (p !== bot) total += estimatePlayerHold(state, p, resource)
  }
  return Math.round(total)
}

// --- Roads and awards ---------------------------------------------------------

export function robberHurtsBot(state: GameState, bot: PlayerId): boolean {
  const tile = state.tiles[state.robber]
  if (tile.terrain === 'desert') return false
  return HEXES[state.robber].vertices.some((v) => state.buildings[v]?.owner === bot)
}

/** Roads needed before `player` can settle `vertex`; -1 when unreachable. */
export function roadDistance(state: GameState, player: PlayerId, vertex: number): number {
  if (canPlaceSettlement(state, player, vertex)) return 0
  const dist = new Array<number>(VERTICES.length).fill(-1)
  const queue: number[] = []
  for (let v = 0; v < VERTICES.length; v++) {
    if (state.buildings[v]?.owner === player || VERTICES[v].edges.some((e) => state.roads[e] === player)) {
      dist[v] = 0
      queue.push(v)
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const v = queue[head]
    if (v === vertex) return dist[v]
    for (const edge of VERTICES[v].edges) {
      if (!canPlaceRoad(state, player, edge)) continue
      const [a, b] = EDGES[edge].vertices
      const next = a === v ? b : a
      if (dist[next] >= 0) continue
      dist[next] = dist[v] + 1
      queue.push(next)
    }
  }
  return -1
}

export function largestArmyHolderAfter(state: GameState, bot: PlayerId, extraKnight: boolean): PlayerId | null {
  const holder = state.largestArmyHolder
  let next: PlayerId | null = null
  for (let p = 0; p < state.players.length; p++) {
    const knights = state.players[p].knightsPlayed + (p === bot && extraKnight ? 1 : 0)
    if (knights < MIN_LARGEST_ARMY) continue
    if (holder !== null && p !== holder && knights <= state.players[holder].knightsPlayed) continue
    if (next === null || knights > state.players[next].knightsPlayed) next = p
  }
  return next
}

export function wouldGainLargestArmy(state: GameState, bot: PlayerId): boolean {
  return state.largestArmyHolder !== bot && largestArmyHolderAfter(state, bot, true) === bot
}

export function longestRoadAfterEdge(state: GameState, bot: PlayerId, edge: number): number {
  const roads = state.roads.slice()
  roads[edge] = bot
  return longestRoadFor({ ...state, roads }, bot)
}

export function roadWouldGainLongestRoad(state: GameState, bot: PlayerId, edge: number): boolean {
  if (state.longestRoadHolder === bot) return false
  const lr = longestRoadAfterEdge(state, bot, edge)
  if (lr < MIN_LONGEST_ROAD) return false
  const maxOpponent = state.players.reduce((max, p) => (p.id === bot ? max : Math.max(max, p.longestRoad)), 0)
  return lr > maxOpponent
}

export function roadLrBonus(state: GameState, bot: PlayerId, edge: number): number {
  const lr = longestRoadAfterEdge(state, bot, edge)
  if (lr < MIN_LONGEST_ROAD) return 0
  const maxOpponent = state.players.reduce((max, p) => (p.id === bot ? max : Math.max(max, p.longestRoad)), 0)
  if (state.longestRoadHolder !== bot) return lr > maxOpponent ? LR_GAIN_BONUS : 0
  if (lr < maxOpponent) return 0
  const before = state.players[bot].longestRoad
  return before === maxOpponent ? LR_KEEP_BONUS : 0
}

// --- One-ply value for Hard ----------------------------------------------------

/** Rough value of a position for `bot`, in hand-tuned units. */
export function positionValue(state: GameState, bot: PlayerId): number {
  const player = state.players[bot]
  const hand = player.resources
  const target = targetBuild(state, bot)
  let value = victoryPoints(state, bot) * 12

  const prod = playerProduction(state, bot)
  for (const r of RESOURCES) {
    let weight = resourceWeight(state, r)
    const deficit = Math.max(0, target.cost[r] - hand[r])
    if (deficit > 0) weight += 1.2 + deficit * 0.6
    value += prod[r] * weight
    value += hand[r] * resourceWeight(state, r) * 0.35
  }

  value += playerPortTypes(state, bot).size * 0.5

  if (state.longestRoadHolder === bot) value += 2.5
  else value += Math.min(player.longestRoad, 5) * 0.4

  if (state.largestArmyHolder === bot) value += 2.5
  else value += Math.min(player.knightsPlayed, 3) * 0.5

  value += player.devCards.length * 1.2
  value += player.newDevCards.length * 0.5

  // Access to a good settlement spot is worth holding onto or creating.
  const spots = legalSettlements(state, bot)
  if (spots.length > 0) {
    let bestSpot = 0
    for (const vertex of spots) {
      const spotValue = vertexValue(state, vertex, bot, { diversity: true }, hand)
      if (spotValue > bestSpot) bestSpot = spotValue
    }
    value += bestSpot * 0.4
  }

  const cards = totalCards(hand)
  if (cards > 7) value -= (cards - 7) * 0.35

  const vp = victoryPoints(state, bot)
  if (vp + 1 >= state.settings.vpToWin) value += 30
  else if (vp + 2 >= state.settings.vpToWin) value += 10
  return value
}

/** True when the vertex is a legal settlement spot for the bot (helper for planning). */
export function isReachableSettlementSpot(state: GameState, bot: PlayerId, vertex: number): boolean {
  return (
    state.players[bot].settlementsLeft > 0 &&
    satisfiesDistanceRule(state, vertex) &&
    VERTICES[vertex].edges.some((e) => state.roads[e] === bot)
  )
}
