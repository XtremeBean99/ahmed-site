import assert from 'node:assert/strict'
import test from 'node:test'
import { diceOdds, diceOddsText } from './dice-odds'

test('diceOdds reports combinations and rounded percent', () => {
  assert.deepEqual(diceOdds(2), { combinations: 1, percent: 3 })
  assert.deepEqual(diceOdds(7), { combinations: 6, percent: 17 })
  assert.deepEqual(diceOdds(8), { combinations: 5, percent: 14 })
  assert.deepEqual(diceOdds(12), { combinations: 1, percent: 3 })
  assert.deepEqual(diceOdds(0), { combinations: 0, percent: 0 })
  assert.deepEqual(diceOdds(13), { combinations: 0, percent: 0 })
})

test('diceOddsText formats the chance', () => {
  assert.equal(diceOddsText(8), '8: 5/36, about 14%')
  assert.equal(diceOddsText(7), '7: 6/36, about 17%')
})
