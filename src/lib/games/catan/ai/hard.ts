import { COSTS, RESOURCES } from '../constants'
import { applyAction } from '../engine'
import { hasResources, legalCities, legalRoads, legalSettlements, maritimeRate, totalCards } from '../helpers'
import { deficitToBuild, positionValue, robberHurtsBot, targetBuild, vertexValue, wouldGainLargestArmy } from './evaluate'
import { bestDevCardPlay, bestMaritimeTrade, chooseMainNormal, scoreRoad, surplusMaritimeTrade, winningAction } from './build'
import type { Action, GameState, PlayerId } from '../types'

/**
 * Hard main phase: Normal's evaluation plus a one-ply lookahead over a capped
 * candidate list. The Normal choice is the baseline, so Hard is never weaker
 * than Normal; a candidate replaces it only when the resulting position scores
 * clearly better.
 */
export function chooseMainHard(state: GameState, bot: PlayerId): Action {
  const win = winningAction(state, bot)
  if (win) return win

  const baseline = chooseMainNormal(state, bot)
  const candidates = hardCandidates(state, bot).filter((candidate) => comparable(baseline.type, candidate.type))
  if (candidates.length === 0) return baseline

  const currentValue = positionValue(state, bot)
  let best = baseline
  let bestDelta = actionDelta(state, bot, baseline, currentValue)

  for (const candidate of candidates) {
    if (sameAction(candidate, best)) continue
    const delta = actionDelta(state, bot, candidate, currentValue)
    if (delta > bestDelta + 0.05) {
      best = candidate
      bestDelta = delta
    }
  }
  return best
}

/**
 * Which lookahead candidates may replace Normal's choice. Structural moves are
 * trusted except that Hard may still pick a better spot of the same kind.
 */
function comparable(baseline: Action['type'], candidate: Action['type']): boolean {
  if (baseline === 'buildCity') return candidate === 'buildCity'
  if (baseline === 'buildSettlement') return candidate === 'buildSettlement'
  switch (baseline) {
    case 'playKnight':
    case 'playRoadBuilding':
    case 'playYearOfPlenty':
    case 'playMonopoly':
    case 'proposeTrade':
      return false
    default:
      return true
  }
}

function actionDelta(state: GameState, bot: PlayerId, action: Action, currentValue: number): number {
  try {
    return positionValue(applyAction(state, action), bot) - currentValue
  } catch {
    return Number.NEGATIVE_INFINITY
  }
}

function sameAction(a: Action, b: Action): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function hardCandidates(state: GameState, bot: PlayerId): Action[] {
  const hand = state.players[bot].resources
  const actions: Action[] = []

  if (hasResources(hand, COSTS.city)) {
    for (const vertex of legalCities(state, bot)) actions.push({ type: 'buildCity', vertex })
  }

  if (hasResources(hand, COSTS.settlement)) {
    const legal = legalSettlements(state, bot)
    const scored = legal
      .map((vertex) => ({ vertex, score: vertexValue(state, vertex, bot, { diversity: true }, hand) }))
      .sort((a, b) => b.score - a.score)
    for (const { vertex } of scored.slice(0, 5)) actions.push({ type: 'buildSettlement', vertex })
  }

  if (hasResources(hand, COSTS.road)) {
    const legal = legalRoads(state, bot)
    const scored = legal
      .map((edge) => ({ edge, score: scoreRoad(state, bot, edge).total }))
      .sort((a, b) => b.score - a.score)
    for (const { edge } of scored.slice(0, 6)) actions.push({ type: 'buildRoad', edge })
  }

  if (!state.devCardPlayedThisTurn) {
    const cards = state.players[bot].devCards
    if (cards.includes('knight') && (robberHurtsBot(state, bot) || wouldGainLargestArmy(state, bot))) {
      actions.push({ type: 'playKnight' })
    }
    if (cards.includes('roadBuilding') && legalRoads(state, bot).length > 0) {
      actions.push({ type: 'playRoadBuilding' })
    }
  }
  const card = bestDevCardPlay(state, bot)
  if (card) actions.push(card)

  if (state.devDeck.length > 0 && hasResources(hand, COSTS.devCard)) actions.push({ type: 'buyDevCard' })

  const maritime = bestMaritimeTrade(state, bot)
  if (maritime) actions.push(maritime)

  for (const trade of needMaritimeTrades(state, bot)) actions.push(trade)

  if (totalCards(hand) > 7) {
    const shed = surplusMaritimeTrade(state, bot)
    if (shed) actions.push(shed)
  }

  return actions
}

/** Bank trades that reduce the target-build deficit without spending resources it still needs. */
function needMaritimeTrades(state: GameState, bot: PlayerId): Action[] {
  const hand = state.players[bot].resources
  const target = targetBuild(state, bot)
  const deficit = deficitToBuild(hand, target.cost)
  if (deficit === 0) return []
  const out: Array<{ action: Action; deficit: number; rate: number }> = []
  for (const give of RESOURCES) {
    const rate = maritimeRate(state, bot, give)
    if (hand[give] < rate) continue
    if (hand[give] - rate < target.cost[give]) continue
    for (const get of RESOURCES) {
      if (get === give || state.bank[get] === 0) continue
      const after = { ...hand }
      after[give] -= rate
      after[get] += 1
      const afterDeficit = deficitToBuild(after, target.cost)
      if (afterDeficit < deficit) {
        out.push({ action: { type: 'maritimeTrade', give, get }, deficit: afterDeficit, rate })
      }
    }
  }
  out.sort((a, b) => a.deficit - b.deficit || a.rate - b.rate)
  return out.slice(0, 3).map((entry) => entry.action)
}
