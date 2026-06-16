import type { CharState } from './types'

/** Standard WPM: (correct chars / 5) per minute. Returns 0 before any time elapses. */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0
  const minutes = elapsedMs / 60000
  return Math.round(correctChars / 5 / minutes)
}

/** Accuracy as a 0-100 integer. 100 when nothing has been typed yet. */
export function computeAccuracy(correctChars: number, typedChars: number): number {
  if (typedChars <= 0) return 100
  return Math.round((correctChars / typedChars) * 100)
}

/** Count characters typed so far that match the target at the same index. */
export function countCorrect(target: string, typed: string): number {
  let n = 0
  const len = Math.min(typed.length, target.length)
  for (let i = 0; i < len; i++) {
    if (typed[i] === target[i]) n++
  }
  return n
}

/** Per-character render state for the target phrase given current input. */
export function diffChars(target: string, typed: string): CharState[] {
  return target.split('').map((char, i) => {
    let status: CharState['status']
    if (i < typed.length) status = typed[i] === char ? 'correct' : 'incorrect'
    else if (i === typed.length) status = 'current'
    else status = 'untyped'
    return { char, status }
  })
}
