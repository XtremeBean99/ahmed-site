/**
 * Daily challenge: every visitor gets the same board for the day, one try
 * each, and a public top 10 for that day only. The day is the UTC date, so
 * everyone in the world shares a board; the seed is a hash of game + date.
 */
export const DAILY_GAMES = ['minesweeper'] as const
export type DailyGameId = (typeof DAILY_GAMES)[number]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** The UTC date `now` falls on, as YYYY-MM-DD. */
export function dailyDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** 32-bit FNV-1a of `game:date`: the seed for that day's board. */
export function dailySeed(game: string, date: string): number {
  let h = 0x811c9dc5
  const s = `${game}:${date}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * Dates the server takes a daily score for: today, or yesterday (UTC) so a
 * game finished just after midnight still counts for the board it was played on.
 */
export function isAcceptedDailyDate(date: string, now: Date = new Date()): boolean {
  if (!DATE_RE.test(date)) return false
  const today = dailyDate(now)
  const yesterday = dailyDate(new Date(now.getTime() - 86_400_000))
  return date === today || date === yesterday
}

/** Milliseconds until the next UTC midnight, when a new board comes out. */
export function msUntilNextDaily(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return next - now.getTime()
}

/** What the browser remembers about today's attempt (one try a day). */
export interface DailyResult {
  date: string
  won: boolean
  /** Seconds, for a win. */
  time: number
}

export function parseDailyResult(v: unknown): DailyResult | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (typeof r.date !== 'string' || !DATE_RE.test(r.date)) return null
  if (typeof r.won !== 'boolean' || typeof r.time !== 'number' || !Number.isFinite(r.time)) return null
  return { date: r.date, won: r.won, time: r.time }
}
