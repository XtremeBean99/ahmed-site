import assert from 'node:assert/strict'
import test from 'node:test'
import { makeTestState, give, putSettlement, res } from '@/lib/games/catan/test-fixtures'
import { validateAction } from '@/lib/games/catan/engine'
import {
  isTradePendingForHuman,
  selectBoardTargets,
  selectBlockReasons,
  selectCanFlags,
  selectLastPlaced,
  selectStatus,
  type StatusMessages,
} from './selectors'

const statusMessages: StatusMessages = {
  newGame: 'New game',
  setupSettlement: '{player}: place a starting settlement',
  setupRoad: '{player}: place a starting road',
  preRoll: '{player}: roll the dice',
  main: '{player}: build, trade, or end turn',
  roadBuilding: '{player}: place free roads ({remaining} left)',
  moveRobber: '{player}: move the robber',
  steal: '{player}: choose who to steal from',
  discard: '{player}: discard {count} cards',
  gameOver: '{player} wins!',
  gameOverYou: 'You win!',
  buildMode: 'Choose a spot on the board. Esc cancels',
}

test('selectBoardTargets returns setup settlement targets during setup', () => {
  const state = makeTestState({ phase: { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null } })
  const targets = selectBoardTargets(state, 0, null)
  assert.equal(targets.kind, 'setupSettlement')
  assert.ok(targets.vertices.length > 0)
  assert.deepEqual(targets.edges, [])
})

test('selectBoardTargets filters tutorial-disallowed vertices', () => {
  const state = makeTestState({ phase: { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null } })
  const allowed = selectBoardTargets(state, 0, null, (_s, action) => action.type === 'placeSetupSettlement' && action.vertex !== 0)
  assert.ok(!allowed.vertices.includes(0))
  assert.ok(allowed.vertices.length > 0)
})

test('selectBoardTargets returns empty targets while a bot acts', () => {
  const state = makeTestState({ phase: { kind: 'main' }, current: 1 })
  assert.deepEqual(selectBoardTargets(state, 0, 'road'), { kind: null, vertices: [], edges: [], hexes: [] })
})

test('selectCanFlags gates on resources, spots and turn', () => {
  const state = makeTestState({ phase: { kind: 'main' }, current: 0 })
  state.buildings[10] = { owner: 0, kind: 'settlement' }
  give(state, 0, res({ brick: 1, lumber: 1 }))
  const flags = selectCanFlags(state, 0)
  assert.equal(flags.canRoad, true)
  assert.equal(flags.canSettlement, false)
  assert.equal(flags.canCity, false)
  assert.equal(flags.canBuyDev, false)
  assert.equal(flags.canEndTurn, true)
  assert.equal(flags.canRoll, false)
  assert.equal(flags.canTrade, true, 'any card can go into a player offer')

  const preRoll = makeTestState({ phase: { kind: 'preRoll' }, current: 0 })
  assert.equal(selectCanFlags(preRoll, 0).canRoll, true)
})

test('selectBlockReasons returns null outside main and preRoll', () => {
  const setup = makeTestState({ phase: { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null } })
  assert.equal(selectBlockReasons(setup, 0, true), null)

  const main = makeTestState({ phase: { kind: 'main' } })
  const reasons = selectBlockReasons(main, 0, true)
  assert.ok(reasons)
  assert.deepEqual(reasons.road, { kind: 'resources', missing: res({ brick: 1, lumber: 1 }) })
})

test('isTradePendingForHuman is true only for a pending offer addressed to the human', () => {
  const state = makeTestState({
    phase: {
      kind: 'trade',
      offer: {
        id: 1,
        from: 1,
        to: [0],
        replies: ['pending', 'decline', 'decline', 'decline'],
        counters: [null, null, null, null],
        give: res({ brick: 1 }),
        get: res({ lumber: 1 }),
      },
    },
  })
  assert.equal(isTradePendingForHuman(state, 0), true)
  assert.equal(isTradePendingForHuman(state, 1), false)
})

test('selectStatus shows build mode instructions and phase text', () => {
  const main = makeTestState({ phase: { kind: 'main' }, current: 0 })
  assert.equal(selectStatus(main, 0, null, null, 'road', statusMessages).text, 'Choose a spot on the board. Esc cancels')

  const discard = makeTestState({ phase: { kind: 'discard', discards: [4, 2, 0, 0] }, current: 0 })
  assert.equal(selectStatus(discard, 0, null, null, null, statusMessages).text, 'You: discard 4 cards')

  const botsTurn = makeTestState({ phase: { kind: 'preRoll' }, current: 1 })
  assert.equal(selectStatus(botsTurn, 0, null, null, null, statusMessages).text, 'Bot 1: roll the dice')

  const override = makeTestState({ phase: { kind: 'main' }, current: 0 })
  assert.equal(selectStatus(override, 0, null, 'Lesson step', null, statusMessages).text, 'Lesson step')
})

test('selectLastPlaced finds the most recent board placement', () => {
  const state = makeTestState()
  state.events = [
    { seq: 1, turn: 1, type: 'setupSettlement', player: 0, vertex: 8 },
    { seq: 2, turn: 1, type: 'built', player: 1, kind: 'road', at: 5 },
  ]
  assert.deepEqual(selectLastPlaced(state), { kind: 'edge', id: 5 })
  assert.equal(selectLastPlaced(null), null)
})

test('robber targets are the engine legal hexes, so the friendly robber protects low-score players', () => {
  const state = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' }, current: 0 })
  state.settings.friendlyRobber = true
  putSettlement(state, 1, 4)
  putSettlement(state, 2, 40)
  putSettlement(state, 2, 44)
  putSettlement(state, 2, 50)
  const targets = selectBoardTargets(state, 0, null)
  assert.ok(targets.hexes.length > 0)
  for (const hex of targets.hexes) assert.equal(validateAction(state, { type: 'moveRobber', hex }), null)
  assert.ok(targets.hexes.length < 18, 'protected hexes are left out')
})

test('Trade opens for player offers even when no bank trade is possible', () => {
  const state = makeTestState({ phase: { kind: 'main' }, current: 0 })
  give(state, 0, { brick: 1, wool: 1, grain: 2 })
  assert.equal(selectCanFlags(state, 0).canTrade, true)
  for (const r of ['brick', 'lumber', 'wool', 'grain', 'ore'] as const) state.bank[r] = 0
  assert.equal(selectCanFlags(state, 0).canTrade, true)
  const emptyHanded = makeTestState({ phase: { kind: 'main' }, current: 0 })
  assert.equal(selectCanFlags(emptyHanded, 0).canTrade, false)
})

