import { applyAction } from '../engine'
import { EDGES, VERTICES } from '../geometry'
import { legalSetupRoads, legalSetupSettlements, satisfiesDistanceRule } from '../helpers'
import { playerProduction, positionValue, vertexValue } from './evaluate'
import type { Action, GameState, PlayerId, ResourceCounts } from '../types'

export function chooseSetupSettlement(state: GameState, bot: PlayerId): Action {
  const legal = legalSetupSettlements(state)
  const round = state.phase.kind === 'setup' ? state.phase.round : 1
  const current = playerProduction(state, bot)
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

export function chooseSetupRoad(state: GameState, bot: PlayerId): Action {
  const legal = legalSetupRoads(state)
  const current = playerProduction(state, bot)
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

export function chooseSetupSettlementHard(state: GameState, bot: PlayerId): Action {
  const legal = legalSetupSettlements(state)
  let best = legal[0]
  let bestScore = Number.NEGATIVE_INFINITY
  for (const vertex of legal) {
    const next = applyAction(state, { type: 'placeSetupSettlement', vertex })
    const score = positionValue(next, bot)
    if (score > bestScore) {
      best = vertex
      bestScore = score
    }
  }
  return { type: 'placeSetupSettlement', vertex: best }
}

export function chooseSetupRoadHard(state: GameState, bot: PlayerId): Action {
  const legal = legalSetupRoads(state)
  let best = legal[0]
  let bestScore = Number.NEGATIVE_INFINITY
  for (const edge of legal) {
    const next = applyAction(state, { type: 'placeSetupRoad', edge })
    const score = positionValue(next, bot)
    if (score > bestScore) {
      best = edge
      bestScore = score
    }
  }
  return { type: 'placeSetupRoad', edge: best }
}
