import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chooseBotAction } from './ai'
import { createGame } from './board'
import { RESOURCES } from './constants'
import { applyAction, playersToAct } from './engine'
import { HEXES, VERTICES } from './geometry'
import { victoryPoints } from './helpers'
import { emptyStats } from './stats'
import { give, makeTestState, putCity, putSettlement, res } from './test-fixtures'
import type { Action, GameEvent, GameState, GameStats } from './types'

function totalOf(counts: Record<string, number>): number {
  return RESOURCES.reduce((sum, r) => sum + counts[r], 0)
}

function applyEventToReference(stats: GameStats, state: GameState, event: GameEvent): void {
  switch (event.type) {
    case 'roll':
      stats.rolls[event.dice[0] + event.dice[1]] += 1
      break
    case 'produce':
      for (let p = 0; p < stats.players.length; p++) {
        const gains = event.gains[p]
        for (const r of RESOURCES) stats.players[p].produced[r] += gains[r]
      }
      for (let p = 0; p < stats.players.length; p++) {
        stats.players[p].blocked += totalOf(event.blocked[p])
      }
      break
    case 'setupResources':
      for (const r of RESOURCES) stats.players[event.player].produced[r] += event.resources[r]
      break
    case 'stole':
      if (event.resource !== null) {
        stats.players[event.player].stole += 1
        stats.players[event.victim].robbed += 1
      }
      break
    case 'discard':
      stats.players[event.player].discarded += totalOf(event.resources)
      break
    case 'monopoly':
      stats.players[event.player].monopolyGained += event.taken
      for (let p = 0; p < stats.players.length; p++) stats.players[p].monopolyLost += event.takenFrom[p]
      break
    case 'maritimeTrade':
      stats.players[event.player].bankTrades += 1
      break
    case 'domesticTrade':
      stats.players[event.player].playerTrades += 1
      stats.players[event.partner].playerTrades += 1
      break
    case 'boughtDevCard':
      stats.players[event.player].devCardsBought += 1
      break
    case 'playedDevCard':
      stats.players[event.player].devCardsPlayed += 1
      break
    case 'turnEnded':
      stats.vpHistory.push(state.players.map((_, p) => victoryPoints(state, p, false)))
      break
    case 'gameOver':
      stats.vpHistory.push(state.players.map((_, p) => victoryPoints(state, p, true)))
      break
  }
}

function collectGame(seed: number, playerCount: 3 | 4): { state: GameState; actions: Action[]; events: GameEvent[] } {
  let state = createGame({ seed, playerCount })
  const actions: Action[] = []
  const events: GameEvent[] = []
  const cap = 1200
  while (state.phase.kind !== 'gameOver' && actions.length < cap) {
    for (const player of playersToAct(state)) {
      const before = state.eventSeq
      const action = chooseBotAction(state, player)
      state = applyAction(state, action)
      actions.push(action)
      for (const event of state.events) {
        if (event.seq > before) events.push(event)
      }
      if (state.phase.kind === 'gameOver') break
    }
  }
  return { state, actions, events }
}

function referenceStats(seed: number, playerCount: 3 | 4, actions: Action[]): GameStats {
  const stats = emptyStats(playerCount)
  let state = createGame({ seed, playerCount })
  for (const action of actions) {
    const before = state.eventSeq
    state = applyAction(state, action)
    for (const event of state.events) {
      if (event.seq > before) applyEventToReference(stats, state, event)
    }
  }
  return stats
}

test('stats equal an independent recomputation from the complete event list', () => {
  for (const playerCount of [3, 4] as const) {
    for (let game = 0; game < 10; game++) {
      const seed = 5000 + game * 10 + playerCount
      const { state, actions, events } = collectGame(seed, playerCount)
      const reference = referenceStats(seed, playerCount, actions)
      assert.deepEqual(state.stats, reference, `stats drift at seed ${seed}/${playerCount}`)

      const replayed = collectGame(seed, playerCount)
      assert.deepEqual(replayed.events, events, `event replay drift at seed ${seed}/${playerCount}`)
      assert.deepEqual(replayed.state, state)
    }
  }
})

test('blocked counts cards withheld from the robber hex on produce', () => {
  const state = makeTestState({ phase: { kind: 'preRoll' }, current: 0 })
  state.robber = 0
  state.scriptedRolls = [[6, 4]]
  putSettlement(state, 1, HEXES[0].vertices[0])

  const next = applyAction(state, { type: 'rollDice' })
  assert.equal(next.stats.players[1].blocked, 1)
  assert.equal(next.stats.players[1].produced.ore, 0)
  const event = next.events.find((e) => e.type === 'produce')
  assert.ok(event && event.type === 'produce')
  if (event?.type === 'produce') {
    assert.equal(totalOf(event.blocked[1]), 1)
    assert.equal(totalOf(event.gains[1]), 0)
  }
})

test('monopoly stats record gained and lost cards per player', () => {
  const state = makeTestState({ phase: { kind: 'main' }, current: 0 })
  state.players[0].devCards.push('monopoly')
  give(state, 1, res({ ore: 3 }))
  give(state, 2, res({ ore: 2 }))

  const next = applyAction(state, { type: 'playMonopoly', resource: 'ore' })
  assert.equal(next.players[0].resources.ore, 5)
  assert.equal(next.stats.players[0].monopolyGained, 5)
  assert.equal(next.stats.players[1].monopolyLost, 3)
  assert.equal(next.stats.players[2].monopolyLost, 2)
  assert.equal(next.stats.players[3].monopolyLost, 0)
  const event = next.events.find((e) => e.type === 'monopoly')
  assert.ok(event && event.type === 'monopoly')
  if (event?.type === 'monopoly') {
    assert.deepEqual(event.takenFrom, [0, 3, 2, 0])
  }
})

test('vpHistory records public VP at turnEnded and hidden VP at gameOver', () => {
  const state = makeTestState({ phase: { kind: 'main' }, current: 0 })
  putSettlement(state, 0, 17)
  state.players[0].devCards.push('victoryPoint')
  state.players[0].devCards.push('victoryPoint')

  const afterTurn = applyAction(state, { type: 'endTurn' })
  assert.equal(afterTurn.stats.vpHistory.length, 1)
  assert.deepEqual(afterTurn.stats.vpHistory[0][0], 1)

  const nearWin = makeTestState({ phase: { kind: 'main' }, current: 0 })
  putSettlement(nearWin, 0, 17)
  for (const vertex of [20, 25, 30, 35]) putCity(nearWin, 0, vertex)
  nearWin.players[0].devCards.push('victoryPoint')
  give(nearWin, 0, res({ brick: 1, lumber: 1 }))

  const next = applyAction(nearWin, { type: 'buildRoad', edge: VERTICES[17].edges[0] })
  assert.equal(next.phase.kind, 'gameOver')
  const finalRow = next.stats.vpHistory.at(-1)
  assert.ok(finalRow)
  assert.equal(finalRow[0], 10)
})
