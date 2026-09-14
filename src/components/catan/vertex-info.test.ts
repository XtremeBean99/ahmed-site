import assert from 'node:assert/strict'
import test from 'node:test'
import { makeTestState } from '@/lib/games/catan/test-fixtures'
import { vertexDescription, type VertexInfoMessages } from './vertex-info'

const messages: VertexInfoMessages = {
  pips: '{pips} pips: {hexes}',
  harbourAny: '3:1 harbour',
  harbourResource: '2:1 {resource} harbour',
  robberSuffix: '(robber)',
  terrain: {
    lumber: 'Lumber',
    wool: 'Wool',
    grain: 'Grain',
    brick: 'Brick',
    ore: 'Ore',
    desert: 'Desert',
  },
}

test('vertexDescription lists per-hex yields and total pips', () => {
  const state = makeTestState()
  assert.equal(vertexDescription(state, 40, messages), '10 pips: Ore 3, Grain 4, Grain 6')
})

test('vertexDescription marks the robber hex and counts it as 0 pips', () => {
  const state = makeTestState()
  assert.equal(vertexDescription(state, 30, messages), '5 pips: Desert (robber), Lumber 3, Grain 4')

  state.robber = 0
  assert.equal(vertexDescription(state, 0, messages), '0 pips: Ore 10 (robber), 3:1 harbour')
  assert.equal(vertexDescription(state, 30, messages), '5 pips: Desert, Lumber 3, Grain 4')
})

test('vertexDescription appends harbours using the port edge vertices', () => {
  const state = makeTestState()
  assert.equal(vertexDescription(state, 0, messages), '3 pips: Ore 10, 3:1 harbour')
  assert.equal(vertexDescription(state, 20, messages), '8 pips: Brick 10, Ore 8, 2:1 Brick harbour')
  assert.equal(vertexDescription(state, 43, messages), '9 pips: Lumber 8, Brick 5, 2:1 Ore harbour')
})
