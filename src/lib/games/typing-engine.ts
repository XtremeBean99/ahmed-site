import { computeAccuracy, computeWpm, countCorrect } from './wpm'

/**
 * Pure engine for the desk typing test: a timed run through shuffled phrases.
 * The clock starts on the first character; a phrase advances once it is typed
 * to its full length (mistakes and all, like a real test); WPM counts correct
 * characters only, accuracy counts every keystroke as typed (backspacing a
 * mistake does not erase it).
 */
export const TYPING_DURATIONS = [15, 30, 60] as const
export type TypingDuration = (typeof TYPING_DURATIONS)[number]

export interface TypingState {
  /** Phrase indices in play order. */
  order: number[]
  /** Position in `order` of the phrase being typed. */
  pos: number
  /** What is typed of the current phrase. */
  typed: string
  /** Correct characters in finished phrases. */
  doneCorrect: number
  /** Every character keystroke so far, and the ones that matched when typed. */
  keystrokes: number
  goodKeystrokes: number
  duration: TypingDuration
  /** ms timestamp of the first keystroke, or null before it. */
  startedAt: number | null
  status: 'ready' | 'running' | 'done'
}

/** Fisher-Yates over the phrase indices with the given random source. */
export function shuffledOrder(count: number, rng: () => number): number[] {
  const order = Array.from({ length: count }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

export function newTest(phraseCount: number, duration: TypingDuration, rng: () => number = Math.random): TypingState {
  return {
    order: shuffledOrder(phraseCount, rng),
    pos: 0,
    typed: '',
    doneCorrect: 0,
    keystrokes: 0,
    goodKeystrokes: 0,
    duration,
    startedAt: null,
    status: 'ready',
  }
}

export function currentPhrase(s: TypingState, phrases: readonly string[]): string {
  return phrases[s.order[s.pos % s.order.length]]
}

export function nextPhrase(s: TypingState, phrases: readonly string[]): string {
  return phrases[s.order[(s.pos + 1) % s.order.length]]
}

/**
 * The input box now reads `value`. Counts the characters it added as
 * keystrokes, starts the clock on the first one, and moves to the next phrase
 * when the current one is typed to its length. Ignored once the test is done.
 */
export function typeInput(s: TypingState, value: string, phrases: readonly string[], now: number): TypingState {
  if (s.status === 'done') return s
  const target = currentPhrase(s, phrases)
  const next = value.slice(0, target.length)
  let keystrokes = s.keystrokes
  let good = s.goodKeystrokes
  // Characters added past what was there (a paste or autocorrect may add several).
  if (next.length > s.typed.length && next.startsWith(s.typed)) {
    for (let i = s.typed.length; i < next.length; i++) {
      keystrokes++
      if (next[i] === target[i]) good++
    }
  } else if (next.length > s.typed.length) {
    // The earlier text changed too (autocorrect): count only the length gained.
    for (let i = s.typed.length; i < next.length; i++) keystrokes++
  }
  const startedAt = s.startedAt ?? (next.length > 0 ? now : null)
  const base: TypingState = {
    ...s,
    typed: next,
    keystrokes,
    goodKeystrokes: good,
    startedAt,
    status: startedAt === null ? 'ready' : 'running',
  }
  if (next.length < target.length) return base
  return { ...base, pos: s.pos + 1, typed: '', doneCorrect: s.doneCorrect + countCorrect(target, next) }
}

/** Ends the test once its time is up. */
export function tick(s: TypingState, now: number): TypingState {
  if (s.status !== 'running' || s.startedAt === null) return s
  return now - s.startedAt >= s.duration * 1000 ? { ...s, status: 'done' } : s
}

export function elapsedMs(s: TypingState, now: number): number {
  if (s.startedAt === null) return 0
  return Math.min(now - s.startedAt, s.duration * 1000)
}

export function secondsLeft(s: TypingState, now: number): number {
  return Math.max(0, Math.ceil((s.duration * 1000 - elapsedMs(s, now)) / 1000))
}

export interface TypingStats { wpm: number; accuracy: number; correct: number; phrases: number }

export function stats(s: TypingState, phrases: readonly string[], now: number): TypingStats {
  const correct = s.doneCorrect + countCorrect(currentPhrase(s, phrases), s.typed)
  // The first second's WPM swings wildly; hold it at 0 until a second has passed.
  const ms = elapsedMs(s, now)
  return {
    wpm: ms < 1000 ? 0 : computeWpm(correct, ms),
    accuracy: computeAccuracy(s.goodKeystrokes, s.keystrokes),
    correct,
    phrases: s.pos,
  }
}
