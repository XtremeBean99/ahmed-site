import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VERTICES } from './geometry'
import { satisfiesDistanceRule } from './helpers'
import { setupHandlers } from './setup'
import { makeTestState } from './test-fixtures'

test('setup settlement validate rejects when the current player has no settlements left', () => {
  const state = makeTestState({
    playerCount: 3,
    phase: { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null },
    current: 0,
  })
  state.players[0].settlementsLeft = 0
  const vertex = VERTICES.find((v) => satisfiesDistanceRule(state, v.id))
  assert.ok(vertex)
  assert.notEqual(
    setupHandlers.placeSetupSettlement.validate(state, { type: 'placeSetupSettlement', vertex: vertex.id }),
    null,
  )
})

test('setup road validate rejects when the current player has no roads left', () => {
  const state = makeTestState({
    playerCount: 3,
    phase: { kind: 'setup', round: 1, step: 'road', lastSettlement: 5 },
    current: 0,
  })
  state.players[0].roadsLeft = 0
  const edge = VERTICES[5].edges.find((e) => state.roads[e] === null)
  assert.ok(edge !== undefined)
  assert.notEqual(setupHandlers.placeSetupRoad.validate(state, { type: 'placeSetupRoad', edge }), null)
})
