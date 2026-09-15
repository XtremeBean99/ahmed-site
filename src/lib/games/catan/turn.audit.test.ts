import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VERTICES } from './geometry'
import { makeTestState, putSettlement } from './test-fixtures'
import { turnHandlers } from './turn'

test('buildRoad rejects a roadBuilding phase whose remaining count is already exhausted', () => {
  const s = makeTestState({ phase: { kind: 'roadBuilding', remaining: 0, returnTo: 'main' } })
  putSettlement(s, 0, 4)
  const edge = VERTICES[4].edges[0]
  assert.notEqual(turnHandlers.buildRoad.validate(s, { type: 'buildRoad', edge }), null)
})
