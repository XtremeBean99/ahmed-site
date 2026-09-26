import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseBotAction } from '@/lib/games/catan/ai'
import { createGame } from '@/lib/games/catan/board'
import { applyAction, playersToAct } from '@/lib/games/catan/engine'
import { victoryPoints } from '@/lib/games/catan/helpers'
import { emptyStats } from '@/lib/games/catan/stats'
import { makeTestState, putCity, putSettlement } from '@/lib/games/catan/test-fixtures'
import type { GameState } from '@/lib/games/catan/types'
import { diceSeries, highlights, productionBars, scoreRows, vpSeries } from './results-data'

function playBotGame(seed: number, playerCount: 3 | 4): GameState {
  let state = createGame({ seed, playerCount })
  let actions = 0
  while (state.phase.kind !== 'gameOver' && actions < 1200) {
    for (const player of playersToAct(state)) {
      state = applyAction(state, chooseBotAction(state, player))
      actions += 1
      if (state.phase.kind === 'gameOver') break
    }
  }
  assert.equal(state.phase.kind, 'gameOver', `seed ${seed} did not finish`)
  return state
}

test('scoreRows breaks down every point source and sorts by total', () => {
  const state = makeTestState({ phase: { kind: 'gameOver', winner: 1 } })
  putSettlement(state, 0, 17)
  putCity(state, 0, 20)
  putSettlement(state, 1, 25)
  state.players[0].devCards.push('victoryPoint')
  state.longestRoadHolder = 0
  state.largestArmyHolder = 1

  const rows = scoreRows(state)
  assert.deepEqual(rows.map((row) => row.player), [0, 1, 2, 3])
  assert.deepEqual(rows[0], { player: 0, settlements: 1, cities: 1, vpCards: 1, road: 2, army: 0, total: 6 })
  assert.deepEqual(rows[1], { player: 1, settlements: 1, cities: 0, vpCards: 0, road: 0, army: 2, total: 3 })
  assert.equal(rows[2].total, 0)
  assert.equal(rows[3].total, 0)
})

test('diceSeries computes actual, expected and the two extremes', () => {
  const stats = emptyStats(4)
  stats.rolls[6] = 9
  stats.rolls[7] = 3

  const series = diceSeries(stats)
  assert.equal(series.rolls, 12)
  assert.equal(series.bars.length, 11)
  assert.equal(series.bars[0].total, 2)
  assert.equal(series.bars[10].total, 12)
  assert.equal(series.bars[4].actual, 9)
  assert.equal(series.bars[4].expected, (12 * 5) / 36)
  assert.equal(series.over?.total, 6)
  assert.equal(series.under?.total, 8)
})

test('diceSeries handles a game with no rolls', () => {
  const series = diceSeries(emptyStats(3))
  assert.equal(series.rolls, 0)
  assert.equal(series.over, null)
  assert.equal(series.under, null)
  assert.ok(series.bars.every((bar) => bar.actual === 0 && bar.expected === 0))
})

test('productionBars totals each resource and reports robber blocks', () => {
  const stats = emptyStats(3)
  stats.players[0].produced = { brick: 2, lumber: 3, wool: 0, grain: 1, ore: 4 }
  stats.players[1].produced = { brick: 0, lumber: 0, wool: 5, grain: 0, ore: 0 }
  stats.players[2].produced = { brick: 1, lumber: 1, wool: 1, grain: 1, ore: 1 }
  stats.players[0].blocked = 3

  const bars = productionBars(stats)
  assert.equal(bars.maxTotal, 10)
  assert.equal(bars.players[0].total, 10)
  assert.equal(bars.players[0].blocked, 3)
  assert.equal(bars.players[1].total, 5)
  assert.equal(bars.players[2].total, 5)
})

test('vpSeries marks the last row as final', () => {
  const stats = emptyStats(3)
  stats.vpHistory = [
    [0, 1, 2],
    [1, 2, 3],
    [2, 3, 4],
  ]

  const series = vpSeries(stats, 3)
  assert.equal(series.rows.length, 3)
  assert.equal(series.finalRow, 2)
  assert.deepEqual(series.rows[0], [0, 1, 2])
  assert.equal(vpSeries(emptyStats(3), 3).finalRow, null)
})

test('highlights returns structured facts from stats', () => {
  const state = makeTestState({ phase: { kind: 'gameOver', winner: 0 } })
  state.stats.players[1].robbed = 5
  state.stats.players[0].produced = { brick: 40, lumber: 10, wool: 5, grain: 4, ore: 2 }
  state.stats.players[0].bankTrades = 7
  state.stats.players[0].playerTrades = 4
  state.stats.players[1].playerTrades = 4
  state.stats.rolls[6] = 9
  state.stats.rolls[7] = 3

  const facts = highlights(state)
  assert.deepEqual(facts.find((fact) => fact.kind === 'mostRobbed'), { kind: 'mostRobbed', player: 1, count: 5 })
  assert.deepEqual(facts.find((fact) => fact.kind === 'bestProducer'), { kind: 'bestProducer', player: 0, count: 61 })
  assert.deepEqual(facts.find((fact) => fact.kind === 'trades'), { kind: 'trades', playerTrades: 4, bankTrades: 7 })
  assert.deepEqual(facts.find((fact) => fact.kind === 'luckiest'), { kind: 'luckiest', total: 6, actual: 9, expected: (12 * 5) / 36 })
  assert.ok(facts.find((fact) => fact.kind === 'unluckiest'))
})

test('result data functions agree over a real bots-only game', () => {
  const state = playBotGame(4242, 4)
  const rows = scoreRows(state)
  assert.equal(rows[0].total, Math.max(...state.players.map((_, p) => victoryPoints(state, p, true))))
  for (const row of rows) assert.equal(row.total, victoryPoints(state, row.player, true))

  const dice = diceSeries(state.stats)
  assert.equal(dice.rolls, state.stats.rolls.slice(2).reduce((sum, count) => sum + count, 0))
  assert.ok(dice.rolls > 0)

  const bars = productionBars(state.stats)
  assert.equal(bars.players.length, 4)
  assert.ok(bars.maxTotal > 0)

  const vp = vpSeries(state.stats, 4)
  assert.equal(vp.rows.length, state.stats.vpHistory.length)
  assert.equal(vp.finalRow, state.stats.vpHistory.length - 1)

  const facts = highlights(state)
  assert.ok(facts.length > 0)
})

test('the luckiest and unluckiest numbers never name 7', () => {
  const stats = makeTestState().stats
  stats.rolls = [0, 0, 1, 2, 3, 4, 12, 14, 5, 4, 3, 2, 1]
  const facts = highlights({ ...makeTestState(), stats })
  const lucky = facts.find((f) => f.kind === 'luckiest')
  assert.ok(lucky && lucky.kind === 'luckiest')
  assert.equal(lucky.total, 6)
  assert.equal(diceSeries(stats).over?.total, 7)
})

