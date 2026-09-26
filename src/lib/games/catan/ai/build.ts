import { COSTS, MIN_LONGEST_ROAD, RESOURCES } from '../constants'
import { EDGES, VERTICES } from '../geometry'
import { hasResources, legalCities, legalRoads, legalSettlements, maritimeRate, totalCards, victoryPoints } from '../helpers'
import { longestRoadFor } from '../longest-road'
import {
  buildKindLegal,
  isEarlyGame,
  opponentsHold,
  resourceWeight,
  roadDistance,
  roadLrBonus,
  robberHurtsBot,
  targetBuild,
  vertexValue,
  wouldGainLargestArmy,
} from './evaluate'
import { botRandom, pickWeighted } from './levels'
import { proposeTradeAction } from './trade'
import type { Action, BotLevel, GameState, PlayerId, Resource, ResourceCounts } from '../types'

const MAX_MARITIME_TRADES = 3

function maritimeTradesThisTurn(state: GameState, bot: PlayerId): number {
  let count = 0
  for (const event of state.events) {
    if (event.type === 'maritimeTrade' && event.player === bot && event.turn === state.turn) count++
  }
  return count
}

// --- Direct builds ------------------------------------------------------------

export function bestCity(state: GameState, bot: PlayerId): Action | null {
  if (!hasResources(state.players[bot].resources, COSTS.city)) return null
  const legal = legalCities(state, bot)
  if (legal.length === 0) return null
  const current = state.players[bot].resources
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

export function bestSettlement(state: GameState, bot: PlayerId): Action | null {
  if (!hasResources(state.players[bot].resources, COSTS.settlement)) return null
  const legal = legalSettlements(state, bot)
  if (legal.length === 0) return null
  const current = state.players[bot].resources
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

// --- Road planning -------------------------------------------------------------

/**
 * Settlement spots reachable within `maxRoads` new roads of `edge`, with the
 * number of new roads each spot needs. The bot's existing network counts as
 * distance 0, and paths never pass through an opposing building.
 */
function reachableSpots(state: GameState, bot: PlayerId, edge: number, maxRoads: number): Map<number, number> {
  const [a, b] = EDGES[edge].vertices
  const visited = new Set<number>()
  const queue: Array<{ v: number; d: number }> = []
  const start = new Set<number>([a, b])
  for (let v = 0; v < VERTICES.length; v++) {
    if (state.buildings[v]?.owner === bot || VERTICES[v].edges.some((e) => state.roads[e] === bot)) start.add(v)
  }
  for (const v of start) {
    visited.add(v)
    queue.push({ v, d: 0 })
  }
  for (let head = 0; head < queue.length; head++) {
    const { v, d } = queue[head]
    if (d >= maxRoads) continue
    for (const e of VERTICES[v].edges) {
      if (state.roads[e] !== null) continue
      const [x, y] = EDGES[e].vertices
      const next = x === v ? y : x
      const building = state.buildings[next]
      if (building !== null && building.owner !== bot) continue
      if (visited.has(next)) continue
      visited.add(next)
      queue.push({ v: next, d: d + 1 })
    }
  }
  const spots = new Map<number, number>()
  for (const { v, d } of queue) {
    if (state.buildings[v] === null && VERTICES[v].neighbors.every((n) => state.buildings[n] === null)) {
      spots.set(v, d)
    }
  }
  return spots
}

function roadSpotScore(state: GameState, bot: PlayerId, edge: number, current: ResourceCounts): number {
  const spots = reachableSpots(state, bot, edge, 3)
  let best = 0
  for (const [vertex, distance] of spots) {
    let score = vertexValue(state, vertex, bot, { diversity: true }, current)
    for (let p = 0; p < state.players.length; p++) {
      if (p === bot) continue
      const opponentDistance = roadDistance(state, p, vertex)
      if (opponentDistance >= 0 && opponentDistance < distance) {
        score *= 0.65
        break
      }
    }
    if (score > best) best = score
  }
  return best
}

export function scoreRoad(state: GameState, bot: PlayerId, edge: number): { spot: number; lr: number; total: number } {
  const spot = roadSpotScore(state, bot, edge, state.players[bot].resources)
  const lr = roadLrBonus(state, bot, edge)
  return { spot, lr, total: spot + lr * 2 }
}

export function bestRoadAction(state: GameState, bot: PlayerId): Action | null {
  const legal = legalRoads(state, bot)
  if (legal.length === 0) return null
  let bestEdge = -1
  let bestScore = Number.NEGATIVE_INFINITY
  for (const edge of legal) {
    const score = scoreRoad(state, bot, edge)
    if (score.total <= 0) continue
    if (score.total > bestScore || (score.total === bestScore && edge < bestEdge)) {
      bestEdge = edge
      bestScore = score.total
    }
  }
  return bestEdge === -1 ? null : { type: 'buildRoad', edge: bestEdge }
}

export function shouldBuildRoad(state: GameState, bot: PlayerId): boolean {
  if (state.players[bot].roadsLeft === 0) return false
  if (!hasResources(state.players[bot].resources, COSTS.road)) return false
  if (legalSettlements(state, bot).length === 0) return true
  const hand = state.players[bot].resources
  if (hand.brick >= 2 && hand.lumber >= 2) return true
  const target = targetBuild(state, bot)
  if (target.kind === 'settlement') {
    const surplus = hand.brick - target.cost.brick >= 1 && hand.lumber - target.cost.lumber >= 1
    if (!surplus) return false
  }
  return false
}

// --- Winning moves -------------------------------------------------------------

function bestWinningRoad(state: GameState, bot: PlayerId): Action | null {
  const legal = legalRoads(state, bot)
  let bestEdge = -1
  let bestScore = Number.NEGATIVE_INFINITY
  for (const edge of legal) {
    if (!roadWouldGainLongestRoad(state, bot, edge)) continue
    const score = scoreRoad(state, bot, edge)
    if (score.total > bestScore || (score.total === bestScore && edge < bestEdge)) {
      bestEdge = edge
      bestScore = score.total
    }
  }
  return bestEdge === -1 ? null : { type: 'buildRoad', edge: bestEdge }
}

function roadWouldGainLongestRoad(state: GameState, bot: PlayerId, edge: number): boolean {
  if (state.longestRoadHolder === bot) return false
  const roads = state.roads.slice()
  roads[edge] = bot
  const lr = longestRoadFor({ ...state, roads }, bot)
  if (lr < MIN_LONGEST_ROAD) return false
  const maxOpponent = state.players.reduce((max, p) => (p.id === bot ? max : Math.max(max, p.longestRoad)), 0)
  return lr > maxOpponent
}

export function winningAction(state: GameState, bot: PlayerId): Action | null {
  if (state.phase.kind !== 'main') return null
  const vp = victoryPoints(state, bot)
  if (vp + 1 >= state.settings.vpToWin) {
    const city = bestCity(state, bot)
    if (city) return city
    const settlement = bestSettlement(state, bot)
    if (settlement) return settlement
  }
  if (vp + 2 >= state.settings.vpToWin) {
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

// --- Development cards -----------------------------------------------------------

function yearOfPlentyForBuild(state: GameState, bot: PlayerId, kind: 'city' | 'settlement'): [Resource, Resource] | null {
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

function monopolyForBuild(state: GameState, bot: PlayerId, kind: 'city' | 'settlement'): Resource | null {
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

export function bestDevCardPlay(state: GameState, bot: PlayerId): Action | null {
  if (state.devCardPlayedThisTurn) return null
  const hand = state.players[bot].devCards
  if (hand.includes('knight') && robberHurtsBot(state, bot)) return { type: 'playKnight' }
  if (hand.includes('roadBuilding') && legalRoads(state, bot).length > 0) {
    const road = bestRoadAction(state, bot)
    if (road) return { type: 'playRoadBuilding' }
  }
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

// --- Maritime trades --------------------------------------------------------------

function tradeForBuild(state: GameState, bot: PlayerId, kind: 'city' | 'settlement' | 'road' | 'devCard'): Action | null {
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

export function bestMaritimeTrade(state: GameState, bot: PlayerId): Action | null {
  if (maritimeTradesThisTurn(state, bot) >= MAX_MARITIME_TRADES) return null
  const hand = state.players[bot].resources
  for (const kind of ['city', 'settlement', 'road', 'devCard'] as const) {
    if (!buildKindLegal(state, bot, kind)) continue
    if (hasResources(hand, COSTS[kind])) continue
    const trade = tradeForBuild(state, bot, kind)
    if (!trade || trade.type !== 'maritimeTrade') continue
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

/** A bank trade that sheds surplus when the bot risks a discard. */
export function surplusMaritimeTrade(state: GameState, bot: PlayerId): Action | null {
  if (maritimeTradesThisTurn(state, bot) >= MAX_MARITIME_TRADES) return null
  const hand = state.players[bot].resources
  const target = targetBuild(state, bot)
  let give: Resource | null = null
  let giveSurplus = Number.NEGATIVE_INFINITY
  for (const r of RESOURCES) {
    const rate = maritimeRate(state, bot, r)
    if (hand[r] < rate) continue
    const surplus = hand[r] - target.cost[r]
    if (surplus > giveSurplus) {
      giveSurplus = surplus
      give = r
    }
  }
  if (give === null) return null
  let get: Resource | null = null
  let getWeight = Number.NEGATIVE_INFINITY
  for (const r of RESOURCES) {
    if (r === give || state.bank[r] === 0) continue
    let weight = resourceWeight(state, r)
    const deficit = Math.max(0, target.cost[r] - hand[r])
    if (deficit > 0) weight += 2 + deficit
    if (weight > getWeight) {
      getWeight = weight
      get = r
    }
  }
  if (get === null) return null
  return { type: 'maritimeTrade', give, get }
}

// --- preRoll / roadBuilding --------------------------------------------------------

export function choosePreRoll(state: GameState, bot: PlayerId, level: BotLevel): Action {
  if (level === 'easy') return { type: 'rollDice' }
  const player = state.players[bot]
  if (!state.devCardPlayedThisTurn && player.devCards.includes('knight')) {
    const winsByArmy = wouldGainLargestArmy(state, bot) && victoryPoints(state, bot) + 2 >= state.settings.vpToWin
    if (robberHurtsBot(state, bot) || winsByArmy) return { type: 'playKnight' }
  }
  return { type: 'rollDice' }
}

export function chooseRoadBuildingAction(state: GameState, bot: PlayerId): Action {
  const road = bestRoadAction(state, bot)
  if (road) return road
  const legal = legalRoads(state, bot)
  if (legal.length === 0) throw new Error('no legal road')
  return { type: 'buildRoad', edge: legal[0] }
}

// --- Main phase ----------------------------------------------------------------------

export function chooseMainNormal(state: GameState, bot: PlayerId): Action {
  const win = winningAction(state, bot)
  if (win) return win

  const city = bestCity(state, bot)
  if (city) return city

  const settlement = bestSettlement(state, bot)
  if (settlement) return settlement

  const card = bestDevCardPlay(state, bot)
  if (card) return card

  if (shouldBuildRoad(state, bot)) {
    const road = bestRoadAction(state, bot)
    if (road) return road
  }

  if (canBuyDevCard(state, bot) && targetBuild(state, bot).kind === 'devCard') {
    return { type: 'buyDevCard' }
  }

  const proposal = proposeTradeAction(state, bot, 'normal')
  if (proposal) return proposal

  const trade = bestMaritimeTrade(state, bot)
  if (trade) return trade

  if (canBuyDevCard(state, bot) && (!isEarlyGame(state) || totalCards(state.players[bot].resources) > 7)) {
    return { type: 'buyDevCard' }
  }

  if (totalCards(state.players[bot].resources) > 7) {
    const shed = surplusMaritimeTrade(state, bot)
    if (shed) return shed
  }

  return { type: 'endTurn' }
}

function canBuyDevCard(state: GameState, bot: PlayerId): boolean {
  return state.devDeck.length > 0 && hasResources(state.players[bot].resources, COSTS.devCard)
}

function easyYearOfPlentyAction(state: GameState, bot: PlayerId): Action | null {
  if (state.devCardPlayedThisTurn || !state.players[bot].devCards.includes('yearOfPlenty')) return null
  const pair = bestYearOfPlenty(state, bot)
  if (pair) return { type: 'playYearOfPlenty', resources: pair }
  const hand = state.players[bot].resources
  const cost = targetBuild(state, bot).cost
  const ranked = RESOURCES.slice().sort((a, b) => {
    const needA = Math.max(0, cost[a] - hand[a]) + resourceWeight(state, a)
    const needB = Math.max(0, cost[b] - hand[b]) + resourceWeight(state, b)
    return needB - needA
  })
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i; j < ranked.length; j++) {
      if (i === j && state.bank[ranked[i]] < 2) continue
      if (i !== j && (state.bank[ranked[i]] < 1 || state.bank[ranked[j]] < 1)) continue
      return { type: 'playYearOfPlenty', resources: [ranked[i], ranked[j]] }
    }
  }
  return null
}

function easyMonopolyAction(state: GameState, bot: PlayerId): Action | null {
  if (state.devCardPlayedThisTurn || !state.players[bot].devCards.includes('monopoly')) return null
  const resource = bestMonopolyResource(state, bot) ?? RESOURCES.find((r) => opponentsHold(state, bot, r) > 0) ?? 'brick'
  return { type: 'playMonopoly', resource }
}

export function chooseMainEasy(state: GameState, bot: PlayerId): Action {
  const win = winningAction(state, bot)
  if (win) return win

  const rand = botRandom(state, bot)
  const candidates: Array<{ action: Action; score: number }> = []
  const push = (action: Action | null, score: number) => {
    if (action) candidates.push({ action, score })
  }

  if (!state.devCardPlayedThisTurn) {
    const cards = state.players[bot].devCards
    if (cards.includes('knight')) push({ type: 'playKnight' }, 30)
    if (cards.includes('roadBuilding') && legalRoads(state, bot).length > 0) push({ type: 'playRoadBuilding' }, 26)
    if (cards.includes('yearOfPlenty')) push(easyYearOfPlentyAction(state, bot), 22)
    if (cards.includes('monopoly')) push(easyMonopolyAction(state, bot), 20)
  }

  push(bestCity(state, bot), 18)
  push(bestSettlement(state, bot), 16)
  push(shouldBuildRoad(state, bot) ? bestRoadAction(state, bot) : null, 8)
  push(proposeTradeAction(state, bot, 'easy'), 6)
  push(bestMaritimeTrade(state, bot), 4)
  if (canBuyDevCard(state, bot)) push({ type: 'buyDevCard' }, 3)
  push({ type: 'endTurn' }, 1)

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates.slice(0, 3)
  const weights = top.length === 3 ? [0.6, 0.3, 0.1] : top.length === 2 ? [0.7, 0.3] : [1]
  return pickWeighted(rand, top.map((c) => c.action), weights)
}
