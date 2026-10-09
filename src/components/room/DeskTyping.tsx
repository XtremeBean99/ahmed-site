'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScreenStrip, StripButton, useDeskScreen } from './ScreenStrip'
import { ARCADE, ArcadeButton, ArcadeFrame, PIXEL_FONT, useFullscreen, type ArcadeLabels } from './DeskArcade'
import { useStageScale } from '@/lib/room/useStageScale'
import { phrases } from '@/lib/games/phrases'
import { diffChars } from '@/lib/games/wpm'
import { BEST_KEYS, getBest, setBestIfHigher } from '@/lib/games/storage'
import {
  TYPING_DURATIONS, currentPhrase, newTest, nextPhrase, secondsLeft, stats, tick, typeInput,
  type TypingDuration, type TypingState,
} from '@/lib/games/typing-engine'

export interface TypingLabels {
  title: string
  wpm: string
  accuracy: string
  time: string
  best: string
  newTest: string
  duration: string
  seconds: string
  start: string
  startTouch: string
  done: string
  newBest: string
  result: string
  again: string
  highscores: string
  input: string
}

interface DeskTypingProps {
  time: string
  backLabel: string
  desktopLabel: string
  labels: TypingLabels
  arcade: ArcadeLabels
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
  /** Opens another desk app (the result card's Highscores button). */
  onOpenApp?: (app: string) => void
}

const STATUS = { correct: ARCADE.ink, incorrect: ARCADE.rust, current: ARCADE.ink, untyped: ARCADE.inkSoft } as const

/**
 * Typing speed test on the desk monitor: shuffled phrases against a 15, 30 or
 * 60 second clock that starts on the first key. Typing goes into a transparent
 * input laid over the text, so phone keyboards and IME work like a real field.
 * The best WPM is kept in games storage (BEST_KEYS.typing) for the Highscores app.
 */
export function DeskTyping({ time, backLabel, desktopLabel, labels, onBack, onDesktop, onOpenApp }: DeskTypingProps) {
  const fs = useFullscreen()
  const { portrait } = useDeskScreen()
  const { mobile } = useStageScale()
  const touch = portrait || mobile
  const [duration, setDuration] = useState<TypingDuration>(30)
  const [game, setGame] = useState<TypingState>(() => newTest(phrases.length, 30))
  const [now, setNow] = useState(0)
  const [best, setBest] = useState(0)
  const [newBest, setNewBest] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setBest(getBest(BEST_KEYS.typing)) }, [])

  const restart = useCallback((d: TypingDuration = duration) => {
    setDuration(d)
    setGame(newTest(phrases.length, d))
    setNow(0)
    setNewBest(false)
    // A mouse on the desk keeps typing straight away; on touch, focusing would pop the keyboard unasked.
    if (!touch) setTimeout(() => inputRef.current?.focus(), 0)
  }, [duration, touch])

  // Focus the field on open with a keyboard at hand.
  useEffect(() => { if (!touch) inputRef.current?.focus() }, [touch])

  // The clock: 10 Hz while running, ending the test when time is up.
  const running = game.status === 'running'
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      setGame((g) => tick(g, t))
    }, 100)
    return () => clearInterval(id)
  }, [running])

  const done = game.status === 'done'
  const result = useMemo(() => stats(game, phrases, game.startedAt === null ? 0 : done ? game.startedAt + game.duration * 1000 : now), [game, now, done])

  // Record the best once, when the test ends.
  const recorded = useRef<TypingState | null>(null)
  useEffect(() => {
    if (!done || recorded.current === game) return
    recorded.current = game
    if (result.wpm > 0 && setBestIfHigher(BEST_KEYS.typing, result.wpm)) {
      setBest(result.wpm)
      setNewBest(true)
    }
    inputRef.current?.blur()
  }, [done, game, result.wpm])

  // Enter starts again after a finished test.
  useEffect(() => {
    if (!done) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); restart() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [done, restart])

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Date.now()
    setNow(t)
    setGame((g) => typeInput(g, e.target.value, phrases, t))
  }

  const target = currentPhrase(game, phrases)
  const chars = diffChars(target, game.typed)
  const left = game.startedAt === null ? duration : secondsLeft(game, done ? game.startedAt + duration * 1000 : now)
  const textSize = portrait ? 17 : 15
  const fmt = (s: string, n: number | string) => s.replace('{n}', String(n))

  const durationPicker = TYPING_DURATIONS.map((d) => (
    <StripButton key={d} onClick={() => restart(d)} pressed={d === duration} ariaLabel={fmt(labels.duration, d)}>
      {fmt(labels.seconds, d)}
    </StripButton>
  ))

  const statusRow = (
    <div className="flex items-center gap-3 px-3 border-b flex-shrink-0"
      style={{ height: portrait ? 36 : 24, backgroundColor: ARCADE.strip, borderColor: ARCADE.stripBorder, fontSize: portrait ? 12 : 10, color: ARCADE.ink, ...PIXEL_FONT }}>
      <span>{fmt(labels.wpm, result.wpm)}</span>
      <span>{fmt(labels.accuracy, result.accuracy)}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(labels.time, left)}</span>
      {best > 0 && <span className="ml-auto">{fmt(labels.best, best)}</span>}
    </div>
  )

  return (
    <ArcadeFrame fs={fs} portrait={portrait}>
      <ScreenStrip time={time} title={labels.title} fs={fs} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack}>
        {durationPicker}
        <StripButton onClick={() => restart()}>{labels.newTest}</StripButton>
      </ScreenStrip>
      {statusRow}

      <div className="relative flex-1 min-h-0 flex flex-col justify-center gap-3 px-5" onClick={() => inputRef.current?.focus()}>
        {/* The phrase being typed */}
        <p aria-hidden className="leading-relaxed" style={{ ...PIXEL_FONT, fontSize: textSize, wordBreak: 'break-word' }}>
          {chars.map((c, i) => (
            <span key={i} style={{
              color: STATUS[c.status],
              backgroundColor: c.status === 'incorrect' ? 'rgba(179,55,44,0.15)' : undefined,
              borderBottom: c.status === 'current' && !done ? `2px solid ${ARCADE.rust}` : '2px solid transparent',
              whiteSpace: 'pre-wrap',
            }}>{c.char}</span>
          ))}
        </p>
        {/* The next one, dimmed */}
        <p aria-hidden style={{ ...PIXEL_FONT, fontSize: textSize - 3, color: ARCADE.inkSoft, opacity: 0.6 }}>{nextPhrase(game, phrases)}</p>
        {game.status === 'ready' && (
          <p style={{ ...PIXEL_FONT, fontSize: portrait ? 12 : 9, color: ARCADE.inkSoft }}>{touch ? labels.startTouch : labels.start}</p>
        )}

        {/* The field the keys go into: transparent over the text so a tap focuses it */}
        <input
          ref={inputRef}
          aria-label={`${labels.input}: ${target}`}
          value={game.typed}
          onChange={onChange}
          disabled={done}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="absolute inset-0 w-full h-full opacity-0 cursor-text"
          style={{ fontSize: 16 }}
        />

        {done && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(250,248,245,0.85)' }} aria-live="polite">
            <div className="flex flex-col items-center gap-2 px-6 py-4 border-2 text-center"
              style={{ ...PIXEL_FONT, backgroundColor: ARCADE.panel, borderColor: ARCADE.panelBorder, color: ARCADE.panelText, textShadow: `1px 1px 0 ${ARCADE.panelShadow}` }}>
              <span style={{ fontSize: portrait ? 14 : 12 }}>{labels.done}</span>
              <span style={{ fontSize: portrait ? 24 : 22, color: ARCADE.amber }}>{fmt(labels.wpm, result.wpm)}</span>
              <span style={{ fontSize: portrait ? 12 : 10 }}>
                {labels.result.replace('{acc}', String(result.accuracy)).replace('{n}', String(result.phrases))}
              </span>
              {newBest && <span style={{ fontSize: portrait ? 12 : 10, color: ARCADE.amber }}>{labels.newBest}</span>}
              <div className="flex gap-2 mt-1">
                <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={(e) => { e.stopPropagation(); restart() }}>{labels.again}</ArcadeButton>
                {onOpenApp && (
                  <ArcadeButton size={portrait ? 'xl' : 'md'} tone="dark" onClick={(e) => { e.stopPropagation(); onOpenApp('highscores') }}>{labels.highscores}</ArcadeButton>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ArcadeFrame>
  )
}
