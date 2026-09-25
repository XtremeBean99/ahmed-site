import { RESOURCES } from '../constants'
import { validateAction } from '../engine'
import { emptyResources, legalRoads, legalRobberHexes, legalSetupRoads, legalSetupSettlements } from '../helpers'
import { chooseMainEasy, chooseMainNormal, choosePreRoll, chooseRoadBuildingAction } from './build'
import { chooseMainHard } from './hard'
import { levelOf } from './levels'
import { chooseDiscard, chooseMoveRobber, chooseSteal } from './robber'
import { chooseSetupRoad, chooseSetupRoadHard, chooseSetupSettlement, chooseSetupSettlementHard } from './setup'
import { chooseTradePhase } from './trade'
import type { Action, BotLevel, GameState, PlayerId, ResourceCounts } from '../types'

function chooseByPhase(state: GameState, bot: PlayerId, level: BotLevel): Action {
  switch (state.phase.kind) {
    case 'setup':
      if (state.phase.step === 'settlement') {
        return level === 'hard' ? chooseSetupSettlementHard(state, bot) : chooseSetupSettlement(state, bot)
      }
      return level === 'hard' ? chooseSetupRoadHard(state, bot) : chooseSetupRoad(state, bot)
    case 'preRoll':
      return choosePreRoll(state, bot, level)
    case 'discard':
      return chooseDiscard(state, bot)
    case 'moveRobber':
      return chooseMoveRobber(state, bot, level)
    case 'steal':
      return chooseSteal(state)
    case 'main':
      return level === 'hard'
        ? chooseMainHard(state, bot)
        : level === 'easy'
          ? chooseMainEasy(state, bot)
          : chooseMainNormal(state, bot)
    case 'roadBuilding':
      return chooseRoadBuildingAction(state, bot)
    case 'trade':
      return chooseTradePhase(state, bot, level)
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

export function fallbackAction(state: GameState, bot: PlayerId): Action {
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
      const legal = legalRobberHexes(state)
      if (legal.length === 0) throw new Error('no legal robber hex')
      return { type: 'moveRobber', hex: legal[0] }
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
    case 'trade': {
      const { offer } = state.phase
      if (offer.from === bot) return { type: 'cancelTrade' }
      if (offer.replies[bot] === 'pending') return { type: 'respondTrade', player: bot, reply: 'decline' }
      throw new Error('bot already answered the trade offer')
    }
    case 'gameOver':
      throw new Error('no action when the game is over')
  }
}

function safeChoose(state: GameState, bot: PlayerId, level: BotLevel): Action {
  try {
    return chooseByPhase(state, bot, level)
  } catch {
    return fallbackAction(state, bot)
  }
}

/**
 * The bot's next action. Only called when playersToAct(state) includes `bot`.
 * Pure and deterministic: the input state is never mutated and state.rng is
 * never advanced. `opts.level` overrides the stored player level (hints use 'hard').
 */
export function chooseBotAction(state: GameState, bot: PlayerId, opts?: { level?: BotLevel }): Action {
  const level = levelOf(state, bot, opts)
  const action = safeChoose(state, bot, level)
  if (validateAction(state, action) === null) return action
  const fallback = fallbackAction(state, bot)
  if (validateAction(state, fallback) === null) return fallback
  throw new Error('no legal fallback action')
}

export { botAcceptsTrade } from './trade'
