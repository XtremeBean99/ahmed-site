/**
 * Gurtle: a word ladder to one place. Every puzzle starts on a four-letter
 * word and ends on GURT; each move changes exactly one letter and must land on
 * a real word. Par is the shortest ladder over everyday words (COMMON_WORDS),
 * so a player who knows a rarer word (EXTRA_WORDS) can come in under par.
 *
 * One daily puzzle for the whole world (the UTC date, like the Minesweeper
 * daily), plus practice puzzles at three lengths. Pure: no DOM, no storage.
 */
import { mulberry32, shuffle } from './cards'
import { dailyDate, GURTLE_LAUNCH_DATE, gurtleNumber } from './daily'
import { COMMON_WORDS, EXTRA_WORDS } from './gurtle-words'

export const TARGET = 'gurt'
export const WORD_LEN = 4
/** Gurtle #1. The puzzle number counts UTC days from here (kept in daily.ts, which the score API also reads). */
export const LAUNCH_DATE = GURTLE_LAUNCH_DATE

const WORD_RE = /^[a-z]{4}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface Lexicon {
  /** Every word a move may land on, the target included. */
  words: ReadonlySet<string>
  /** Everyday words (and the target): starts, par and hints use only these. */
  common: ReadonlySet<string>
  /** Moves to the target over everyday words only; a word missing here cannot reach it that way. */
  parDist: ReadonlyMap<string, number>
  /** Moves to the target over every word. */
  anyDist: ReadonlyMap<string, number>
  /** Words one letter away from `word` (which need not be in the lexicon itself). */
  neighbors: (word: string) => string[]
}

export function parseWordList(list: string): string[] {
  return list.split(/\s+/).map((w) => w.trim().toLowerCase()).filter((w) => WORD_RE.test(w))
}

/** Builds the word graph and both distance maps by breadth-first search out from the target. */
export function buildLexicon(commonList: string = COMMON_WORDS, extraList: string = EXTRA_WORDS): Lexicon {
  const common = new Set(parseWordList(commonList))
  common.add(TARGET)
  const words = new Set([...common, ...parseWordList(extraList)])

  // "g_rt" -> [gurt, girt]: two words share a bucket exactly when they differ in that one position.
  const buckets = new Map<string, string[]>()
  for (const w of words) {
    for (let i = 0; i < WORD_LEN; i++) {
      const key = w.slice(0, i) + '_' + w.slice(i + 1)
      const list = buckets.get(key)
      if (list) list.push(w)
      else buckets.set(key, [w])
    }
  }
  const neighbors = (word: string): string[] => {
    const out: string[] = []
    for (let i = 0; i < WORD_LEN; i++) {
      for (const n of buckets.get(word.slice(0, i) + '_' + word.slice(i + 1)) ?? []) if (n !== word) out.push(n)
    }
    return out
  }
  const bfs = (allowed: ReadonlySet<string>) => {
    const dist = new Map<string, number>([[TARGET, 0]])
    const queue = [TARGET]
    for (let head = 0; head < queue.length; head++) {
      const w = queue[head]
      const d = dist.get(w)!
      for (const n of neighbors(w)) {
        if (!allowed.has(n) || dist.has(n)) continue
        dist.set(n, d + 1)
        queue.push(n)
      }
    }
    return dist
  }
  return { words, common, parDist: bfs(common), anyDist: bfs(words), neighbors }
}

let shared: Lexicon | null = null
/** The game's lexicon, built once on first use (a few milliseconds). */
export function lexicon(): Lexicon {
  if (!shared) shared = buildLexicon()
  return shared
}

/** Positions where two equal-length words differ. */
export function diffPositions(a: string, b: string): number[] {
  const out: number[] = []
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) out.push(i)
  return out
}

/** Which letters of `word` already sit where GURT has them. */
export function tileHits(word: string): boolean[] {
  return Array.from({ length: WORD_LEN }, (_, i) => word[i] === TARGET[i])
}

/** Why a move is refused. */
export type MoveError = 'length' | 'notOneLetter' | 'notWord' | 'repeat' | 'over'

/** Checks `word` as the next rung after `ladder` (start first, current word last). */
export function checkMove(lex: Lexicon, ladder: readonly string[], word: string): MoveError | null {
  const current = ladder[ladder.length - 1]
  if (current === TARGET) return 'over'
  if (!WORD_RE.test(word)) return 'length'
  if (diffPositions(current, word).length !== 1) return 'notOneLetter'
  if (!lex.words.has(word)) return 'notWord'
  if (ladder.includes(word)) return 'repeat'
  return null
}

/**
 * The next word on a shortest route from `from` to the target. From an everyday
 * word it keeps to everyday words (the par route); from a rarer one it takes the
 * shortest route over every word, preferring everyday words along the way.
 * Ties go to the word with more letters already in place, then alphabetical,
 * so the hint for a word never changes. Null at the target or when stuck.
 */
export function nextStep(lex: Lexicon, from: string): string | null {
  if (from === TARGET) return null
  const rank = (a: string, b: string) => {
    const hits = (w: string) => tileHits(w).filter(Boolean).length
    return hits(b) - hits(a) || (a < b ? -1 : a > b ? 1 : 0)
  }
  const pd = lex.parDist.get(from)
  if (pd !== undefined && lex.common.has(from)) {
    const next = lex.neighbors(from).filter((n) => lex.common.has(n) && lex.parDist.get(n) === pd - 1).sort(rank)
    if (next.length) return next[0]
  }
  const ad = lex.anyDist.get(from)
  if (ad === undefined) return null
  const next = lex.neighbors(from).filter((n) => lex.anyDist.get(n) === ad - 1)
  next.sort((a, b) => {
    const ca = lex.common.has(a) ? 0 : 1
    const cb = lex.common.has(b) ? 0 : 1
    if (ca !== cb) return ca - cb
    const pa = lex.parDist.get(a) ?? Infinity
    const pb = lex.parDist.get(b) ?? Infinity
    return pa !== pb ? pa - pb : rank(a, b)
  })
  return next[0] ?? null
}

/** The words from `from` (not included) to the target (included), following nextStep. */
export function solve(lex: Lexicon, from: string): string[] {
  const out: string[] = []
  let w = from
  while (w !== TARGET) {
    const n = nextStep(lex, w)
    if (!n || out.length > 64) return []
    out.push(n)
    w = n
  }
  return out
}

/** Moves on the shortest everyday route, or null when there is none. */
export function parFor(lex: Lexicon, start: string): number | null {
  return lex.parDist.get(start) ?? null
}

export type Difficulty = 'easy' | 'medium' | 'hard'
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
/** Par range [min, max] for each practice length, and for the daily. */
export const DIFFICULTY_PAR: Record<Difficulty, readonly [number, number]> = { easy: [2, 3], medium: [4, 5], hard: [6, 8] }
export const DAILY_PAR = [4, 6] as const

/** Plain plurals ("cats") make dull starts; "boss", "this" and "plus" are fine. */
function looksPlural(w: string): boolean {
  return w.endsWith('s') && !/(ss|us|is)$/.test(w)
}

/** Everyday, non-plural start words whose par falls in `range`, sorted. */
export function startPool(lex: Lexicon, range: readonly [number, number]): string[] {
  const out: string[] = []
  for (const w of lex.common) {
    if (w === TARGET || looksPlural(w)) continue
    const p = lex.parDist.get(w)
    if (p !== undefined && p >= range[0] && p <= range[1]) out.push(w)
  }
  return out.sort()
}

/** Gurtle #n for a UTC date (#1 on LAUNCH_DATE). */
export const puzzleNumber = gurtleNumber

/**
 * The day's start word: the daily pool in a fixed shuffled order, one word per
 * day, so no word comes round again until the whole pool has been played.
 */
export function dailyStart(lex: Lexicon, date: string): string {
  const pool = shuffle(startPool(lex, DAILY_PAR), mulberry32(0x6775_7274)) // "gurt"
  const n = puzzleNumber(date) - 1
  return pool[((n % pool.length) + pool.length) % pool.length]
}

/** A random practice start of the given length, never `avoid` (the one just played). */
export function practiceStart(lex: Lexicon, difficulty: Difficulty, rng: () => number = Math.random, avoid?: string): string {
  const pool = startPool(lex, DIFFICULTY_PAR[difficulty]).filter((w) => w !== avoid)
  return pool[Math.floor(rng() * pool.length)]
}

export type GameMode = 'daily' | 'practice'
export type GameStatus = 'playing' | 'won' | 'gaveUp'

export interface GurtleGame {
  mode: GameMode
  /** The puzzle's UTC date, for a daily. */
  date: string | null
  difficulty: Difficulty | null
  start: string
  par: number
  /** Words played after the start, in order. The last one is the current word. */
  moves: string[]
  hints: number
  status: GameStatus
  /** After giving up: Gurtle's route from the current word to the target. */
  reveal: string[]
}

export function newGame(lex: Lexicon, start: string, opts: { mode: GameMode; date?: string | null; difficulty?: Difficulty | null }): GurtleGame {
  return {
    mode: opts.mode,
    date: opts.date ?? null,
    difficulty: opts.difficulty ?? null,
    start,
    par: parFor(lex, start) ?? 0,
    moves: [],
    hints: 0,
    status: 'playing',
    reveal: [],
  }
}

export function newDaily(lex: Lexicon, date: string = dailyDate()): GurtleGame {
  return newGame(lex, dailyStart(lex, date), { mode: 'daily', date })
}

export function newPractice(lex: Lexicon, difficulty: Difficulty, rng?: () => number, avoid?: string): GurtleGame {
  return newGame(lex, practiceStart(lex, difficulty, rng, avoid), { mode: 'practice', difficulty })
}

/** Start word first, then every move. */
export function ladderOf(g: GurtleGame): string[] {
  return [g.start, ...g.moves]
}

export function currentWord(g: GurtleGame): string {
  return g.moves.length ? g.moves[g.moves.length - 1] : g.start
}

/** Plays a move: the game unchanged and the reason, or the new game. */
export function playMove(lex: Lexicon, g: GurtleGame, raw: string): { game: GurtleGame; error: MoveError | null } {
  if (g.status !== 'playing') return { game: g, error: 'over' }
  const word = raw.toLowerCase()
  const error = checkMove(lex, ladderOf(g), word)
  if (error) return { game: g, error }
  const moves = [...g.moves, word]
  return { game: { ...g, moves, status: word === TARGET ? 'won' : 'playing' }, error: null }
}

/** Takes the last move back. */
export function undoMove(g: GurtleGame): GurtleGame {
  if (g.status !== 'playing' || g.moves.length === 0) return g
  return { ...g, moves: g.moves.slice(0, -1) }
}

/** Counts a hint and returns the word it suggests. */
export function takeHint(lex: Lexicon, g: GurtleGame): { game: GurtleGame; hint: string | null } {
  if (g.status !== 'playing') return { game: g, hint: null }
  const hint = nextStep(lex, currentWord(g))
  return { game: hint ? { ...g, hints: g.hints + 1 } : g, hint }
}

/** Ends the game and shows Gurtle's route home from where the player stands. */
export function giveUp(lex: Lexicon, g: GurtleGame): GurtleGame {
  if (g.status !== 'playing') return g
  return { ...g, status: 'gaveUp', reveal: solve(lex, currentWord(g)) }
}

/** How the moves left from the last word compare with the moves left before it. */
export type Trend = 'closer' | 'same' | 'further'
export function moveTrend(lex: Lexicon, before: string, after: string): Trend {
  const a = lex.anyDist.get(before) ?? Infinity
  const b = lex.anyDist.get(after) ?? Infinity
  return b < a ? 'closer' : b > a ? 'further' : 'same'
}

export type Rating = 'under' | 'par' | 'bogey' | 'double' | 'slow'
export function rateRun(moves: number, par: number): Rating {
  const d = moves - par
  return d < 0 ? 'under' : d === 0 ? 'par' : d === 1 ? 'bogey' : d === 2 ? 'double' : 'slow'
}

/** The emoji ladder for a share card: green where a letter sits where GURT has it. */
export function shareGrid(g: GurtleGame): string {
  const rows = g.status === 'gaveUp' ? [...ladderOf(g), ...g.reveal] : ladderOf(g)
  return rows.map((w) => tileHits(w).map((h) => (h ? '🟩' : '⬜')).join('')).join('\n')
}

/** A saved game read back from storage, or null when it is not a playable, consistent game. */
export function parseGame(lex: Lexicon, v: unknown): GurtleGame | null {
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  const mode = r.mode === 'daily' || r.mode === 'practice' ? r.mode : null
  if (!mode || typeof r.start !== 'string' || !lex.common.has(r.start) || r.start === TARGET) return null
  if (!Array.isArray(r.moves) || r.moves.length > 200 || !r.moves.every((m) => typeof m === 'string')) return null
  const date = typeof r.date === 'string' && DATE_RE.test(r.date) ? r.date : null
  if (mode === 'daily' && !date) return null
  const difficulty = DIFFICULTIES.includes(r.difficulty as Difficulty) ? (r.difficulty as Difficulty) : null
  let g = newGame(lex, r.start, { mode, date, difficulty })
  for (const m of r.moves as string[]) {
    const res = playMove(lex, g, m)
    if (res.error) return null
    g = res.game
  }
  const hints = typeof r.hints === 'number' && Number.isInteger(r.hints) && r.hints >= 0 ? Math.min(r.hints, 999) : 0
  g = { ...g, hints }
  if (r.status === 'gaveUp' && g.status === 'playing') g = giveUp(lex, g)
  return g
}

/** The daily record: played and finished days, streaks and how each finish compared with par. */
export interface GurtleStats {
  played: number
  won: number
  streak: number
  maxStreak: number
  /** The last daily date recorded, so a day is never counted twice. */
  lastDate: string | null
  /** Wins by moves over par: [at or under, +1, +2, +3, +4 or more]. */
  dist: number[]
}

export const EMPTY_STATS: GurtleStats = { played: 0, won: 0, streak: 0, maxStreak: 0, lastDate: null, dist: [0, 0, 0, 0, 0] }

function prevDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
}

/** Adds a finished daily to the record. Won days extend the streak; giving up ends it. */
export function recordDaily(stats: GurtleStats, g: GurtleGame): GurtleStats {
  if (g.mode !== 'daily' || !g.date || g.status === 'playing' || stats.lastDate === g.date) return stats
  const won = g.status === 'won'
  const dist = [...stats.dist]
  if (won) dist[Math.min(4, Math.max(0, g.moves.length - g.par))]++
  const streak = won ? (stats.lastDate === prevDate(g.date) ? stats.streak : 0) + 1 : 0
  return {
    played: stats.played + 1,
    won: stats.won + (won ? 1 : 0),
    streak,
    maxStreak: Math.max(stats.maxStreak, streak),
    lastDate: g.date,
    dist,
  }
}

/** The streak as it stands today: it lapses once a whole day goes by unplayed. */
export function liveStreak(stats: GurtleStats, today: string): number {
  if (!stats.lastDate) return 0
  return stats.lastDate === today || stats.lastDate === prevDate(today) ? stats.streak : 0
}

export function parseStats(v: unknown): GurtleStats {
  if (!v || typeof v !== 'object') return EMPTY_STATS
  const r = v as Record<string, unknown>
  const n = (x: unknown) => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : 0)
  const dist = Array.isArray(r.dist) && r.dist.length === 5 ? r.dist.map(n) : [0, 0, 0, 0, 0]
  return {
    played: n(r.played),
    won: n(r.won),
    streak: n(r.streak),
    maxStreak: n(r.maxStreak),
    lastDate: typeof r.lastDate === 'string' && DATE_RE.test(r.lastDate) ? r.lastDate : null,
    dist,
  }
}
