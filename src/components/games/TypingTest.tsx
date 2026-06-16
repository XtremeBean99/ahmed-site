'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { GameStat } from './GameStat'
import { Button } from '@/components/ui/Button'
import { diffChars, computeWpm, computeAccuracy, countCorrect } from '@/lib/games/wpm'
import { pickRandomPhrase } from '@/lib/games/phrases'
import { getBest, setBestIfHigher, BEST_KEYS } from '@/lib/games/storage'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'running' | 'finished'

export function TypingTest() {
  const reduce = useReducedMotion()
  const [phrase, setPhrase] = useState('')
  const [typed, setTyped] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState(0)
  const [best, setBest] = useState(0)
  const [isNewBest, setIsNewBest] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Pick the first phrase on mount (client-only avoids hydration mismatch).
  useEffect(() => {
    setPhrase(pickRandomPhrase())
    setBest(getBest(BEST_KEYS.typing))
  }, [])

  // Live ticker while running, to refresh WPM/accuracy ~6x/sec.
  useEffect(() => {
    if (status !== 'running') return
    const id = window.setInterval(() => setNowTick((t) => t + 1), 160)
    return () => window.clearInterval(id)
  }, [status])

  const elapsedMs = startedAt ? Date.now() - startedAt : 0
  // nowTick is read so the interval forces recompute.
  void nowTick

  const correct = useMemo(() => countCorrect(phrase, typed), [phrase, typed])
  const wpm = computeWpm(correct, elapsedMs)
  const accuracy = computeAccuracy(correct, typed.length)
  const chars = useMemo(() => diffChars(phrase, typed), [phrase, typed])

  const finish = useCallback(
    (finalElapsed: number) => {
      const finalCorrect = countCorrect(phrase, phrase)
      const finalWpm = computeWpm(finalCorrect, finalElapsed)
      const beat = setBestIfHigher(BEST_KEYS.typing, finalWpm)
      if (beat) setBest(finalWpm)
      setIsNewBest(beat)
      setStatus('finished')
    },
    [phrase],
  )

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (status === 'finished') return
      const next = e.target.value.slice(0, phrase.length)
      let begin = startedAt
      if (status === 'idle') {
        begin = Date.now()
        setStartedAt(begin)
        setStatus('running')
      }
      setTyped(next)
      if (next.length === phrase.length) {
        finish(Date.now() - (begin ?? Date.now()))
      }
    },
    [status, phrase.length, startedAt, finish],
  )

  const restart = useCallback(() => {
    setPhrase((prev) => pickRandomPhrase(prev))
    setTyped('')
    setStatus('idle')
    setStartedAt(null)
    setIsNewBest(false)
    inputRef.current?.focus()
  }, [])

  const finalSeconds = startedAt && status === 'finished' ? Math.max(elapsedMs / 1000, 0) : 0

  return (
    <div className="max-w-3xl">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 border-y border-border py-6">
        <GameStat label="WPM" value={wpm} />
        <GameStat label="Accuracy" value={`${accuracy}%`} />
        <GameStat label="Best WPM" value={best} />
      </div>

      {/* Phrase */}
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className="mt-10 w-full text-left rounded-lg border border-border bg-surface p-8 cursor-text focus:outline-none"
        aria-label="Focus typing area"
      >
        <p className="font-serif text-2xl md:text-3xl leading-relaxed tracking-wide">
          {chars.map((c, i) => (
            <span
              key={i}
              className={cn(
                'transition-colors',
                c.status === 'untyped' && 'text-muted',
                c.status === 'correct' && 'text-foreground',
                c.status === 'incorrect' && 'text-muted-foreground underline decoration-2 underline-offset-4',
                c.status === 'current' &&
                  cn('text-muted relative', !reduce && 'border-l-2 border-foreground animate-pulse'),
              )}
            >
              {c.char === ' ' ? '\u00A0' : c.char}
            </span>
          ))}
        </p>
      </button>

      {/* Hidden input drives capture; kept off-screen but focusable. */}
      <input
        ref={inputRef}
        value={typed}
        onChange={onChange}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-label="Type the phrase above"
        className="sr-only"
      />

      {/* Result + controls */}
      <div className="mt-8 flex items-center gap-4" aria-live="polite">
        {status === 'finished' && (
          <p className="text-sm text-muted-foreground">
            {wpm} WPM at {accuracy}% accuracy in {finalSeconds.toFixed(1)}s.
            {isNewBest ? ' New personal best.' : ''}
          </p>
        )}
        <Button onClick={restart} className="ml-auto">
          {status === 'finished' ? 'Try another' : 'Restart'}
        </Button>
      </div>

      {status === 'idle' && (
        <p className="mt-4 text-xs text-muted">Start typing to begin. Backspace to correct.</p>
      )}
    </div>
  )
}
