import { RESOURCES } from '@/lib/games/catan/constants'
import type { GameState, GameStats, PlayerId, ResourceCounts } from '@/lib/games/catan/types'

export interface ScoreRow {
  player: PlayerId
  settlements: number
  cities: number
  vpCards: number
  road: number
  army: number
  total: number
}

/** One row per player, sorted by final VP, showing every point source at game over. */
export function scoreRows(state: GameState): ScoreRow[] {
  const rows = state.players.map((p) => {
    let settlements = 0
    let cities = 0
    for (const building of state.buildings) {
      if (building?.owner !== p.id) continue
      if (building.kind === 'city') cities += 1
      else settlements += 1
    }
    const vpCards = [...p.devCards, ...p.newDevCards].filter((card) => card === 'victoryPoint').length
    const road = state.longestRoadHolder === p.id ? 2 : 0
    const army = state.largestArmyHolder === p.id ? 2 : 0
    return {
      player: p.id,
      settlements,
      cities,
      vpCards,
      road,
      army,
      total: settlements + cities * 2 + vpCards + road + army,
    }
  })
  rows.sort((a, b) => b.total - a.total || a.player - b.player)
  return rows
}

export interface DiceBar {
  total: number
  actual: number
  expected: number
}

export interface DiceSeries {
  rolls: number
  bars: DiceBar[]
  /** Bar whose actual count exceeds expectation the most, or null with no rolls. */
  over: DiceBar | null
  /** Bar whose actual count falls below expectation the most, or null with no rolls. */
  under: DiceBar | null
}

const WAYS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]

export function diceSeries(stats: GameStats): DiceSeries {
  let rolls = 0
  for (let total = 2; total <= 12 && total < stats.rolls.length; total++) rolls += stats.rolls[total]

  const bars: DiceBar[] = []
  for (let total = 2; total <= 12; total++) {
    const actual = stats.rolls[total] ?? 0
    bars.push({ total, actual, expected: (rolls * WAYS[total]) / 36 })
  }

  return { rolls, bars, ...extremes(bars) }
}

/** The most over- and under-rolled totals, optionally ignoring some (7 produces nothing, so it is never "lucky"). */
export function extremes(bars: DiceBar[], ignore: readonly number[] = []): { over: DiceBar | null; under: DiceBar | null } {
  let over: DiceBar | null = null
  let under: DiceBar | null = null
  for (const bar of bars) {
    if (ignore.includes(bar.total)) continue
    const deviation = bar.actual - bar.expected
    if (deviation > 0 && (over === null || deviation > over.actual - over.expected)) over = bar
    if (deviation < 0 && (under === null || deviation < under.actual - under.expected)) under = bar
  }
  return { over, under }
}

export interface ProductionBar {
  player: PlayerId
  produced: ResourceCounts
  total: number
  blocked: number
}

export interface ProductionBars {
  players: ProductionBar[]
  /** Largest per-player production total, at least 1 so empty games never divide by zero. */
  maxTotal: number
}

export function productionBars(stats: GameStats): ProductionBars {
  const players = stats.players.map((s, player) => ({
    player,
    produced: { ...s.produced },
    total: RESOURCES.reduce((sum, r) => sum + s.produced[r], 0),
    blocked: s.blocked,
  }))
  const maxTotal = Math.max(1, ...players.map((p) => p.total))
  return { players, maxTotal }
}

export interface VpSeries {
  /** rows[i][p] = VP for player p when turn i + 1 ended; the last row is the game-over row. */
  rows: number[][]
  /** Index of the game-over row, which includes hidden victory point cards, or null when empty. */
  finalRow: number | null
}

export function vpSeries(stats: GameStats, playerCount: number): VpSeries {
  const rows = stats.vpHistory.map((row) => row.slice(0, playerCount))
  return { rows, finalRow: rows.length > 0 ? rows.length - 1 : null }
}

export type Highlight =
  | { kind: 'mostRobbed'; player: PlayerId; count: number }
  | { kind: 'bestProducer'; player: PlayerId; count: number }
  | { kind: 'trades'; playerTrades: number; bankTrades: number }
  | { kind: 'luckiest'; total: number; actual: number; expected: number }
  | { kind: 'unluckiest'; total: number; actual: number; expected: number }

/** Structured facts for the Highlights tab; the component owns the copy. */
export function highlights(state: GameState): Highlight[] {
  const stats = state.stats
  const out: Highlight[] = []

  let robbedPlayer = -1
  let robbedCount = 0
  let producerPlayer = -1
  let producerCount = 0
  let playerTrades = 0
  let bankTrades = 0
  stats.players.forEach((s, player) => {
    if (s.robbed > robbedCount) {
      robbedCount = s.robbed
      robbedPlayer = player
    }
    const produced = RESOURCES.reduce((sum, r) => sum + s.produced[r], 0)
    if (produced > producerCount) {
      producerCount = produced
      producerPlayer = player
    }
    playerTrades += s.playerTrades
    bankTrades += s.bankTrades
  })

  if (robbedCount > 0) out.push({ kind: 'mostRobbed', player: robbedPlayer, count: robbedCount })
  if (producerCount > 0) out.push({ kind: 'bestProducer', player: producerPlayer, count: producerCount })
  if (playerTrades > 0 || bankTrades > 0) {
    out.push({ kind: 'trades', playerTrades: playerTrades / 2, bankTrades })
  }

  const lucky = extremes(diceSeries(stats).bars, [7])
  if (lucky.over) out.push({ kind: 'luckiest', ...lucky.over })
  if (lucky.under) out.push({ kind: 'unluckiest', ...lucky.under })

  return out
}
