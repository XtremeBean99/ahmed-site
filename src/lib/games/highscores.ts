import { BEST_KEYS } from './storage'
import { dailyDate, gurtleNumber } from './daily'

/**
 * The games with a public top 10 (the Highscores desk app and /api/highscores).
 * `key` is where the game keeps the visitor's own best in games storage;
 * `max` (and `min`) bound what the server accepts, generous enough for any
 * honest game: scores come from the browser, so they keep out the absurd, not
 * the determined. Minesweeper is a time, so lower ranks higher. Gurtle's is
 * the longest daily streak, which can never be more days than there have been
 * puzzles (checked in isPlausibleScore).
 */
export const HISCORE_GAMES = [
  { id: 'typing', key: BEST_KEYS.typing, lowerIsBetter: false, min: 1, max: 250 },
  { id: 'snake', key: BEST_KEYS.snake, lowerIsBetter: false, min: 1, max: 196 },
  { id: 'minesweeper', key: BEST_KEYS.minesweeper, lowerIsBetter: true, min: 3, max: 999 },
  { id: 'breakout', key: BEST_KEYS.breakoutDesk, lowerIsBetter: false, min: 1, max: 500_000 },
  { id: 'pong', key: BEST_KEYS.pong, lowerIsBetter: false, min: 1, max: 9_999 },
  { id: 'blackjack', key: BEST_KEYS.blackjack, lowerIsBetter: false, min: 1, max: 10_000_000 },
  { id: 'solitaire', key: BEST_KEYS.solitaire, lowerIsBetter: false, min: 1, max: 100_000 },
  { id: 'gurtle', key: BEST_KEYS.gurtleStreak, lowerIsBetter: false, min: 1, max: 3_650 },
] as const

export type HiscoreGameId = (typeof HISCORE_GAMES)[number]['id']
export const HISCORE_GAME_IDS = HISCORE_GAMES.map((g) => g.id) as [HiscoreGameId, ...HiscoreGameId[]]

export interface HiscoreEntry {
  name: string
  score: number
}

/** How many entries each public board shows. */
export const BOARD_SIZE = 10

export function hiscoreGame(id: string) {
  return HISCORE_GAMES.find((g) => g.id === id)
}

/**
 * True when `score` is a whole number the server would accept for `id`. A Gurtle
 * streak can't outrun the puzzles out so far (one day's grace for a fast clock).
 */
export function isPlausibleScore(id: string, score: number, now: Date = new Date()): boolean {
  const g = hiscoreGame(id)
  if (!g || !Number.isInteger(score) || score < g.min || score > g.max) return false
  if (id === 'gurtle' && score > gurtleNumber(dailyDate(now)) + 1) return false
  return true
}

/** Sorts a board best first. */
export function sortBoard(id: string, entries: HiscoreEntry[]): HiscoreEntry[] {
  const lower = hiscoreGame(id)?.lowerIsBetter ?? false
  return [...entries].sort((a, b) => (lower ? a.score - b.score : b.score - a.score))
}
