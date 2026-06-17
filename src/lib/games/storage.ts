const NS = 'ahmed-site:games'

export const BEST_KEYS = {
  typing: 'typing-best',
  breakout: 'breakout-best',
  contract: 'contract-best',
} as const

/** Read a numeric best score. SSR-safe; returns 0 on any failure. */
export function getBest(key: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(`${NS}:${key}`)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/** Write value only if it beats the stored best. Returns true if it was a new best. */
export function setBestIfHigher(key: string, value: number): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (value > getBest(key)) {
      window.localStorage.setItem(`${NS}:${key}`, String(value))
      return true
    }
    return false
  } catch {
    return false
  }
}
