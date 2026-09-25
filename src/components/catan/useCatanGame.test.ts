import assert from 'node:assert/strict'
import test from 'node:test'
import { saveKeyFor } from '@/lib/games/catan/save'
import { tutorialExitClearKeys } from './useCatanGame'

test('leaving the tutorial only clears the tutorial save, never the normal game save', () => {
  const keys = tutorialExitClearKeys()
  assert.deepEqual(keys, [saveKeyFor('tutorial')])
  assert.ok(!keys.includes(saveKeyFor('game')))
})
