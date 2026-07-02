const NS = 'ahmed-site:games'
const STORAGE_VERSION = 1

/** Returns a versioned key prefix: 'ahmed-site:games:v1:' */
const vk = (key: string) => `${NS}:v${STORAGE_VERSION}:${key}`

export const BEST_KEYS = {
  typing: 'typing-best',
  breakout: 'breakout-best',
} as const

/** Read a numeric best score. SSR-safe; returns 0 on any failure. */
export function getBest(key: string): number {
  if (typeof window === 'undefined') return 0
  try {
    const raw = window.localStorage.getItem(vk(key))
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
      window.localStorage.setItem(vk(key), String(value))
      return true
    }
    return false
  } catch {
    return false
  }
}

export const SCORES_KEYS = {
  breakout: 'breakout-scores',
} as const

export function getTopScores(key: string, n = 5): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(vk(key))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return (parsed as unknown[])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .slice(0, n)
  } catch {
    return []
  }
}

export function addScore(key: string, value: number, n = 5): void {
  if (typeof window === 'undefined') return
  if (!Number.isFinite(value) || value <= 0) return
  try {
    const current = getTopScores(key, n)
    const updated = [...current, value].sort((a, b) => b - a).slice(0, n)
    window.localStorage.setItem(vk(key), JSON.stringify(updated))
  } catch {}
}
