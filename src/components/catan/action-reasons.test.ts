import assert from 'node:assert/strict'
import test from 'node:test'
import { makeTestState, give, res } from '@/lib/games/catan/test-fixtures'
import { actionBlockReason, formatActionBlockReason, type ActionReasonMessages } from './action-reasons'

const messages: ActionReasonMessages = {
  needResources: 'Need {resources}',
  noSpot: 'No legal spot',
  noPieces: 'No pieces left',
  deckEmpty: 'Deck is empty',
  rollFirst: 'Roll first',
  resourceNames: {
    brick: 'brick',
    lumber: 'lumber',
    wool: 'wool',
    grain: 'grain',
    ore: 'ore',
  },
}

test('actionBlockReason returns rollFirst in preRoll', () => {
  const state = makeTestState({ phase: { kind: 'preRoll' } })
  assert.deepEqual(actionBlockReason(state, 0, 'road'), { kind: 'rollFirst' })
  assert.deepEqual(actionBlockReason(state, 0, 'devCard'), { kind: 'rollFirst' })
})

test('actionBlockReason reports missing resources first', () => {
  const state = makeTestState()
  give(state, 0, { brick: 1, wool: 1, grain: 1 })
  assert.deepEqual(actionBlockReason(state, 0, 'road'), {
    kind: 'resources',
    missing: res({ lumber: 1 }),
  })
  assert.deepEqual(actionBlockReason(state, 0, 'settlement'), {
    kind: 'resources',
    missing: res({ lumber: 1 }),
  })
  assert.deepEqual(actionBlockReason(state, 0, 'devCard'), {
    kind: 'resources',
    missing: res({ ore: 1 }),
  })
})

test('actionBlockReason reports no pieces and no spot', () => {
  const state = makeTestState()
  give(state, 0, res({ brick: 1, lumber: 1 }))
  state.players[0].roadsLeft = 0
  assert.deepEqual(actionBlockReason(state, 0, 'road'), { kind: 'noPieces' })

  const stateWithSpotMissing = makeTestState()
  give(stateWithSpotMissing, 0, res({ brick: 1, lumber: 1 }))
  assert.deepEqual(actionBlockReason(stateWithSpotMissing, 0, 'road'), { kind: 'noSpot' })
})

test('actionBlockReason reports deck empty after affordability', () => {
  const state = makeTestState()
  give(state, 0, res({ wool: 1, grain: 1, ore: 1 }))
  state.devDeck = []
  assert.deepEqual(actionBlockReason(state, 0, 'devCard'), { kind: 'deckEmpty' })
})

test('actionBlockReason returns null when the action is available', () => {
  const state = makeTestState()
  give(state, 0, res({ wool: 1, grain: 1, ore: 1 }))
  assert.equal(actionBlockReason(state, 0, 'devCard'), null)
})

test('formatActionBlockReason builds the short reason text', () => {
  assert.equal(formatActionBlockReason({ kind: 'resources', missing: res({ ore: 1, wool: 1 }) }, messages), 'Need 1 wool, 1 ore')
  assert.equal(formatActionBlockReason({ kind: 'noSpot' }, messages), 'No legal spot')
  assert.equal(formatActionBlockReason({ kind: 'noPieces' }, messages), 'No pieces left')
  assert.equal(formatActionBlockReason({ kind: 'deckEmpty' }, messages), 'Deck is empty')
  assert.equal(formatActionBlockReason({ kind: 'rollFirst' }, messages), 'Roll first')
})
