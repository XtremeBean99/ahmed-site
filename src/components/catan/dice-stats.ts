import type { GameEvent } from '@/lib/games/catan/types'

export interface DiceStats {
  rolls: number
  /** counts[total] for totals 2..12; indexes 0 and 1 are always 0. */
  counts: number[]
  /** Expected count for each total given the number of rolls (out of 36 combinations). */
  expected: number[]
}

const COMBINATIONS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]

/** Counts dice totals from the roll events still held in the log. */
export function diceStats(events: readonly GameEvent[]): DiceStats {
  const counts = Array<number>(13).fill(0)
  let rolls = 0
  for (const event of events) {
    if (event.type !== 'roll') continue
    counts[event.dice[0] + event.dice[1]] += 1
    rolls += 1
  }
  const expected = counts.map((_, total) => (rolls * COMBINATIONS[total]) / 36)
  return { rolls, counts, expected }
}
