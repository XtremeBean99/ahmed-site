import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EDGES, VERTICES } from './geometry'
import { emptyResources, satisfiesDistanceRule, setupOrder } from './helpers'
import { setupHandlers } from './setup'
import { FIXTURE_DESERT, makeTestState, putSettlement } from './test-fixtures'
import type { ActionOf, GameState, ResourceCounts } from './types'

function setupState(
  n: 3 | 4,
  round: 1 | 2 = 1,
  step: 'settlement' | 'road' = 'settlement',
  current = 0,
  lastSettlement: number | null = null,
): GameState {
  const state = makeTestState({
    playerCount: n,
    phase: { kind: 'setup', round, step, lastSettlement },
    current,
  })
  state.turn = 0
  return state
}

function firstLegalSettlement(state: GameState): number {
  const vertex = VERTICES.find((v) => satisfiesDistanceRule(state, v.id))
  assert.ok(vertex, 'expected a legal setup settlement vertex')
  return vertex.id
}

function firstLegalRoad(state: GameState): number {
  if (state.phase.kind !== 'setup' || state.phase.lastSettlement === null) {
    throw new Error('state is not at the setup road step')
  }
  const edge = VERTICES[state.phase.lastSettlement].edges.find((e) => state.roads[e] === null)
  assert.ok(edge !== undefined, 'expected a legal setup road edge')
  return edge
}

for (const n of [3, 4] as const) {
  test(`setup follows snake order for ${n} players and ends in preRoll`, () => {
    const state = setupState(n, 1, 'settlement', 0)
    const expectedOrder = [...setupOrder(n, 1), ...setupOrder(n, 2)]
    for (let i = 0; i < 2 * n; i++) {
      assert.equal(state.current, expectedOrder[i])
      const vertex = firstLegalSettlement(state)
      const settlement = { type: 'placeSetupSettlement', vertex } as const
      assert.equal(setupHandlers.placeSetupSettlement.validate(state, settlement), null)
      setupHandlers.placeSetupSettlement.apply(state, settlement)
      assert.equal(state.phase.kind, 'setup')
      assert.equal(state.phase.step, 'road')
      assert.equal(state.phase.lastSettlement, vertex)

      const edge = firstLegalRoad(state)
      const road = { type: 'placeSetupRoad', edge } as const
      assert.equal(setupHandlers.placeSetupRoad.validate(state, road), null)
      setupHandlers.placeSetupRoad.apply(state, road)
    }
    assert.deepEqual(state.phase, { kind: 'preRoll' })
    assert.equal(state.current, 0)
    assert.equal(state.turn, 1)
    for (const player of state.players) {
      assert.equal(player.settlementsLeft, 3)
      assert.equal(player.roadsLeft, 13)
      assert.equal(state.buildings.filter((b) => b?.owner === player.id).length, 2)
      assert.equal(state.roads.filter((r) => r === player.id).length, 2)
    }
    assert.equal(state.events.filter((e) => e.type === 'setupSettlement').length, 2 * n)
    assert.equal(state.events.filter((e) => e.type === 'setupRoad').length, 2 * n)
    assert.equal(state.events.filter((e) => e.type === 'setupResources').length, n)
  })
}

test('placeSetupSettlement enforces the distance rule', () => {
  const state = setupState(3, 1, 'settlement', 0)
  putSettlement(state, 0, 10)
  assert.equal(
    setupHandlers.placeSetupSettlement.validate(state, { type: 'placeSetupSettlement', vertex: 10 }),
    'Settlement violates the distance rule',
  )
  const neighbor = VERTICES[10].neighbors[0]
  assert.equal(
    setupHandlers.placeSetupSettlement.validate(state, { type: 'placeSetupSettlement', vertex: neighbor }),
    'Settlement violates the distance rule',
  )
  const legal = firstLegalSettlement(state)
  assert.equal(setupHandlers.placeSetupSettlement.validate(state, { type: 'placeSetupSettlement', vertex: legal }), null)
})

test('placeSetupRoad must touch the just-placed settlement and be empty', () => {
  const state = setupState(3, 1, 'road', 0, 5)
  const touching = VERTICES[5].edges[0]
  assert.equal(setupHandlers.placeSetupRoad.validate(state, { type: 'placeSetupRoad', edge: touching }), null)
  const other = EDGES.find((e) => !VERTICES[5].edges.includes(e.id))
  assert.ok(other)
  assert.notEqual(setupHandlers.placeSetupRoad.validate(state, { type: 'placeSetupRoad', edge: other.id }), null)
  state.roads[touching] = 1
  assert.equal(
    setupHandlers.placeSetupRoad.validate(state, { type: 'placeSetupRoad', edge: touching }),
    'That road spot is already taken',
  )
})

test('setup actions are rejected outside their step', () => {
  const settlementStep = setupState(3, 1, 'settlement', 0)
  assert.equal(
    setupHandlers.placeSetupRoad.validate(settlementStep, { type: 'placeSetupRoad', edge: 0 }),
    'Roads are placed only during the setup road step',
  )
  const roadStep = setupState(3, 1, 'road', 0, 5)
  assert.equal(
    setupHandlers.placeSetupSettlement.validate(roadStep, { type: 'placeSetupSettlement', vertex: 0 }),
    'Settlements are placed only during the setup settlement step',
  )
  const main = makeTestState({ playerCount: 3, phase: { kind: 'main' }, current: 0 })
  assert.equal(
    setupHandlers.placeSetupSettlement.validate(main, { type: 'placeSetupSettlement', vertex: 0 }),
    'Settlements are placed only during the setup settlement step',
  )
})

test('round-2 settlement pays adjacent producing hexes', () => {
  const state = setupState(3, 2, 'settlement', 0)
  const vertex = VERTICES.find((v) => v.hexes.includes(FIXTURE_DESERT) && satisfiesDistanceRule(state, v.id))
  assert.ok(vertex)
  const expected: ResourceCounts = emptyResources()
  for (const hex of vertex.hexes) {
    const terrain = state.tiles[hex].terrain
    if (terrain !== 'desert') expected[terrain] += 1
  }
  assert.ok(Object.values(expected).some((count) => count > 0))
  const bankBefore = { ...state.bank }
  setupHandlers.placeSetupSettlement.apply(state, { type: 'placeSetupSettlement', vertex: vertex.id })
  assert.deepEqual(state.players[0].resources, expected)
  for (const resource of Object.keys(expected) as (keyof ResourceCounts)[]) {
    assert.equal(state.bank[resource], bankBefore[resource] - expected[resource])
  }
  const resourceEvents = state.events.filter((e) => e.type === 'setupResources')
  assert.equal(resourceEvents.length, 1)
  assert.equal(resourceEvents[0].player, 0)
  assert.deepEqual(resourceEvents[0].resources, expected)
})

test('round-2 settlement always emits setupResources, even with no producing hexes', () => {
  const state = setupState(3, 2, 'settlement', 0)
  const vertex = VERTICES.find((v) => v.hexes.length === 1)
  assert.ok(vertex)
  for (const hex of vertex.hexes) state.tiles[hex] = { terrain: 'desert', number: null }
  const bankBefore = { ...state.bank }
  setupHandlers.placeSetupSettlement.apply(state, { type: 'placeSetupSettlement', vertex: vertex.id })
  assert.deepEqual(state.players[0].resources, emptyResources())
  assert.deepEqual(state.bank, bankBefore)
  const resourceEvents = state.events.filter((e) => e.type === 'setupResources')
  assert.equal(resourceEvents.length, 1)
  assert.deepEqual(resourceEvents[0].resources, emptyResources())
})

test('end of round 1 moves to round 2 with the last seat', () => {
  const state = setupState(3, 1, 'road', 2, 5)
  const edge = firstLegalRoad(state)
  setupHandlers.placeSetupRoad.apply(state, { type: 'placeSetupRoad', edge })
  assert.equal(state.phase.kind, 'setup')
  assert.equal(state.phase.round, 2)
  assert.equal(state.phase.step, 'settlement')
  assert.equal(state.phase.lastSettlement, null)
  assert.equal(state.current, 2)
})

test('final setup road moves to preRoll, current 0, turn 1', () => {
  const state = setupState(3, 2, 'road', 0, 5)
  const edge = firstLegalRoad(state)
  setupHandlers.placeSetupRoad.apply(state, { type: 'placeSetupRoad', edge })
  assert.deepEqual(state.phase, { kind: 'preRoll' })
  assert.equal(state.current, 0)
  assert.equal(state.turn, 1)
})

test('malformed payloads are rejected', () => {
  const settlementStep = setupState(3, 1, 'settlement', 0)
  for (const vertex of [0.5, -1, 54, '3', null, undefined]) {
    assert.equal(
      setupHandlers.placeSetupSettlement.validate(settlementStep, {
        type: 'placeSetupSettlement',
        vertex,
      } as unknown as ActionOf<'placeSetupSettlement'>),
      'Invalid vertex',
    )
  }
  const roadStep = setupState(3, 1, 'road', 0, 5)
  for (const edge of [0.5, -1, 72, '3', null, undefined]) {
    assert.equal(
      setupHandlers.placeSetupRoad.validate(roadStep, {
        type: 'placeSetupRoad',
        edge,
      } as unknown as ActionOf<'placeSetupRoad'>),
      'Invalid edge',
    )
  }
})

test('validate never mutates state', () => {
  const settlementStep = setupState(3, 1, 'settlement', 0)
  const before = JSON.stringify(settlementStep)
  const vertex = firstLegalSettlement(settlementStep)
  assert.equal(setupHandlers.placeSetupSettlement.validate(settlementStep, { type: 'placeSetupSettlement', vertex }), null)
  setupHandlers.placeSetupRoad.validate(settlementStep, { type: 'placeSetupRoad', edge: 0 })
  setupHandlers.placeSetupSettlement.validate(settlementStep, {
    type: 'placeSetupSettlement',
    vertex: -1,
  } as unknown as ActionOf<'placeSetupSettlement'>)
  assert.equal(JSON.stringify(settlementStep), before)

  const roadStep = setupState(3, 1, 'road', 0, 5)
  const beforeRoad = JSON.stringify(roadStep)
  const edge = firstLegalRoad(roadStep)
  assert.equal(setupHandlers.placeSetupRoad.validate(roadStep, { type: 'placeSetupRoad', edge }), null)
  setupHandlers.placeSetupSettlement.validate(roadStep, { type: 'placeSetupSettlement', vertex: 0 })
  setupHandlers.placeSetupRoad.validate(roadStep, { type: 'placeSetupRoad', edge: -1 } as unknown as ActionOf<'placeSetupRoad'>)
  assert.equal(JSON.stringify(roadStep), beforeRoad)
})
