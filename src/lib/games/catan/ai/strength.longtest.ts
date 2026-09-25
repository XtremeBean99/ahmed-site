/**
 * Strength harness for the Catan bots. Seat-rotated bots-only games with
 * configurable levels per seat, plus random-legal and greedy baselines.
 * Run through `npm run test:catan:long`, not the default suite.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chooseBotAction, fallbackAction } from './index'
import { COSTS, pips, RESOURCES } from '../constants'
import { applyAction, createGame, playersToAct, validateAction } from '../engine'
import { VERTICES } from '../geometry'
import {
  emptyResources,
  hasResources,
  legalCities,
  legalRoads,
  legalRobberHexes,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  totalCards,
} from '../helpers'
import type { Action, BotLevel, GameState, PlayerId, ResourceCounts } from '../types'

type Provider = (state: GameState, bot: PlayerId) => Action

interface GameResult {
  winner: PlayerId
  finished: boolean
  turns: number
  actions: number
  fallbacks: number
  endTurnsOver7: number
  tradesProposed: number
  tradesAccepted: number
  robberies: number
}

interface SeriesResult {
  label: string
  games: number
  finished: number
  winRate: number
  winRateLow: number
  winRateHigh: number
  meanTurns: number
  meanActions: number
  fallbacksPerGame: number
  endTurnsOver7PerGame: number
  tradesProposedPerGame: number
  tradesAcceptedPerGame: number
  robberiesPerGame: number
}

function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rand: () => number, items: T[]): T {
  return items[Math.floor(rand() * items.length)]
}

function randomDiscard(state: GameState, bot: PlayerId, owed: number, rand: () => number): ResourceCounts {
  const hand = state.players[bot].resources
  const out = emptyResources()
  for (let i = 0; i < owed; i++) {
    const remaining = totalCards(hand) - i
    let index = Math.floor(rand() * remaining)
    for (const r of RESOURCES) {
      const available = hand[r] - out[r]
      if (index < available) {
        out[r] += 1
        break
      }
      index -= available
    }
  }
  return out
}

function randomAction(state: GameState, bot: PlayerId): Action {
  const rand = mulberry32((state.rng ^ Math.imul(state.eventSeq + 1, 0x9e3779b1) ^ Math.imul(bot, 0x85ebca6b)) | 0)
  const phase = state.phase
  switch (phase.kind) {
    case 'setup': {
      if (phase.step === 'settlement') {
        const legal = legalSetupSettlements(state)
        return { type: 'placeSetupSettlement', vertex: pick(rand, legal) }
      }
      const legal = legalSetupRoads(state)
      return { type: 'placeSetupRoad', edge: pick(rand, legal) }
    }
    case 'preRoll':
      return { type: 'rollDice' }
    case 'discard': {
      const owed = phase.discards[bot]
      if (owed <= 0) throw new Error('no discard owed')
      return { type: 'discard', player: bot, resources: randomDiscard(state, bot, owed, rand) }
    }
    case 'moveRobber': {
      const legal = legalRobberHexes(state)
      return { type: 'moveRobber', hex: pick(rand, legal) }
    }
    case 'steal':
      return { type: 'steal', victim: pick(rand, phase.candidates) }
    case 'main': {
      const options: Action[] = []
      const hand = state.players[bot].resources
      if (hasResources(hand, COSTS.city)) for (const v of legalCities(state, bot)) options.push({ type: 'buildCity', vertex: v })
      if (hasResources(hand, COSTS.settlement)) for (const v of legalSettlements(state, bot)) options.push({ type: 'buildSettlement', vertex: v })
      if (hasResources(hand, COSTS.road)) for (const e of legalRoads(state, bot)) options.push({ type: 'buildRoad', edge: e })
      if (state.devDeck.length > 0 && hasResources(hand, COSTS.devCard)) options.push({ type: 'buyDevCard' })
      options.push({ type: 'endTurn' })
      return pick(rand, options)
    }
    case 'roadBuilding': {
      const legal = legalRoads(state, bot)
      if (legal.length === 0) throw new Error('no legal road')
      return { type: 'buildRoad', edge: pick(rand, legal) }
    }
    case 'trade': {
      const { offer } = phase
      if (offer.from === bot) {
        const accepted = offer.to.find((p) => offer.replies[p] === 'accept')
        return accepted !== undefined ? { type: 'confirmTrade', partner: accepted } : { type: 'cancelTrade' }
      }
      if (offer.replies[bot] !== 'pending') throw new Error('bot already answered')
      return { type: 'respondTrade', player: bot, reply: 'decline' }
    }
    case 'gameOver':
      throw new Error('no action when the game is over')
  }
}

function greedySetupVertex(state: GameState): number {
  const legal = legalSetupSettlements(state)
  let best = legal[0]
  let bestScore = Number.NEGATIVE_INFINITY
  for (const vertex of legal) {
    let score = 0
    for (const hex of VERTICES[vertex].hexes) {
      const tile = state.tiles[hex]
      if (tile.terrain !== 'desert' && tile.number !== null && hex !== state.robber) score += pips(tile.number)
    }
    if (score > bestScore) {
      best = vertex
      bestScore = score
    }
  }
  return best
}

function greedyAction(state: GameState, bot: PlayerId): Action {
  const phase = state.phase
  switch (phase.kind) {
    case 'setup': {
      if (phase.step === 'settlement') return { type: 'placeSetupSettlement', vertex: greedySetupVertex(state) }
      const legal = legalSetupRoads(state)
      return { type: 'placeSetupRoad', edge: legal[0] }
    }
    case 'preRoll':
      return { type: 'rollDice' }
    case 'discard': {
      const owed = phase.discards[bot]
      if (owed <= 0) throw new Error('no discard owed')
      const hand = state.players[bot].resources
      const out = emptyResources()
      let remaining = owed
      for (const r of RESOURCES) {
        const take = Math.min(hand[r], remaining)
        out[r] = take
        remaining -= take
        if (remaining === 0) break
      }
      return { type: 'discard', player: bot, resources: out }
    }
    case 'moveRobber': {
      const legal = legalRobberHexes(state)
      return { type: 'moveRobber', hex: legal[0] }
    }
    case 'steal':
      return { type: 'steal', victim: phase.candidates[0] }
    case 'main': {
      const hand = state.players[bot].resources
      if (hasResources(hand, COSTS.city)) {
        const legal = legalCities(state, bot)
        if (legal.length > 0) return { type: 'buildCity', vertex: legal[0] }
      }
      if (hasResources(hand, COSTS.settlement)) {
        const legal = legalSettlements(state, bot)
        if (legal.length > 0) return { type: 'buildSettlement', vertex: legal[0] }
      }
      if (hasResources(hand, COSTS.road)) {
        const legal = legalRoads(state, bot)
        if (legal.length > 0) return { type: 'buildRoad', edge: legal[0] }
      }
      if (state.devDeck.length > 0 && hasResources(hand, COSTS.devCard)) return { type: 'buyDevCard' }
      return { type: 'endTurn' }
    }
    case 'roadBuilding': {
      const legal = legalRoads(state, bot)
      if (legal.length === 0) throw new Error('no legal road')
      return { type: 'buildRoad', edge: legal[0] }
    }
    case 'trade': {
      const { offer } = phase
      if (offer.from === bot) {
        const accepted = offer.to.find((p) => offer.replies[p] === 'accept')
        return accepted !== undefined ? { type: 'confirmTrade', partner: accepted } : { type: 'cancelTrade' }
      }
      if (offer.replies[bot] !== 'pending') throw new Error('bot already answered')
      return { type: 'respondTrade', player: bot, reply: 'decline' }
    }
    case 'gameOver':
      throw new Error('no action when the game is over')
  }
}

function levelProvider(): Provider {
  return (state, bot) => chooseBotAction(state, bot)
}

function playGame(seed: number, playerCount: 3 | 4, providers: Provider[], levels?: BotLevel[]): GameResult {
  let state = createGame({ seed, playerCount })
  if (levels) {
    for (let p = 0; p < playerCount; p++) state.players[p].level = levels[p]
  }
  const result: GameResult = {
    winner: -1,
    finished: false,
    turns: 0,
    actions: 0,
    fallbacks: 0,
    endTurnsOver7: 0,
    tradesProposed: 0,
    tradesAccepted: 0,
    robberies: 0,
  }
  let actions = 0
  try {
    while (state.phase.kind !== 'gameOver' && actions < 3000) {
      const actors = playersToAct(state)
      for (const player of actors) {
        if (state.phase.kind === 'gameOver') break
        const beforeSeq = state.eventSeq
        let action: Action
        try {
          action = providers[player](state, player)
        } catch {
          result.fallbacks += 1
          action = fallbackAction(state, player)
        }
        let reason = validateAction(state, action)
        if (reason !== null) {
          result.fallbacks += 1
          action = fallbackAction(state, player)
          reason = validateAction(state, action)
          if (reason !== null) throw new Error(`fallback illegal: ${reason}`)
        }
        if (action.type === 'endTurn' && totalCards(state.players[player].resources) > 7) {
          result.endTurnsOver7 += 1
        }
        state = applyAction(state, action)
        actions += 1
        for (const event of state.events) {
          if (event.seq <= beforeSeq) continue
          if (event.type === 'tradeProposed') result.tradesProposed += 1
          else if (event.type === 'domesticTrade') result.tradesAccepted += 1
          else if (event.type === 'stole' && event.resource !== null) result.robberies += 1
        }
      }
    }
    if (state.phase.kind === 'gameOver') {
      result.finished = true
      result.winner = state.phase.winner
    }
    result.turns = state.turn
    result.actions = actions
  } catch (error) {
    console.error('game threw', { seed, playerCount, error })
    result.actions = actions
    result.turns = state.turn
  }
  return result
}

function wilsonBounds(success: number, n: number): [number, number] {
  if (n === 0) return [0, 0]
  const z = 1.96
  const p = success / n
  const denom = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / denom
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)]
}

function series(label: string, wins: number, results: GameResult[]): SeriesResult {
  const games = results.length
  const finished = results.filter((r) => r.finished).length
  const sum = (f: (r: GameResult) => number) => results.reduce((acc, r) => acc + f(r), 0)
  const winRate = finished === 0 ? 0 : wins / finished
  const [winRateLow, winRateHigh] = wilsonBounds(wins, finished)
  return {
    label,
    games,
    finished,
    winRate,
    winRateLow,
    winRateHigh,
    meanTurns: games === 0 ? 0 : sum((r) => r.turns) / games,
    meanActions: games === 0 ? 0 : sum((r) => r.actions) / games,
    fallbacksPerGame: games === 0 ? 0 : sum((r) => r.fallbacks) / games,
    endTurnsOver7PerGame: games === 0 ? 0 : sum((r) => r.endTurnsOver7) / games,
    tradesProposedPerGame: games === 0 ? 0 : sum((r) => r.tradesProposed) / games,
    tradesAcceptedPerGame: games === 0 ? 0 : sum((r) => r.tradesAccepted) / games,
    robberiesPerGame: games === 0 ? 0 : sum((r) => r.robberies) / games,
  }
}

/** Seat-rotated games where `special` plays at seat `game % playerCount` against `others`. */
function runSeatRotated(
  games: number,
  playerCount: 3 | 4,
  special: BotLevel,
  others: BotLevel,
  results: GameResult[],
): { wins: number } {
  let wins = 0
  for (let game = 0; game < games; game++) {
    const seat = game % playerCount
    const levels: BotLevel[] = []
    for (let p = 0; p < playerCount; p++) levels.push(p === seat ? special : others)
    const providers: Provider[] = Array.from({ length: playerCount }, () => levelProvider())
    const result = playGame(900000 + game, playerCount, providers, levels)
    results.push(result)
    if (result.finished && result.winner === seat) wins += 1
  }
  return { wins }
}

const scale = Number(process.env.STRENGTH_SCALE ?? '1')
const gamesFor = (base: number) => Math.max(1, Math.round(base * scale))

test('strength: Hard beats three Normal bots at least 36 percent', { timeout: 600000 }, () => {
  const results: GameResult[] = []
  const { wins } = runSeatRotated(gamesFor(120), 4, 'hard', 'normal', results)
  const s = series('hard vs 3 normal (4p)', wins, results)
  console.log('STRENGTH ' + JSON.stringify(s))
  assert.ok(s.finished >= s.games * 0.95, `only ${s.finished}/${s.games} finished`)
  assert.ok(s.winRate >= 0.36, `hard win rate ${s.winRate.toFixed(3)} below 0.36`)
})

test('strength: Normal beats three Easy bots at least 36 percent', { timeout: 600000 }, () => {
  const results: GameResult[] = []
  const { wins } = runSeatRotated(gamesFor(120), 4, 'normal', 'easy', results)
  const s = series('normal vs 3 easy (4p)', wins, results)
  console.log('STRENGTH ' + JSON.stringify(s))
  assert.ok(s.finished >= s.games * 0.95, `only ${s.finished}/${s.games} finished`)
  assert.ok(s.winRate >= 0.36, `normal win rate ${s.winRate.toFixed(3)} below 0.36`)
})

test('strength: Normal beats three random bots at least 90 percent', { timeout: 600000 }, () => {
  const results: GameResult[] = []
  const games = gamesFor(100)
  let wins = 0
  for (let game = 0; game < games; game++) {
    const seat = game % 4
    const providers: Provider[] = [0, 1, 2, 3].map((p) => (p === seat ? levelProvider() : randomAction))
    const result = playGame(700000 + game, 4, providers, [0, 1, 2, 3].map(() => 'normal'))
    results.push(result)
    if (result.finished && result.winner === seat) wins += 1
  }
  const s = series('normal vs 3 random (4p)', wins, results)
  console.log('STRENGTH ' + JSON.stringify(s))
  assert.ok(s.finished >= s.games * 0.95, `only ${s.finished}/${s.games} finished`)
  assert.ok(s.winRate >= 0.9, `normal win rate ${s.winRate.toFixed(3)} below 0.9`)
})

test('strength: report mixed 3-player and baseline games', { timeout: 600000 }, () => {
  const mixed: GameResult[] = []
  const mixedWins = [0, 0, 0, 0]
  const mixedGames = gamesFor(90)
  for (let game = 0; game < mixedGames; game++) {
    const levels: BotLevel[] = ['hard', 'normal', 'easy']
    const providers: Provider[] = Array.from({ length: 3 }, () => levelProvider())
    const result = playGame(800000 + game, 3, providers, levels)
    mixed.push(result)
    if (result.finished) mixedWins[result.winner] += 1
  }
  const mixedSeries = series('3p mixed hard/normal/easy', mixedWins[0], mixed)
  console.log('STRENGTH ' + JSON.stringify(mixedSeries))
  console.log('STRENGTH_MIXED_WINS ' + JSON.stringify({ winsBySeat: mixedWins }))

  const allRandom: GameResult[] = []
  for (let game = 0; game < gamesFor(40); game++) {
    const providers: Provider[] = [0, 1, 2, 3].map(() => randomAction)
    allRandom.push(playGame(600000 + game, 4, providers))
  }
  console.log('STRENGTH ' + JSON.stringify(series('all random (4p)', -1, allRandom)))

  const allGreedy: GameResult[] = []
  for (let game = 0; game < gamesFor(40); game++) {
    const providers: Provider[] = [0, 1, 2, 3].map(() => greedyAction)
    allGreedy.push(playGame(500000 + game, 4, providers))
  }
  console.log('STRENGTH ' + JSON.stringify(series('all greedy (4p)', -1, allGreedy)))

  const allNormal: GameResult[] = []
  for (let game = 0; game < gamesFor(40); game++) {
    const providers: Provider[] = [0, 1, 2, 3].map(() => levelProvider())
    allNormal.push(playGame(400000 + game, 4, providers, [0, 1, 2, 3].map(() => 'normal')))
  }
  console.log('STRENGTH ' + JSON.stringify(series('all normal (4p)', -1, allNormal)))

  assert.ok(mixedSeries.finished >= mixedSeries.games * 0.9, `only ${mixedSeries.finished}/${mixedSeries.games} mixed games finished`)
  assert.ok(true)
})
