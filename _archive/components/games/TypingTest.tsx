'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { GameStat } from './GameStat'
import { Button } from '@/components/ui/Button'
import { diffChars, computeWpm, computeAccuracy, countCorrect } from '@/lib/games/wpm'
import { pickRandomPhrase } from '@/lib/games/phrases'
import { getBest, setBestIfHigher, BEST_KEYS } from '@/lib/games/storage'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/client'

type Status = 'idle' | 'running' | 'finished'

export function TypingTest() {
  const reduce = useReducedMotion()
  const t = useT().typing
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
        <GameStat label={t.wpm} value={wpm} />
        <GameStat label={t.accuracy} value={`${accuracy}%`} />
        <GameStat label={t.bestWpm} value={best} />
      </div>

      {/* Phrase + capture input. The input overlays the phrase at full size and
          is transparent: a direct tap focuses it within the user gesture, which
          reliably summons the on-screen keyboard on mobile (an off-screen
          sr-only input often does not). */}
      <div
        className="relative mt-10 w-full rounded-lg border border-border bg-surface p-8 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <p className="font-serif text-2xl md:text-3xl leading-relaxed tracking-wide whitespace-pre-wrap break-words">
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
              {c.char}
            </span>
          ))}
        </p>
        {status === 'idle' && typed.length === 0 && (
          <span className="pointer-events-none absolute bottom-2 right-3 text-xs text-muted md:hidden">
            {t.tapToType}
          </span>
        )}
        <input
          ref={inputRef}
          value={typed}
          onChange={onChange}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="done"
          aria-label={t.typeHere}
          className="absolute inset-0 h-full w-full cursor-text resize-none bg-transparent p-8 text-transparent caret-transparent opacity-0 focus:outline-none"
        />
      </div>

      {/* Result + controls */}
      <div className="mt-8 flex items-center gap-4" aria-live="polite">
        {status === 'finished' && (
          <p className="text-sm text-muted-foreground">
            {wpm} {t.resultBefore}{accuracy}{t.resultAccuracyIn}{finalSeconds.toFixed(1)}{t.resultSeconds}
            {isNewBest ? t.newBest : ''}
          </p>
        )}
        <Button onClick={restart} className="ml-auto">
          {status === 'finished' ? t.tryAnother : t.restart}
        </Button>
      </div>

      {status === 'idle' && (
        <p className="mt-4 text-xs text-muted">{t.startHint}</p>
      )}
    </div>
  )
}
