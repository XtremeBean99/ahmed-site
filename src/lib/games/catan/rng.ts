/** mulberry32 over a mutable holder, so the stream lives in GameState and survives save/resume. */
export function nextFloat(holder: { rng: number }): number {
  let t = (holder.rng = (holder.rng + 0x6d2b79f5) | 0)
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Integer in [0, n). */
export function nextInt(holder: { rng: number }, n: number): number {
  return Math.floor(nextFloat(holder) * n)
}

/** Fisher-Yates, in place. */
export function shuffle<T>(holder: { rng: number }, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(holder, i + 1)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}
