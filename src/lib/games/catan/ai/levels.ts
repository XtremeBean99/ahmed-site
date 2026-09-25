import type { BotLevel, GameState, PlayerId } from '../types'

/** mulberry32 over a local seed; never touches state.rng. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Read-only variety source for a bot decision: same state always hashes the same stream. */
export function botRandom(state: GameState, bot: PlayerId): () => number {
  return mulberry32((state.rng ^ Math.imul(state.eventSeq + 1, 0x9e3779b1) ^ Math.imul(bot, 0x85ebca6b)) | 0)
}

export function levelOf(state: GameState, bot: PlayerId, opts?: { level?: BotLevel }): BotLevel {
  return opts?.level ?? state.players[bot].level
}

export function maxProposalsFor(level: BotLevel): number {
  return level === 'easy' ? 1 : 2
}

export function pickWeighted<T>(rand: () => number, items: T[], weights: number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0)
  let roll = rand() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll < 0) return items[i]
  }
  return items[items.length - 1]
}
