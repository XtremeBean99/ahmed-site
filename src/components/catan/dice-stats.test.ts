import assert from 'node:assert/strict'
import test from 'node:test'
import type { GameEvent } from '@/lib/games/catan/types'
import { diceStats } from './dice-stats'

function roll(player: number, dice: [number, number], seq: number, turn: number): GameEvent {
  return { type: 'roll', player, dice, seq, turn }
}

test('diceStats counts roll events and computes expected frequencies', () => {
  const events: GameEvent[] = [
    roll(0, [1, 1], 1, 1),
    roll(1, [3, 4], 2, 2),
    roll(2, [4, 3], 3, 3),
    { type: 'built', player: 0, kind: 'road', at: 1, seq: 4, turn: 3 },
  ]
  const stats = diceStats(events)
  assert.equal(stats.rolls, 3)
  assert.equal(stats.counts[2], 1)
  assert.equal(stats.counts[7], 2)
  assert.equal(stats.counts[12], 0)
  assert.equal(stats.expected[2], 3 / 36)
  assert.equal(stats.expected[7], 18 / 36)
  assert.equal(stats.expected[12], 3 / 36)
})

test('diceStats returns zeros for an empty log', () => {
  const stats = diceStats([])
  assert.equal(stats.rolls, 0)
  assert.deepEqual(stats.counts, Array(13).fill(0))
  assert.deepEqual(stats.expected, Array(13).fill(0))
})
