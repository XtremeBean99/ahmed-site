import { COSTS, MIN_LARGEST_ARMY, MIN_LONGEST_ROAD, RESOURCES, VP_TO_WIN, pips } from './constants'
import { validateAction } from './engine'
import { EDGES, HEXES, VERTICES } from './geometry'
import {
  emptyResources,
  hasResources,
  legalCities,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  maritimeRate,
  robberVictims,
  satisfiesDistanceRule,
  totalCards,
  victoryPoints,
} from './helpers'
import { longestRoadFor } from './longest-road'
import type { Action, GameState, PlayerId, Resource, ResourceCounts } from './types'

/** How much less a blocked hex is worth when scoring a vertex. */
const ROBBER_HEX_WEIGHT = 0.35
/** Bonus added per resource the candidate vertex produces that the bot currently lacks. */
const DIVERSITY_BONUS = 1.6
/** Cap on maritime trades a bot may make in a single turn. */
const MAX_MARITIME_TRADES = 3
/** Value of a road that gains (or keeps a threatened) Longest Road, in vertex-score units. */
const LR_GAIN_BONUS = 3
const LR_KEEP_BONUS = 2

type BuildKind = 'city' | 'settlement' | 'road' | 'devCard'

// --- Stage weighting -------------------------------------------------------

function isEarlyGame(state: GameState): boolean {
  return state.turn <= 4
}

function resourceWeight(state: GameState, r: Resource): number {
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

// --- Production and vertex scoring -----------------------------------------

function vertexProduction(state: GameState, vertex: number): ResourceCounts {
  const prod = emptyResources()
  for (const hex of VERTICES[vertex].hexes) {
    const tile = state.tiles[hex]
    if (tile.terrain === 'desert' || tile.number === null) continue
    prod[tile.terrain] += pips(tile.number) * (hex === state.robber ? ROBBER_HEX_WEIGHT : 1)
  }
  return prod
}

function botProduction(state: GameState, bot: PlayerId): ResourceCounts {
  const prod = emptyResources()
  for (let v = 0; v < VERTICES.length; v++) {
    const building = state.buildings[v]
    if (building?.owner !== bot) continue
    for (const hex of VERTICES[v].hexes) {
      const tile = state.tiles[hex]
      if (tile.terrain === 'desert' || tile.number === null) continue
      prod[tile.terrain] += pips(tile.number) * (hex === state.robber ? ROBBER_HEX_WEIGHT : 1)
    }
  }
  return prod
}

function harbourBonus(state: GameState, vertex: number, prod: ResourceCounts): number {
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

function vertexValue(
  state: GameState,
  vertex: number,
  bot: PlayerId,
  opts: VertexScoreOptions,
  current: ResourceCounts | null = null,
): number {
  const prod = vertexProduction(state, vertex)
  let score = 0
  for (const r of RESOURCES) score += prod[r] * resourceWeight(state, r)
  if (opts.diversity) {
    const existing = current ?? botProduction(state, bot)
    for (const r of RESOURCES) {
      if (existing[r] < 1 && prod[r] > 0) score += DIVERSITY_BONUS
    }
  }
  score += harbourBonus(state, vertex, prod)
  return score
}

// --- Setup -----------------------------------------------------------------

function chooseSetupSettlement(state: GameState, bot: PlayerId): Action {
  const legal = legalSetupSettlements(state)
  const round = state.phase.kind === 'setup' ? state.phase.round : 1
  const current = botProduction(state, bot)
  let best = legal[0]
  let bestScore = vertexValue(state, best, bot, { diversity: round === 2 }, current)
  for (let i = 1; i < legal.length; i++) {
    const vertex = legal[i]
    const score = vertexValue(state, vertex, bot, { diversity: round === 2 }, current)
    if (score > bestScore || (score === bestScore && vertex < best)) {
      best = vertex
      bestScore = score
    }
  }
  return { type: 'placeSetupSettlement', vertex: best }
}

function setupRoadScore(state: GameState, bot: PlayerId, edge: number, current: ResourceCounts): number {
  if (state.phase.kind !== 'setup' || state.phase.lastSettlement === null) return 0
  const last = state.phase.lastSettlement
  const [a, b] = EDGES[edge].vertices
  const far = a === last ? b : a
  const round = state.phase.round
  const candidates = VERTICES[far].neighbors.filter((v) => v !== last && satisfiesDistanceRule(state, v))
  const pool = candidates.length > 0 ? candidates : VERTICES[far].neighbors.filter((v) => v !== last)
  let best = 0
  for (const vertex of pool) {
    const score = vertexValue(state, vertex, bot, { diversity: round === 2 }, current)
    if (score > best) best = score
  }
  return best
}

function chooseSetupRoad(state: GameState, bot: PlayerId): Action {
  const legal = legalSetupRoads(state)
  const current = botProduction(state, bot)
  let best = legal[0]
  let bestScore = setupRoadScore(state, bot, best, current)
  for (let i = 1; i < legal.length; i++) {
    const edge = legal[i]
    const score = setupRoadScore(state, bot, edge, current)
    if (score > bestScore || (score === bestScore && edge < best)) {
      best = edge
      bestScore = score
    }
  }
  return { type: 'placeSetupRoad', edge: best }
}

// --- preRoll ---------------------------------------------------------------

function robberHurtsBot(state: GameState, bot: PlayerId): boolean {
  const tile = state.tiles[state.robber]
  if (tile.terrain === 'desert') return false
  return HEXES[state.robber].vertices.some((v) => state.buildings[v]?.owner === bot)
}

function largestArmyHolderAfter(state: GameState, bot: PlayerId, extraKnight: boolean): PlayerId | null {
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

function wouldGainLargestArmy(state: GameState, bot: PlayerId): boolean {
  return state.largestArmyHolder !== bot && largestArmyHolderAfter(state, bot, true) === bot
}

function choosePreRoll(state: GameState, bot: PlayerId): Action {
  const player = state.players[bot]
  if (!state.devCardPlayedThisTurn && player.devCards.includes('knight')) {
    const winsByArmy = wouldGainLargestArmy(state, bot) && victoryPoints(state, bot) + 2 >= VP_TO_WIN
    if (robberHurtsBot(state, bot) || winsByArmy) return { type: 'playKnight' }
  }
  return { type: 'rollDice' }
}

// --- Discard ---------------------------------------------------------------

function currentTarget(state: GameState, bot: PlayerId): { kind: BuildKind; cost: ResourceCounts } {
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

function keepAmounts(state: GameState, bot: PlayerId): ResourceCounts {
  const cost = currentTarget(state, bot).cost
  const hand = state.players[bot].resources
  const keep = emptyResources()
  for (const r of RESOURCES) keep[r] = Math.min(hand[r], cost[r])
  return keep
}

function pickDiscardResource(hand: ResourceCounts, keep: ResourceCounts, discards: ResourceCounts): Resource {
  let pick: Resource | null = null
  let pickSurplus = Number.NEGATIVE_INFINITY
  let pickHand = Number.NEGATIVE_INFINITY
  for (const r of RESOURCES) {
    const surplus = hand[r] - keep[r] - discards[r]
    if (surplus <= 0) continue
    if (surplus > pickSurplus || (surplus === pickSurplus && hand[r] > pickHand)) {
      pick = r
      pickSurplus = surplus
      pickHand = hand[r]
    }
  }
  if (pick !== null) return pick
  // All surpluses are exhausted; fall back to the largest remaining pile.
  for (const r of RESOURCES) {
    const available = hand[r] - discards[r]
    if (available <= 0) continue
    if (pick === null || available > hand[pick] - discards[pick]) pick = r
  }
  if (pick === null) throw new Error('cannot discard enough cards')
  return pick
}

function chooseDiscard(state: GameState, bot: PlayerId): Action {
  const owed = state.phase.kind === 'discard' ? state.phase.discards[bot] : 0
  if (owed <= 0) throw new Error('no discard owed')
  const hand = state.players[bot].resources
  const keep = keepAmounts(state, bot)
  const discards = emptyResources()
  for (let remaining = owed; remaining > 0; remaining--) {
    const r = pickDiscardResource(hand, keep, discards)
    discards[r] += 1
  }
  return { type: 'discard', player: bot, resources: discards }
}

// --- Robber ----------------------------------------------------------------

function publicVp(state: GameState, player: PlayerId): number {
  return victoryPoints(state, player, false)
}

function robberHexScore(state: GameState, bot: PlayerId, hex: number): number {
  const tile = state.tiles[hex]
  const pipCount = pips(tile.number)
  let score = 0
  for (const v of HEXES[hex].vertices) {
    const building = state.buildings[v]
    if (!building || building.owner === bot) continue
    score += pipCount * (1 + publicVp(state, building.owner))
  }
  score += robberVictims(state, hex, bot).length * 3
  return score
}

function chooseMoveRobber(state: GameState, bot: PlayerId): Action {
  const candidates = HEXES.map((h) => h.id).filter((hex) => hex !== state.robber)
  const avoidsOwn = candidates.filter(
    (hex) => !HEXES[hex].vertices.some((v) => state.buildings[v]?.owner === bot),
  )
  const pool = avoidsOwn.length > 0 ? avoidsOwn : candidates
  let best = pool[0]
  let bestScore = robberHexScore(state, bot, best)
  for (let i = 1; i < pool.length; i++) {
    const hex = pool[i]
    const score = robberHexScore(state, bot, hex)
    if (score > bestScore || (score === bestScore && hex < best)) {
      best = hex
      bestScore = score
    }
  }
  return { type: 'moveRobber', hex: best }
}

function chooseSteal(state: GameState): Action {
  const candidates = state.phase.kind === 'steal' ? state.phase.candidates : []
  if (candidates.length === 0) throw new Error('no steal candidates')
  let best = candidates[0]
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]
    const cVp = publicVp(state, c)
    const bestVp = publicVp(state, best)
    const cCards = totalCards(state.players[c].resources)
    const bestCards = totalCards(state.players[best].resources)
    if (cVp > bestVp || (cVp === bestVp && cCards > bestCards) || (cVp === bestVp && cCards === bestCards && c < best)) {
      best = c
    }
  }
  return { type: 'steal', victim: best }
}

// --- Main-phase builds ------------------------------------------------------

function bestCity(state: GameState, bot: PlayerId): Action | null {
  if (!hasResources(state.players[bot].resources, COSTS.city)) return null
  const legal = legalCities(state, bot)
  if (legal.length === 0) return null
  const current = botProduction(state, bot)
  let best = legal[0]
  let bestScore = vertexValue(state, best, bot, { diversity: false }, current)
  for (let i = 1; i < legal.length; i++) {
    const vertex = legal[i]
    const score = vertexValue(state, vertex, bot, { diversity: false }, current)
    if (score > bestScore || (score === bestScore && vertex < best)) {
      best = vertex
      bestScore = score
    }
  }
  return { type: 'buildCity', vertex: best }
}

function bestSettlement(state: GameState, bot: PlayerId): Action | null {
  if (!hasResources(state.players[bot].resources, COSTS.settlement)) return null
  const legal = legalSettlements(state, bot)
  if (legal.length === 0) return null
  const current = botProduction(state, bot)
  let best = legal[0]
  let bestScore = vertexValue(state, best, bot, { diversity: true }, current)
  for (let i = 1; i < legal.length; i++) {
    const vertex = legal[i]
    const score = vertexValue(state, vertex, bot, { diversity: true }, current)
    if (score > bestScore || (score === bestScore && vertex < best)) {
      best = vertex
      bestScore = score
    }
  }
  return { type: 'buildSettlement', vertex: best }
}

function roadSpotScore(state: GameState, bot: PlayerId, edge: number, current: ResourceCounts): number {
  const [a, b] = EDGES[edge].vertices
  const candidates = new Set<number>([a, b])
  for (const v of [a, b]) for (const n of VERTICES[v].neighbors) candidates.add(n)
  let best = 0
  for (const vertex of candidates) {
    if (!satisfiesDistanceRule(state, vertex)) continue
    const score = vertexValue(state, vertex, bot, { diversity: true }, current)
    if (score > best) best = score
  }
  return best
}

function roadLrBonus(state: GameState, bot: PlayerId, edge: number): number {
  const roads = state.roads.slice()
  roads[edge] = bot
  const sim = { ...state, roads }
  const lr = longestRoadFor(sim, bot)
  if (lr < MIN_LONGEST_ROAD) return 0
  const maxOpponent = state.players.reduce((max, p) => (p.id === bot ? max : Math.max(max, p.longestRoad)), 0)
  if (state.longestRoadHolder !== bot) return lr > maxOpponent ? LR_GAIN_BONUS : 0
  if (lr < maxOpponent) return 0
  const before = state.players[bot].longestRoad
  return before === maxOpponent ? LR_KEEP_BONUS : 0
}

interface RoadScore {
  spot: number
  lr: number
  total: number
}

function scoreRoad(state: GameState, bot: PlayerId, edge: number, current: ResourceCounts): RoadScore {
  const spot = roadSpotScore(state, bot, edge, current)
  const lr = roadLrBonus(state, bot, edge)
  return { spot, lr, total: spot + lr * 2 }
}

function bestRoadAction(state: GameState, bot: PlayerId): Action | null {
  const legal = legalRoads(state, bot)
  if (legal.length === 0) return null
  const current = botProduction(state, bot)
  let bestEdge = -1
  let bestScore = Number.NEGATIVE_INFINITY
  for (const edge of legal) {
    const score = scoreRoad(state, bot, edge, current)
    if (score.total <= 0) continue
    if (score.total > bestScore || (score.total === bestScore && edge < bestEdge)) {
      bestEdge = edge
      bestScore = score.total
    }
  }
  return bestEdge === -1 ? null : { type: 'buildRoad', edge: bestEdge }
}

function shouldBuildRoad(state: GameState, bot: PlayerId): boolean {
  if (state.players[bot].roadsLeft === 0) return false
  if (!hasResources(state.players[bot].resources, COSTS.road)) return false
  if (legalSettlements(state, bot).length === 0) return true
  const hand = state.players[bot].resources
  return hand.brick >= 2 && hand.lumber >= 2
}

function canBuyDevCard(state: GameState, bot: PlayerId): boolean {
  return state.devDeck.length > 0 && hasResources(state.players[bot].resources, COSTS.devCard)
}

// --- Winning moves ----------------------------------------------------------

function roadWouldGainLongestRoad(state: GameState, bot: PlayerId, edge: number): boolean {
  if (state.longestRoadHolder === bot) return false
  const roads = state.roads.slice()
  roads[edge] = bot
  const sim = { ...state, roads }
  const lr = longestRoadFor(sim, bot)
  if (lr < MIN_LONGEST_ROAD) return false
  const maxOpponent = state.players.reduce((max, p) => (p.id === bot ? max : Math.max(max, p.longestRoad)), 0)
  return lr > maxOpponent
}

function bestWinningRoad(state: GameState, bot: PlayerId): Action | null {
  const legal = legalRoads(state, bot)
  const current = botProduction(state, bot)
  let bestEdge = -1
  let bestScore = Number.NEGATIVE_INFINITY
  for (const edge of legal) {
    if (!roadWouldGainLongestRoad(state, bot, edge)) continue
    const score = scoreRoad(state, bot, edge, current)
    if (score.total > bestScore || (score.total === bestScore && edge < bestEdge)) {
      bestEdge = edge
      bestScore = score.total
    }
  }
  return bestEdge === -1 ? null : { type: 'buildRoad', edge: bestEdge }
}

function winningAction(state: GameState, bot: PlayerId): Action | null {
  if (state.phase.kind !== 'main') return null
  const vp = victoryPoints(state, bot)
  if (vp + 1 >= VP_TO_WIN) {
    const city = bestCity(state, bot)
    if (city) return city
    const settlement = bestSettlement(state, bot)
    if (settlement) return settlement
  }
  if (vp + 2 >= VP_TO_WIN) {
    if (hasResources(state.players[bot].resources, COSTS.road) && state.players[bot].roadsLeft > 0) {
      const road = bestWinningRoad(state, bot)
      if (road) return road
    }
    if (
      !state.devCardPlayedThisTurn &&
      state.players[bot].devCards.includes('knight') &&
      wouldGainLargestArmy(state, bot)
    ) {
      return { type: 'playKnight' }
    }
  }
  return null
}

// --- Development cards in main ----------------------------------------------

function buildKindLegal(state: GameState, bot: PlayerId, kind: BuildKind): boolean {
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

function yearOfPlentyForBuild(state: GameState, bot: PlayerId, kind: BuildKind): [Resource, Resource] | null {
  const cost = COSTS[kind]
  const hand = state.players[bot].resources
  const needed: Resource[] = []
  let deficit = 0
  for (const r of RESOURCES) {
    const d = Math.max(0, cost[r] - hand[r])
    deficit += d
    for (let i = 0; i < d; i++) needed.push(r)
  }
  if (deficit === 0 || deficit > 2) return null
  while (needed.length < 2) {
    const extra = RESOURCES.find((r) => state.bank[r] > 0 && r !== needed[0]) ?? needed[0]
    needed.push(extra)
  }
  const pair: [Resource, Resource] = [needed[0], needed[1]]
  const bankOk =
    pair[0] === pair[1]
      ? state.bank[pair[0]] >= 2
      : state.bank[pair[0]] >= 1 && state.bank[pair[1]] >= 1
  return bankOk ? pair : null
}

function bestYearOfPlenty(state: GameState, bot: PlayerId): [Resource, Resource] | null {
  for (const kind of ['city', 'settlement'] as const) {
    if (!buildKindLegal(state, bot, kind)) continue
    const pair = yearOfPlentyForBuild(state, bot, kind)
    if (pair) return pair
  }
  return null
}

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
function estimatePlayerHold(state: GameState, player: PlayerId, resource: Resource): number {
  const total = totalCards(state.players[player].resources)
  if (total === 0) return 0
  let weightTotal = 0
  for (const r of RESOURCES) weightTotal += opponentProductionWeight(state, player, r)
  const ownWeight = opponentProductionWeight(state, player, resource)
  const base = weightTotal > 0 ? (total * ownWeight) / weightTotal : total / RESOURCES.length
  return clampEstimate(base + publicResourceDelta(state, player, resource), total)
}

function opponentsHold(state: GameState, bot: PlayerId, resource: Resource): number {
  let total = 0
  for (let p = 0; p < state.players.length; p++) {
    if (p !== bot) total += estimatePlayerHold(state, p, resource)
  }
  return Math.round(total)
}

function monopolyForBuild(state: GameState, bot: PlayerId, kind: BuildKind): Resource | null {
  const cost = COSTS[kind]
  const hand = state.players[bot].resources
  let best: Resource | null = null
  let bestHeld = 0
  for (const r of RESOURCES) {
    const deficit = Math.max(0, cost[r] - hand[r])
    if (deficit === 0) continue
    const held = opponentsHold(state, bot, r)
    if (held === 0 || hand[r] + held < cost[r]) continue
    if (held > bestHeld) {
      bestHeld = held
      best = r
    }
  }
  return best
}

function bestMonopolyResource(state: GameState, bot: PlayerId): Resource | null {
  for (const kind of ['city', 'settlement'] as const) {
    if (!buildKindLegal(state, bot, kind)) continue
    const r = monopolyForBuild(state, bot, kind)
    if (r) return r
  }
  return null
}

function bestDevCardPlay(state: GameState, bot: PlayerId): Action | null {
  if (state.devCardPlayedThisTurn) return null
  const hand = state.players[bot].devCards
  if (hand.includes('knight') && robberHurtsBot(state, bot)) return { type: 'playKnight' }
  if (hand.includes('roadBuilding') && bestRoadAction(state, bot) !== null) return { type: 'playRoadBuilding' }
  if (hand.includes('yearOfPlenty')) {
    const pair = bestYearOfPlenty(state, bot)
    if (pair) return { type: 'playYearOfPlenty', resources: pair }
  }
  if (hand.includes('monopoly')) {
    const resource = bestMonopolyResource(state, bot)
    if (resource) return { type: 'playMonopoly', resource }
  }
  return null
}

// --- Maritime trade ---------------------------------------------------------

function maritimeTradesThisTurn(state: GameState, bot: PlayerId): number {
  let count = 0
  for (const event of state.events) {
    if (event.type === 'maritimeTrade' && event.player === bot && event.turn === state.turn) count++
  }
  return count
}

function tradeForBuild(state: GameState, bot: PlayerId, kind: BuildKind): Action | null {
  const cost = COSTS[kind]
  const hand = state.players[bot].resources
  for (const give of RESOURCES) {
    const rate = maritimeRate(state, bot, give)
    if (hand[give] < rate) continue
    for (const get of RESOURCES) {
      if (get === give) continue
      if (state.bank[get] === 0) continue
      const after = { ...hand }
      after[give] -= rate
      after[get] += 1
      if (hasResources(after, cost)) return { type: 'maritimeTrade', give, get }
    }
  }
  return null
}

function bestMaritimeTrade(state: GameState, bot: PlayerId): Action | null {
  if (maritimeTradesThisTurn(state, bot) >= MAX_MARITIME_TRADES) return null
  const hand = state.players[bot].resources
  for (const kind of ['city', 'settlement', 'road', 'devCard'] as const) {
    if (!buildKindLegal(state, bot, kind)) continue
    if (hasResources(hand, COSTS[kind])) continue
    const trade = tradeForBuild(state, bot, kind)
    if (!trade) continue
    if (trade.type !== 'maritimeTrade') continue
    // A road trade must leave the bot with a road it will actually build next.
    if (kind === 'road') {
      const after = { ...hand }
      after[trade.give] -= maritimeRate(state, bot, trade.give)
      after[trade.get] += 1
      const simulated = {
        ...state,
        players: state.players.map((p, i) => (i === bot ? { ...p, resources: after } : p)),
      }
      if (bestRoadAction(simulated, bot) === null) continue
    }
    return trade
  }
  return null
}

// --- Main -------------------------------------------------------------------

function chooseMainAction(state: GameState, bot: PlayerId): Action {
  const win = winningAction(state, bot)
  if (win) return win

  const city = bestCity(state, bot)
  if (city) return city

  const settlement = bestSettlement(state, bot)
  if (settlement) return settlement

  if (shouldBuildRoad(state, bot)) {
    const road = bestRoadAction(state, bot)
    if (road) return road
  }

  if (canBuyDevCard(state, bot)) return { type: 'buyDevCard' }

  const card = bestDevCardPlay(state, bot)
  if (card) return card

  const trade = bestMaritimeTrade(state, bot)
  if (trade) return trade

  return { type: 'endTurn' }
}

// --- roadBuilding -----------------------------------------------------------

function chooseRoadBuildingAction(state: GameState, bot: PlayerId): Action {
  const road = bestRoadAction(state, bot)
  if (road) return road
  const legal = legalRoads(state, bot)
  if (legal.length === 0) throw new Error('no legal road')
  return { type: 'buildRoad', edge: legal[0] }
}

// --- Phase dispatch and fallbacks --------------------------------------------

function chooseByPhase(state: GameState, bot: PlayerId): Action {
  switch (state.phase.kind) {
    case 'setup':
      return state.phase.step === 'settlement'
        ? chooseSetupSettlement(state, bot)
        : chooseSetupRoad(state, bot)
    case 'preRoll':
      return choosePreRoll(state, bot)
    case 'discard':
      return chooseDiscard(state, bot)
    case 'moveRobber':
      return chooseMoveRobber(state, bot)
    case 'steal':
      return chooseSteal(state)
    case 'main':
      return chooseMainAction(state, bot)
    case 'roadBuilding':
      return chooseRoadBuildingAction(state, bot)
    case 'gameOver':
      throw new Error('no action when the game is over')
  }
}

function firstNCards(hand: ResourceCounts, count: number): ResourceCounts {
  const out = emptyResources()
  let remaining = count
  for (const r of RESOURCES) {
    const take = Math.min(hand[r], remaining)
    out[r] = take
    remaining -= take
    if (remaining === 0) break
  }
  return out
}

function fallbackAction(state: GameState, bot: PlayerId): Action {
  switch (state.phase.kind) {
    case 'setup': {
      if (state.phase.step === 'settlement') {
        const legal = legalSetupSettlements(state)
        if (legal.length === 0) throw new Error('no legal setup settlement')
        return { type: 'placeSetupSettlement', vertex: legal[0] }
      }
      const legal = legalSetupRoads(state)
      if (legal.length === 0) throw new Error('no legal setup road')
      return { type: 'placeSetupRoad', edge: legal[0] }
    }
    case 'preRoll':
      return { type: 'rollDice' }
    case 'discard': {
      const owed = state.phase.discards[bot]
      if (owed <= 0) throw new Error('no discard owed')
      return { type: 'discard', player: bot, resources: firstNCards(state.players[bot].resources, owed) }
    }
    case 'moveRobber': {
      const hex = HEXES.findIndex((_, h) => h !== state.robber)
      return { type: 'moveRobber', hex }
    }
    case 'steal': {
      const victim = state.phase.candidates[0]
      return { type: 'steal', victim }
    }
    case 'main':
      return { type: 'endTurn' }
    case 'roadBuilding': {
      const legal = legalRoads(state, bot)
      if (legal.length === 0) throw new Error('no legal road')
      return { type: 'buildRoad', edge: legal[0] }
    }
    case 'gameOver':
      throw new Error('no action when the game is over')
  }
}

function safeChoose(state: GameState, bot: PlayerId): Action {
  try {
    return chooseByPhase(state, bot)
  } catch {
    return fallbackAction(state, bot)
  }
}

/**
 * The bot's next action. Only called when playersToAct(state) includes `bot`.
 * Pure and deterministic: the input state is never mutated.
 */
export function chooseBotAction(state: GameState, bot: PlayerId): Action {
  const action = safeChoose(state, bot)
  if (validateAction(state, action) === null) return action
  const fallback = fallbackAction(state, bot)
  if (validateAction(state, fallback) === null) return fallback
  throw new Error('no legal fallback action')
}

// --- Domestic trade acceptance ------------------------------------------------

function deficitToBuild(hand: ResourceCounts, cost: ResourceCounts): number {
  let deficit = 0
  for (const r of RESOURCES) deficit += Math.max(0, cost[r] - hand[r])
  return deficit
}

function canCompleteBuilding(state: GameState, player: PlayerId, receive: ResourceCounts, give: ResourceCounts): boolean {
  const hand = state.players[player].resources
  const after = emptyResources()
  for (const r of RESOURCES) after[r] = hand[r] - give[r] + receive[r]
  return (
    (hasResources(after, COSTS.settlement) && legalSettlements(state, player).length > 0) ||
    (hasResources(after, COSTS.city) && legalCities(state, player).length > 0)
  )
}

function givesOnlySurplus(hand: ResourceCounts, cost: ResourceCounts, give: ResourceCounts): boolean {
  for (const r of RESOURCES) {
    if (give[r] > 0 && hand[r] - give[r] < cost[r]) return false
  }
  return true
}

function receivesLackingResource(hand: ResourceCounts, receive: ResourceCounts): boolean {
  return RESOURCES.some((r) => receive[r] > 0 && hand[r] === 0)
}

/**
 * Whether `bot` accepts a trade in which it RECEIVES `offer.give` from
 * `offer.from` and GIVES `offer.get`.
 */
export function botAcceptsTrade(
  state: GameState,
  bot: PlayerId,
  offer: { from: PlayerId; give: ResourceCounts; get: ResourceCounts },
): boolean {
  const proposer = offer.from
  const proposerPublicVp = publicVp(state, proposer)
  if (proposerPublicVp >= 8) return false

  const give = offer.give // bot receives
  const get = offer.get // bot gives
  const hand = state.players[bot].resources

  if (totalCards(give) === 0 || totalCards(get) === 0) return false
  if (RESOURCES.some((r) => give[r] > 0 && get[r] > 0)) return false
  if (!hasResources(hand, get)) return false
  if (totalCards(get) - totalCards(give) > 1) return false

  // Refuse to help a near-leader finish a settlement or city.
  if (proposerPublicVp + 1 >= 8 && canCompleteBuilding(state, proposer, get, give)) return false

  const target = currentTarget(state, bot)
  const before = deficitToBuild(hand, target.cost)
  const afterHand = emptyResources()
  for (const r of RESOURCES) afterHand[r] = hand[r] - get[r] + give[r]
  const after = deficitToBuild(afterHand, target.cost)

  if (after < before) return true
  if (after === before && givesOnlySurplus(hand, target.cost, get) && receivesLackingResource(hand, give)) return true
  return false
}
