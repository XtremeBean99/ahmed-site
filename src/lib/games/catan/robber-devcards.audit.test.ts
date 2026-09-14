import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeTestState, give, res } from './test-fixtures'
import { robberHandlers } from './robber'
import type { ActionOf } from './types'

test('discard validate rejects resource payloads with unknown resource keys', () => {
  const state = makeTestState({ phase: { kind: 'discard', discards: [4, 0, 0, 0] } })
  give(state, 0, res({ brick: 8 }))
  const action = {
    type: 'discard',
    player: 0,
    resources: { brick: 4, lumber: 0, wool: 0, grain: 0, ore: 0, gold: 5 },
  } as unknown as ActionOf<'discard'>

  assert.equal(robberHandlers.discard.validate(state, action), 'Invalid resources')
})
