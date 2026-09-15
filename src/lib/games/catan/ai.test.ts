import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pips } from './constants'
import { chooseBotAction, botAcceptsTrade } from './ai'
import { applyAction, createGame, playersToAct, validateAction } from './engine'
import { HEXES, VERTICES } from './geometry'
import { totalCards } from './helpers'
import { give, makeTestState, putRoadPath, putSettlement, res } from './test-fixtures'
import type { GameState, PlayerId } from './types'

function pipSum(state: GameState, vertex: number): number {
  let sum = 0
  for (const hex of VERTICES[vertex].hexes) {
    const tile = state.tiles[hex]
    if (tile.terrain !== 'desert' && tile.number !== null) sum += pips(tile.number)
  }
  return sum
}

function asSettlement(action: unknown): number {
  assert.equal((action as { type: string }).type, 'placeSetupSettlement')
  return (action as { vertex: number }).vertex
}

test('bots-only full games: every action validates, games finish, deterministic stats', () => {
  const playerCounts = [3, 4] as const
  const seedsPerCount = 120
  const actionCap = 2500
  let total = 0
  let finished = 0
  let capped = 0
  let invalid = 0
  let throws = 0
  let turnTotal = 0
  const wins: number[] = [0, 0, 0, 0]

  for (const playerCount of playerCounts) {
    for (let seed = 0; seed < seedsPerCount; seed++) {
      total++
      let state = createGame({ seed, playerCount })
      let actions = 0
      try {
        while (state.phase.kind !== 'gameOver' && actions < actionCap) {
          const actors = playersToAct(state)
          for (const player of actors) {
            const action = chooseBotAction(state, player)
            const reason = validateAction(state, action)
            if (reason !== null) {
              invalid++
              // Fail fast with diagnostics, but keep counting for the summary.
              assert.equal(reason, null, `invalid action at seed ${seed}/${playerCount}: ${JSON.stringify(action)}`)
            }
            state = applyAction(state, action)
            actions++
            if (state.phase.kind === 'gameOver') break
          }
        }
        if (state.phase.kind === 'gameOver') {
          finished++
          wins[state.phase.winner]++
        } else {
          capped++
        }
        turnTotal += state.turn
      } catch (error) {
        throws++
        console.error('simulation threw', { playerCount, seed, error })
      }
    }
  }

  const stats = {
    total,
    finished,
    capped,
    invalid,
    throws,
    avgTurns: total === 0 ? 0 : turnTotal / total,
    winShareBySeat: wins,
  }
  console.log('AI_SIM_STATS ' + JSON.stringify(stats))

  assert.equal(invalid, 0)
  assert.equal(throws, 0)
  assert.ok(finished / total >= 0.97, `only ${finished}/${total} games reached gameOver`)
})

test('chooseBotAction is deterministic and does not mutate its input', () => {
  const fresh = createGame({ seed: 42, playerCount: 4 })
  const beforeJson = JSON.stringify(fresh)
  const first = chooseBotAction(fresh, fresh.current)
  const second = chooseBotAction(fresh, fresh.current)
  assert.equal(JSON.stringify(fresh), beforeJson)
  assert.deepEqual(second, first)

  const main = makeTestState({ phase: { kind: 'main' }, current: 0 })
  putSettlement(main, 0, 17)
  putRoadPath(main, 0, [17, 22, 28])
  give(main, 0, { brick: 2, lumber: 2, wool: 1, grain: 1, ore: 3 })
  const mainJson = JSON.stringify(main)
  const mainFirst = chooseBotAction(main, 0)
  const mainSecond = chooseBotAction(main, 0)
  assert.equal(JSON.stringify(main), mainJson)
  assert.deepEqual(mainSecond, mainFirst)
})

test('setup settlement picks a high-pip vertex over a desert-adjacent one', () => {
  const s = makeTestState({
    phase: { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null },
    current: 0,
  })
  const vertex = asSettlement(chooseBotAction(s, 0))
  const desertAdjacent = 29 // lowest-pip desert vertex in the fixture
  assert.ok(pipSum(s, vertex) > pipSum(s, desertAdjacent), `picked vertex ${vertex} with pips ${pipSum(s, vertex)}`)
  assert.notEqual(vertex, desertAdjacent)
})

test('discard keeps target resources and discards the correct count from surplus', () => {
  const bot: PlayerId = 1
  const s = makeTestState({ phase: { kind: 'discard', discards: [0, 6, 0, 0] }, current: 0 })
  putSettlement(s, bot, 17)
  give(s, bot, { brick: 3, lumber: 3, wool: 3, grain: 2, ore: 2 })
  const before = JSON.stringify(s)

  const action = chooseBotAction(s, bot)
  assert.equal(action.type, 'discard')
  if (action.type !== 'discard') throw new Error('unreachable')
  assert.equal(action.player, bot)
  assert.equal(totalCards(action.resources), 6)
  assert.equal(action.resources.grain, 0)
  assert.equal(action.resources.ore, 0)
  assert.equal(JSON.stringify(s), before)
})

test('discard is answered even while the bot is not the current player', () => {
  const bot: PlayerId = 1
  const s = makeTestState({ phase: { kind: 'discard', discards: [0, 4, 0, 0] }, current: 0 })
  putSettlement(s, bot, 17)
  give(s, bot, { brick: 2, lumber: 2, wool: 2, grain: 1, ore: 1 })

  const action = chooseBotAction(s, bot)
  assert.equal(action.type, 'discard')
  if (action.type !== 'discard') throw new Error('unreachable')
  assert.equal(action.player, bot)
  assert.equal(totalCards(action.resources), 4)
  assert.equal(action.resources.grain, 0)
  assert.equal(action.resources.ore, 0)
})

test('robber avoids the bot\'s own hexes and targets the leader', () => {
  const bot: PlayerId = 1
  const leader: PlayerId = 2
  const s = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' }, current: bot })
  putSettlement(s, bot, HEXES[11].vertices[0])
  putSettlement(s, leader, HEXES[17].vertices[0])
  give(s, leader, { grain: 2 })

  const action = chooseBotAction(s, bot)
  assert.equal(action.type, 'moveRobber')
  if (action.type !== 'moveRobber') throw new Error('unreachable')
  assert.notEqual(action.hex, 11)
  assert.equal(action.hex, 17)
})

test('bot builds a city when it can', () => {
  const s = makeTestState({ phase: { kind: 'main' }, current: 0 })
  putSettlement(s, 0, 17)
  give(s, 0, { grain: 2, ore: 3 })

  const action = chooseBotAction(s, 0)
  assert.equal(action.type, 'buildCity')
  if (action.type !== 'buildCity') throw new Error('unreachable')
  assert.equal(action.vertex, 17)
})

test('bot makes a maritime trade only when it enables a build, then builds it', () => {
  const s = makeTestState({ phase: { kind: 'main' }, current: 0 })
  putSettlement(s, 0, 17)
  putRoadPath(s, 0, [17, 22, 28])
  give(s, 0, { brick: 5, wool: 1, grain: 1 })

  const action = chooseBotAction(s, 0)
  assert.equal(action.type, 'maritimeTrade')
  if (action.type !== 'maritimeTrade') throw new Error('unreachable')
  assert.equal(action.give, 'brick')
  assert.equal(action.get, 'lumber')

  const next = applyAction(s, action)
  const build = chooseBotAction(next, 0)
  assert.equal(build.type, 'buildSettlement')
  if (build.type !== 'buildSettlement') throw new Error('unreachable')
  assert.equal(build.vertex, 28)
})

test('bot ends its turn when no useful move or trade exists', () => {
  const s = makeTestState({ phase: { kind: 'main' }, current: 0 })
  give(s, 0, { brick: 5 })
  const action = chooseBotAction(s, 0)
  assert.equal(action.type, 'endTurn')
})

test('botAcceptsTrade accepts a clearly good trade, rejects a bad one, and rejects a proposer at 8+ VP', () => {
  const bot: PlayerId = 1
  const s = makeTestState({ phase: { kind: 'main' }, current: 0 })
  putSettlement(s, bot, 17)
  putRoadPath(s, bot, [17, 22, 28])
  give(s, bot, { brick: 4, lumber: 4, grain: 1 })

  assert.equal(botAcceptsTrade(s, bot, { from: 0, give: res({ wool: 1 }), get: res({ brick: 1 }) }), true)
  assert.equal(botAcceptsTrade(s, bot, { from: 0, give: res({ brick: 1 }), get: res({ grain: 1 }) }), false)

  const leaderState = makeTestState({ phase: { kind: 'main' }, current: 0 })
  const proposer: PlayerId = 0
  putSettlement(leaderState, proposer, 4)
  putSettlement(leaderState, proposer, 7)
  putSettlement(leaderState, proposer, 10)
  putSettlement(leaderState, proposer, 13)
  putSettlement(leaderState, proposer, 16)
  putSettlement(leaderState, proposer, 19)
  putSettlement(leaderState, proposer, 24)
  putSettlement(leaderState, proposer, 28)
  const bot2: PlayerId = 1
  give(leaderState, bot2, { brick: 2 })
  assert.equal(botAcceptsTrade(leaderState, bot2, { from: proposer, give: res({ wool: 1 }), get: res({ brick: 1 }) }), false)
})

test('monopoly uses only public information, not opponents\' hidden hands', () => {
  const bot: PlayerId = 1
  const human: PlayerId = 0

  const buildState = (humanCards: Partial<Record<'brick' | 'lumber' | 'wool' | 'grain' | 'ore', number>>) => {
    const s = makeTestState({ phase: { kind: 'main' }, current: bot })
    putSettlement(s, bot, 17)
    putRoadPath(s, bot, [17, 22, 28])
    give(s, bot, { brick: 1, lumber: 1, wool: 1 })
    give(s, human, humanCards)
    s.players[bot].devCards.push('monopoly')
    return s
  }

  const a = buildState({ brick: 1, lumber: 1, wool: 1, grain: 1, ore: 1 })
  const b = buildState({ grain: 5 })
  assert.equal(totalCards(a.players[human].resources), totalCards(b.players[human].resources))

  const actionA = chooseBotAction(a, bot)
  const actionB = chooseBotAction(b, bot)
  assert.deepEqual(actionB, actionA)
  assert.equal(actionA.type, 'playMonopoly')
  if (actionA.type !== 'playMonopoly') throw new Error('unreachable')
  assert.equal(actionA.resource, 'grain')
})
