'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { useStageScale } from '@/lib/room/useStageScale'
import { dailyDate, msUntilNextDaily } from '@/lib/games/daily'
import { BEST_KEYS, GURTLE_KEYS, readJson, setBestIfHigher, writeJson } from '@/lib/games/storage'
import { toggleLook, useGurtleLook, type GurtleLook } from '@/lib/games/gurtle-look'
import type { HiscoreEntry } from '@/lib/games/highscores'
import {
  DIFFICULTIES, TARGET, WORD_LEN, currentWord, diffPositions, giveUp, ladderOf, lexicon, moveTrend, newDaily,
  newPractice, nextStep, parseGame, parseStats, playMove, puzzleNumber, rateRun, recordDaily, liveStreak, shareGrid,
  takeHint, tileHits, undoMove,
  type Difficulty, type GameMode, type GurtleGame, type GurtleStats, type Lexicon, type MoveError, type Rating, type Trend,
} from '@/lib/games/gurtle'
import { ScreenStrip, StripButton, useDeskScreen } from './ScreenStrip'
import { ARCADE, ArcadeButton, ArcadeFrame, ArcadeOverlay, ArcadePanel, PIXEL_FONT, useFullscreen, type DeskGameProps } from './DeskArcade'
import { GameTutorial, TutorialButton, useTutorial } from './GameTutorial'
import { GurtleMascot, type GurtleMood } from './GurtleMascot'
import { useSfx } from './RoomSfxProvider'

type Page = { title: string; body: string }

export interface GurtleLabels {
  title: string
  /** The mascot's name in each look; copy that names the mascot says `{name}`. */
  mascot: Record<GurtleLook, string>
  /** The mascot's button label. */
  tapMascot: string
  daily: string
  practice: string
  stats: string
  dailyTitle: string
  practiceTitle: string
  levels: Record<Difficulty, string>
  levelTitle: string
  par: string
  moves: string
  goal: string
  hint: string
  undo: string
  giveUp: string
  giveUpSure: string
  newWord: string
  share: string
  enter: string
  del: string
  keyboard: string
  ladder: string
  row: string
  inputRow: string
  routeRow: string
  say: {
    hello: string
    helloDaily: string
    done: string
    newPuzzle: string
    closer: string[]
    same: string[]
    further: string[]
    hint: string
    noHint: string
    undo: string
    errors: Record<MoveError, string>
    won: Record<Rating, string>
    gaveUp: string
    newDay: string
    /** After a tap on the mascot, by the look it changed into. */
    swap: Record<GurtleLook, string[]>
  }
  result: {
    title: string
    ratings: Record<Rating, string>
    gaveUp: string
    summary: string
    route: string
    hints: string
    next: string
    practice: string
    close: string
    copied: string
    shared: string
    shareFailed: string
  }
  statsPanel: {
    title: string
    played: string
    winPct: string
    streak: string
    best: string
    dist: string
    buckets: string[]
    board: string
    close: string
  }
  /** The public board of longest daily streaks (/api/highscores, game `gurtle`). */
  board: {
    title: string
    yours: string
    none: string
    day: string
    days: string
    namePh: string
    post: string
    posting: string
    ranked: string
    empty: string
    offline: string
    loading: string
    error: string
    close: string
  }
  shareText: { daily: string; practice: string; line: string; hints: string; gaveUp: string }
  tutorial: {
    goal: Page
    moves: Page
    tiles: Page & { hit: string; miss: string; changed: string }
    help: Page
  }
}

/** Tile looks: green where a letter already sits where GURT has it. */
const MOSS = '#5f8a3a'
const MOSS_DARK = '#3f6328'
const TILE = {
  hit: { bg: MOSS, border: MOSS_DARK, fg: '#fffaf0', bevel: 'inset 1px 1px 0 rgba(255,255,255,0.28), inset -2px -2px 0 rgba(0,0,0,0.2)' },
  miss: { bg: '#e8e0d8', border: '#b8a898', fg: ARCADE.ink, bevel: 'inset 1px 1px 0 rgba(255,255,255,0.7), inset -2px -2px 0 rgba(0,0,0,0.08)' },
  typed: { bg: '#fffef5', border: ARCADE.ink, fg: ARCADE.ink, bevel: 'inset -2px -2px 0 rgba(0,0,0,0.06)' },
  next: { bg: '#fffef5', border: ARCADE.inkSoft, fg: '#cdbfb0', bevel: 'none' },
  ghost: { bg: '#fffef5', border: '#d8ccc0', fg: '#cdbfb0', bevel: 'none' },
  goal: { bg: '#eef4e4', border: MOSS, fg: MOSS, bevel: 'none' },
  route: { bg: '#f7f2ec', border: '#d4c6b8', fg: ARCADE.inkSoft, bevel: 'none' },
} as const
type TileKind = keyof typeof TILE

const notch = (n: number) =>
  `polygon(${n}px 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, ${n}px 100%, 0 calc(100% - ${n}px), 0 ${n}px)`

const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v)), s)

const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)] ?? ''

/** The name a visitor posts scores under, shared with the Scores app and Minesweeper. */
const NAME_KEY = 'hiscore-name'

function loadDaily(lex: Lexicon, date: string): GurtleGame {
  const saved = parseGame(lex, readJson(GURTLE_KEYS.daily))
  return saved && saved.mode === 'daily' && saved.date === date ? saved : newDaily(lex, date)
}

function loadPractice(lex: Lexicon): GurtleGame {
  const saved = parseGame(lex, readJson(GURTLE_KEYS.practice))
  return saved && saved.mode === 'practice' ? saved : newPractice(lex, 'medium')
}

/** The Clipboard API, or the old hidden-textarea copy where the API is missing or refused. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.setAttribute('readonly', '')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}

function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** One letter square. `changed` marks the letter this rung swapped in; `pop` replays a small bounce. */
function Tile({ ch, kind, size, hit, changed, delay = 0, flip, hop }: {
  ch: string
  kind: TileKind
  size: number
  hit?: boolean
  changed?: boolean
  delay?: number
  flip?: boolean
  hop?: boolean
}) {
  const t = TILE[kind]
  const fg = kind === 'route' && hit ? MOSS : t.fg
  const shadows = [t.bevel !== 'none' ? t.bevel : '', changed ? `inset 0 -3px 0 ${ARCADE.amber}` : ''].filter(Boolean).join(', ')
  const motionProps = flip
    ? { initial: { rotateX: -90, opacity: 0.4 }, animate: { rotateX: 0, opacity: 1 }, transition: { delay, duration: 0.22 } }
    : hop
      ? { animate: { y: [0, -size * 0.3, 0] }, transition: { delay, duration: 0.35 } }
      : {}
  return (
    <motion.span
      aria-hidden
      className="flex items-center justify-center flex-shrink-0"
      style={{
        ...PIXEL_FONT,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.55),
        lineHeight: 1,
        color: fg,
        backgroundColor: t.bg,
        border: `2px solid ${t.border}`,
        boxShadow: shadows || undefined,
        clipPath: notch(2),
        textShadow: kind === 'hit' ? `1px 1px 0 ${MOSS_DARK}` : undefined,
        textTransform: 'uppercase',
      }}
      {...motionProps}
    >
      {ch}
    </motion.span>
  )
}

/** The dark speech bubble Gurtle talks in; `tail` says which side Gurtle stands on. */
function Bubble({ text, tail, width, fontSize }: { text: string; tail: 'left' | 'down'; width: number; fontSize: number }) {
  return (
    <div className="relative flex-shrink-0" style={{ width }}>
      <ArcadePanel style={{ padding: '6px 8px', fontSize, lineHeight: `${fontSize + 4}px`, minHeight: fontSize * 2 + 16 }}>
        <p aria-live="polite" style={{ margin: 0 }}>{text}</p>
      </ArcadePanel>
      <span aria-hidden className="absolute" style={tail === 'left'
        ? { left: -6, bottom: 12, width: 0, height: 0, borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderRight: `7px solid ${ARCADE.panelBorder}` }
        : { left: '50%', marginLeft: -6, bottom: -7, width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: `7px solid ${ARCADE.panelBorder}` }} />
    </div>
  )
}

const KEY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

function Keyboard({ width, portrait, compact, labels, onLetter, onEnter, onDelete, disabled }: {
  width: number
  portrait: boolean
  /** A short phone screen: shorter keys leave the ladder more room. */
  compact: boolean
  labels: GurtleLabels
  onLetter: (l: string) => void
  onEnter: () => void
  onDelete: () => void
  disabled: boolean
}) {
  const gap = 3
  const keyW = Math.floor((width - 9 * gap) / 10)
  const keyH = portrait ? (compact ? 34 : 40) : 24
  const wide = Math.floor(keyW * 1.5)
  const key = (id: string, label: ReactNode, w: number, onPress: () => void, aria?: string) => (
    <button
      key={id}
      type="button"
      aria-label={aria}
      disabled={disabled}
      onClick={(e) => {
        // A mouse click hands focus back, so Enter on the window never clicks this key as well.
        if (e.detail > 0) e.currentTarget.blur()
        onPress()
      }}
      className="flex items-center justify-center outline-none enabled:active:translate-y-px enabled:hover:brightness-105 disabled:opacity-50 focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-4px] focus-visible:outline-[#3a2820]"
      style={{
        ...PIXEL_FONT,
        width: w,
        height: keyH,
        fontSize: portrait ? (w > keyW ? 10 : 14) : (w > keyW ? 9 : 10),
        lineHeight: 1,
        color: '#3a2820',
        textTransform: 'uppercase',
        background: 'linear-gradient(180deg, #fffaf0 0%, #f0e0c0 50%, #d8c098 100%)',
        border: '2px solid #3a2820',
        clipPath: notch(3),
        boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.7), inset -2px -2px 0 rgba(0,0,0,0.18)',
        textShadow: '1px 1px 0 rgba(255,255,255,0.45)',
        touchAction: 'manipulation',
      }}
    >
      {label}
    </button>
  )
  return (
    <div role="group" aria-label={labels.keyboard} className="flex flex-col items-center flex-shrink-0" style={{ gap: portrait ? 4 : 3 }}>
      {KEY_ROWS.map((row, r) => (
        <div key={row} className="flex" style={{ gap }}>
          {r === 2 && key('enter', labels.enter, wide, onEnter)}
          {row.split('').map((l) => key(l, l, keyW, () => onLetter(l), l.toUpperCase()))}
          {r === 2 && key('del', '⌫', wide, onDelete, labels.del)}
        </div>
      ))}
    </div>
  )
}

function useCountdown(active: boolean, onZero: () => void): number {
  const [ms, setMs] = useState(() => msUntilNextDaily())
  const zero = useRef(onZero)
  useEffect(() => { zero.current = onZero }, [onZero])
  useEffect(() => {
    if (!active) return
    const tick = () => {
      const left = msUntilNextDaily()
      setMs(left)
      if (left < 1000) zero.current()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [active])
  return ms
}

/**
 * Gurtle: a word ladder to GURT on the desk monitor. Change one letter at a
 * time, landing on a real word each time, from the start word down to GURT, in
 * as few moves as you can (par is the shortest everyday route). One daily
 * puzzle for everyone (UTC date, numbered from launch), or practice at three
 * lengths. Gurtle the turtle reacts to every move, hints show its next step,
 * and a finished daily can be shared as an emoji ladder. Games, the daily
 * record and the tutorial flag live in games storage (GURTLE_KEYS).
 */
export function DeskGurtle({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<GurtleLabels>) {
  const fs = useFullscreen()
  const { portrait, w, h } = useDeskScreen()
  const { mobile } = useStageScale()
  const touch = portrait || mobile
  const reduce = useReducedMotion()
  const { tone } = useSfx()
  const lex = useMemo(() => lexicon(), [])
  const tutorial = useTutorial(GURTLE_KEYS.tutorialSeen)

  const [today, setToday] = useState(() => dailyDate())
  const [mode, setMode] = useState<GameMode>('daily')
  const [daily, setDaily] = useState<GurtleGame>(() => loadDaily(lex, dailyDate()))
  const [practice, setPractice] = useState<GurtleGame>(() => loadPractice(lex))
  const [stats, setStats] = useState<GurtleStats>(() => parseStats(readJson(GURTLE_KEYS.stats)))
  const [typed, setTyped] = useState('')
  const [shake, setShake] = useState(0)
  const [mood, setMood] = useState<GurtleMood>('walk')
  const [beat, setBeat] = useState(0)
  const [say, setSay] = useState(() => (daily.status === 'playing' ? labels.say.helloDaily : labels.say.done))
  const [overlay, setOverlay] = useState<'result' | 'stats' | 'board' | null>(null)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)
  const [shareMsg, setShareMsg] = useState('')
  const moodTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const resultTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const scrollRef = useRef<HTMLDivElement>(null)
  const look = useGurtleLook()
  const name = labels.mascot[look]
  // The streak board: undefined while loading, null when offline.
  const [board, setBoard] = useState<HiscoreEntry[] | null | undefined>(undefined)
  const [playerName, setPlayerName] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [posting, setPosting] = useState(false)
  const [boardMsg, setBoardMsg] = useState('')

  const game = mode === 'daily' ? daily : practice
  const setGame = mode === 'daily' ? setDaily : setPractice
  const playing = game.status === 'playing'
  const level: Difficulty = practice.difficulty ?? 'medium'

  useEffect(() => { writeJson(GURTLE_KEYS.daily, daily) }, [daily])
  useEffect(() => { writeJson(GURTLE_KEYS.practice, practice) }, [practice])

  // A finished daily goes on the record once (recordDaily ignores a day it has already seen).
  useEffect(() => {
    if (daily.status === 'playing') return
    setStats((s) => {
      const next = recordDaily(s, daily)
      if (next !== s) writeJson(GURTLE_KEYS.stats, next)
      return next
    })
  }, [daily])

  // The longest streak is also a "best", so the Scores app can show and post it like any game's.
  useEffect(() => { if (stats.maxStreak > 0) setBestIfHigher(BEST_KEYS.gurtleStreak, stats.maxStreak) }, [stats.maxStreak])

  /** Gurtle's reaction: a mood, a line, and back to idle after `ms` (if given). */
  const react = useCallback((m: GurtleMood, text: string, ms?: number) => {
    clearTimeout(moodTimer.current)
    setMood(m)
    setSay(text)
    setBeat((b) => b + 1)
    if (ms) moodTimer.current = setTimeout(() => setMood('idle'), ms)
  }, [])

  // A tap on the mascot: into the shell, out as the other turtle (Gurtle or Jurtle, everywhere).
  const swapping = useRef(false)
  const swapLook = useCallback(() => {
    if (swapping.current) return
    swapping.current = true
    clearTimeout(moodTimer.current)
    setMood('hide')
    moodTimer.current = setTimeout(() => {
      const next = toggleLook()
      tone('sparkle')
      react('happy', pick(labels.say.swap[next]), 1000)
      swapping.current = false
    }, reduce ? 0 : 260)
  }, [react, labels, tone, reduce])

  // Gurtle walks on, then settles.
  useEffect(() => {
    moodTimer.current = setTimeout(() => setMood(daily.status === 'gaveUp' ? 'hide' : daily.status === 'won' ? 'happy' : 'idle'), 1200)
    return () => { clearTimeout(moodTimer.current); clearTimeout(resultTimer.current) }
    // Mount only: the opening walk.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the newest rung in view.
  const rungs = game.moves.length + game.reveal.length
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [rungs, mode, game.status])

  const fail = useCallback((err: MoveError) => {
    tone('invalid')
    setShake((s) => s + 1)
    react('worried', labels.say.errors[err], 1600)
  }, [tone, react, labels])

  const submit = useCallback(() => {
    if (!playing) return
    if (typed.length < WORD_LEN) { fail('length'); return }
    const before = currentWord(game)
    const res = playMove(lex, game, typed)
    if (res.error) { fail(res.error); return }
    setGame(res.game)
    setTyped('')
    setConfirmGiveUp(false)
    if (res.game.status === 'won') {
      tone('win')
      react('happy', labels.say.won[rateRun(res.game.moves.length, res.game.par)])
      clearTimeout(resultTimer.current)
      resultTimer.current = setTimeout(() => { setShareMsg(''); setOverlay('result') }, reduce ? 400 : 1400)
      return
    }
    const trend: Trend = moveTrend(lex, before, typed)
    tone(trend === 'closer' ? 'chip' : trend === 'further' ? 'bloop' : 'blip')
    react(trend === 'closer' ? 'happy' : trend === 'further' ? 'worried' : 'idle', pick(labels.say[trend]), 1400)
  }, [playing, typed, game, lex, setGame, fail, tone, react, labels, reduce])

  const typeLetter = useCallback((l: string) => {
    if (!playing) return
    setTyped((t) => (t.length < WORD_LEN ? t + l : t))
  }, [playing])
  const deleteLetter = useCallback(() => setTyped((t) => t.slice(0, -1)), [])

  const hint = () => {
    if (!playing) return
    const suggestion = nextStep(lex, currentWord(game))
    if (suggestion && typed === suggestion) return
    const r = takeHint(lex, game)
    if (!r.hint) { react('worried', labels.say.noHint, 1500); return }
    setGame(r.game)
    setTyped(r.hint)
    tone('powerup')
    react('happy', fill(labels.say.hint, { word: r.hint.toUpperCase() }), 1800)
  }

  const undo = () => {
    if (!playing || game.moves.length === 0) return
    setGame(undoMove(game))
    setTyped('')
    tone('bloop')
    react('idle', labels.say.undo)
  }

  const surrender = () => {
    if (!playing) return
    if (!confirmGiveUp) {
      setConfirmGiveUp(true)
      setTimeout(() => setConfirmGiveUp(false), 3000)
      return
    }
    setConfirmGiveUp(false)
    setGame(giveUp(lex, game))
    setTyped('')
    tone('lose')
    react('hide', labels.say.gaveUp)
    clearTimeout(resultTimer.current)
    resultTimer.current = setTimeout(() => { setShareMsg(''); setOverlay('result') }, reduce ? 400 : 1200)
  }

  const startPractice = useCallback((difficulty: Difficulty) => {
    setPractice((p) => newPractice(lex, difficulty, Math.random, p.start))
    setMode('practice')
    setTyped('')
    setOverlay(null)
    setConfirmGiveUp(false)
    react('walk', labels.say.newPuzzle, 1200)
  }, [lex, react, labels])

  const switchMode = (m: GameMode) => {
    if (m === mode) return
    setMode(m)
    setTyped('')
    setOverlay(null)
    setConfirmGiveUp(false)
    if (m === 'daily') {
      // The UTC day may have turned over while the app was open.
      const d = dailyDate()
      let g = daily
      if (d !== today) { setToday(d); g = loadDaily(lex, d); setDaily(g) }
      react(g.status === 'playing' ? 'walk' : g.status === 'won' ? 'happy' : 'hide', g.status === 'playing' ? labels.say.helloDaily : labels.say.done, g.status === 'playing' ? 1000 : undefined)
    } else {
      react(practice.status === 'playing' ? 'walk' : 'idle', labels.say.hello, 1000)
    }
  }

  const newDay = useCallback(() => {
    const d = dailyDate()
    if (d === today) return
    setToday(d)
    setDaily(newDaily(lex, d))
    if (mode === 'daily') {
      setOverlay(null)
      setTyped('')
      react('walk', labels.say.newDay, 1200)
    }
  }, [today, lex, mode, react, labels])
  const untilNext = useCountdown(overlay !== null || (mode === 'daily' && !playing), newDay)

  // Keys: letters type, Backspace deletes, Enter plays the word (or closes a panel).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || tutorial.open) return
      const el = e.target as HTMLElement | null
      if (el?.closest?.('input,textarea,select,[contenteditable="true"]')) return
      if (el instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return
      if (overlay) {
        if (e.key === 'Enter') { e.preventDefault(); setOverlay(null) }
        return
      }
      if (/^[a-zA-Z]$/.test(e.key)) { e.preventDefault(); typeLetter(e.key.toLowerCase()) }
      else if (e.key === 'Backspace') { e.preventDefault(); deleteLetter() }
      else if (e.key === 'Enter') { e.preventDefault(); submit() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [overlay, tutorial.open, typeLetter, deleteLetter, submit])

  // Escape closes a panel before DeskView's ladder (capture phase runs first).
  useEffect(() => {
    if (!overlay) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || document.fullscreenElement) return
      e.stopPropagation()
      setOverlay(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [overlay])

  const shareText = useCallback((g: GurtleGame) => {
    const header = g.mode === 'daily' && g.date ? fill(labels.shareText.daily, { n: puzzleNumber(g.date) }) : labels.shareText.practice
    const start = g.start.toUpperCase()
    const line = g.status === 'won'
      ? fill(labels.shareText.line, { start, moves: g.moves.length, par: g.par })
      : fill(labels.shareText.gaveUp, { start, name })
    const hints = g.hints ? ` ${fill(labels.shareText.hints, { n: g.hints })}` : ''
    return `${header}\n${line}${hints}\n${shareGrid(g)}\n${window.location.origin}/?app=gurtle`
  }, [labels, name])

  const share = async (g: GurtleGame) => {
    const text = shareText(g)
    if (touch && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text })
        setShareMsg(labels.result.shared)
        tone('chip')
        return
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return
        // No share sheet after all: copy instead.
      }
    }
    const ok = await copyText(text)
    setShareMsg(ok ? labels.result.copied : labels.result.shareFailed)
    if (ok) tone('chip')
  }

  // ---- The streak board ----
  const bestStreak = stats.maxStreak
  const dayCount = (n: number) => fill(n === 1 ? labels.board.day : labels.board.days, { n })

  const loadBoard = useCallback(() => {
    setBoard(undefined)
    fetch('/api/highscores').then((r) => r.json())
      .then((d) => setBoard(d.boards ? (d.boards.gurtle ?? []) : null))
      .catch(() => setBoard(null))
  }, [])

  const openBoard = () => {
    setBoardMsg('')
    const saved = readJson(NAME_KEY)
    if (typeof saved === 'string' && !playerName) setPlayerName(saved)
    setOverlay('board')
    loadBoard()
  }

  const postStreak = async (e: React.FormEvent) => {
    e.preventDefault()
    const nm = playerName.trim()
    if (posting || !bestStreak || !nm) return
    setPosting(true)
    setBoardMsg('')
    writeJson(NAME_KEY, nm)
    try {
      const r = await fetch('/api/highscores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'gurtle', name: nm, score: bestStreak, website }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) { setBoardMsg(d.error || labels.board.error); return }
      setBoardMsg(typeof d.rank === 'number' ? fill(labels.board.ranked, { n: d.rank }) : '')
      tone('score')
      loadBoard()
    } catch { setBoardMsg(labels.board.error) } finally { setPosting(false) }
  }

  // ---- Ladder rows ----
  const ladder = ladderOf(game)
  const tile = portrait ? 32 : 26
  const gap = portrait ? 4 : 3
  const won = game.status === 'won'
  const finishedAt = won ? ladder.length - 1 : -1
  const current = currentWord(game)
  const rowLabel = (word: string) => fill(labels.row, { word: word.toUpperCase(), n: tileHits(word).filter(Boolean).length })

  const stepNo = (n: number | null) => (
    <span aria-hidden className="text-right flex-shrink-0" style={{ ...PIXEL_FONT, width: 16, fontSize: portrait ? 10 : 8, color: ARCADE.inkSoft }}>
      {n ?? ''}
    </span>
  )

  const ladderRows = (
    <div role="list" aria-label={labels.ladder} className="flex flex-col items-center" style={{ gap }}>
      {ladder.map((word, i) => {
        const changed = i === 0 ? -1 : diffPositions(ladder[i - 1], word)[0]
        const hits = tileHits(word)
        return (
          <div key={`${i}-${word}`} role="listitem" aria-label={rowLabel(word)} className="flex items-center" style={{ gap }}>
            {stepNo(i === 0 ? null : i)}
            {word.split('').map((ch, j) => (
              <Tile key={j} ch={ch} size={tile} kind={hits[j] ? 'hit' : 'miss'} changed={j === changed}
                flip={!reduce && i > 0 && j === changed} delay={0}
                hop={!reduce && i === finishedAt} />
            ))}
            {stepNo(null)}
          </div>
        )
      })}
      {playing && (
        <motion.div key={`input-${shake}`} role="listitem" aria-label={fill(labels.inputRow, { typed: typed.toUpperCase() || '-' })}
          className="flex items-center" style={{ gap }}
          animate={shake && !reduce ? { x: [0, -6, 6, -4, 4, 0] } : undefined} transition={{ duration: 0.3 }}>
          {stepNo(ladder.length)}
          {Array.from({ length: WORD_LEN }, (_, j) => (
            <Tile key={j} size={tile}
              ch={typed[j] ?? current[j]}
              kind={typed[j] ? 'typed' : j === typed.length ? 'next' : 'ghost'} />
          ))}
          {stepNo(null)}
        </motion.div>
      )}
      {game.status === 'gaveUp' && game.reveal.map((word, i) => (
        <div key={`r-${i}-${word}`} role="listitem" aria-label={fill(labels.routeRow, { word: word.toUpperCase(), name })} className="flex items-center" style={{ gap }}>
          {stepNo(ladder.length + i)}
          {word.split('').map((ch, j) => (
            <Tile key={j} ch={ch} size={tile} kind="route" hit={tileHits(word)[j]}
              flip={!reduce} delay={0.12 * i + 0.03 * j} />
          ))}
          {stepNo(null)}
        </div>
      ))}
    </div>
  )

  const goalRow = !won && game.status !== 'gaveUp' && (
    <div className="flex flex-col items-center flex-shrink-0" style={{ gap: 3, paddingTop: 3, borderTop: `1px dashed ${ARCADE.stripBorder}` }}>
      <span aria-hidden style={{ ...PIXEL_FONT, fontSize: portrait ? 9 : 7, letterSpacing: 1, textTransform: 'uppercase', color: MOSS }}>{labels.goal}</span>
      <div aria-label={`${labels.goal}: ${TARGET.toUpperCase()}`} className="flex items-center" style={{ gap }}>
        {stepNo(null)}
        {TARGET.split('').map((ch, j) => <Tile key={j} ch={ch} size={tile} kind="goal" />)}
        {stepNo(null)}
      </div>
    </div>
  )

  const title = mode === 'daily' ? fill(labels.dailyTitle, { n: puzzleNumber(game.date ?? today) }) : labels.practiceTitle
  // A narrow phone column stacks the title over the score; the desk has room for one line.
  const header = (
    <div className={`flex flex-shrink-0 px-2 ${portrait ? 'flex-col justify-center gap-1' : 'items-center justify-between'}`}
      style={{ ...PIXEL_FONT, height: portrait ? 46 : 22, color: ARCADE.ink, fontSize: portrait ? 12 : 9 }}>
      <span className="flex items-center gap-1 min-w-0">
        <span className="truncate">{title}</span>
        {mode === 'practice' && (
          <ArcadeButton tone="dark" size="sm" title={labels.levelTitle}
            onClick={(e) => { if (e.detail > 0) (e.currentTarget as HTMLElement).blur(); startPractice(DIFFICULTIES[(DIFFICULTIES.indexOf(level) + 1) % DIFFICULTIES.length]) }}>
            {labels.levels[level]} ▾
          </ArcadeButton>
        )}
      </span>
      <span className="flex-shrink-0" style={{ color: ARCADE.inkSoft, fontSize: portrait ? 10 : undefined }}>
        {fill(labels.par, { n: game.par })} · {fill(labels.moves, { n: game.moves.length })}
      </span>
    </div>
  )

  const ladderColumn = (
    <section aria-label={labels.ladder} className="flex flex-col min-h-0 flex-shrink-0"
      style={{ width: portrait ? 176 : 204, backgroundColor: '#f4efe8', borderRight: `1px solid ${ARCADE.stripBorder}` }}>
      {header}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ padding: '4px 0 8px', scrollbarWidth: 'thin' }}>
        {ladderRows}
      </div>
      <div style={{ paddingBottom: portrait ? 8 : 6 }}>{goalRow}</div>
    </section>
  )

  // ---- Actions ----
  const btn = portrait ? 'xl' : 'md'
  const actions = (
    <div className="flex items-center justify-center flex-shrink-0 flex-wrap" style={{ gap: portrait ? 6 : 5, minHeight: portrait ? 46 : 30 }}>
      {playing ? (
        <>
          <ArcadeButton size={btn} onClick={(e) => { if (e.detail > 0) (e.currentTarget as HTMLElement).blur(); hint() }}>{labels.hint}</ArcadeButton>
          <ArcadeButton size={btn} disabled={game.moves.length === 0} onClick={(e) => { if (e.detail > 0) (e.currentTarget as HTMLElement).blur(); undo() }}>{labels.undo}</ArcadeButton>
          <ArcadeButton size={btn} tone="dark" pressed={confirmGiveUp} onClick={(e) => { if (e.detail > 0) (e.currentTarget as HTMLElement).blur(); surrender() }}>
            {confirmGiveUp ? labels.giveUpSure : labels.giveUp}
          </ArcadeButton>
          {mode === 'practice' && (
            <ArcadeButton size={btn} tone="dark" onClick={() => startPractice(level)}>{labels.newWord}</ArcadeButton>
          )}
        </>
      ) : (
        <>
          <ArcadeButton size={btn} onClick={() => { setShareMsg(''); setOverlay('result') }}>{labels.result.title}</ArcadeButton>
          {mode === 'practice'
            ? <ArcadeButton size={btn} tone="dark" onClick={() => startPractice(level)}>{labels.newWord}</ArcadeButton>
            : <ArcadeButton size={btn} tone="dark" onClick={() => startPractice(level)}>{labels.result.practice}</ArcadeButton>}
        </>
      )}
    </div>
  )

  const keyboard = (
    <Keyboard width={portrait ? w - 8 : 318} portrait={portrait} compact={h < 560} labels={labels} disabled={!playing}
      onLetter={typeLetter} onEnter={submit} onDelete={deleteLetter} />
  )

  const mascotScale = portrait ? 2 : 3
  const mascot = <GurtleMascot mood={mood} scale={mascotScale} beat={beat} onTap={swapLook} tapLabel={fill(labels.tapMascot, { name })} />
  const stage = (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* The ground Gurtle stands on */}
      <div aria-hidden className="absolute left-0 right-0" style={{ bottom: portrait ? 10 : 6, height: 2, backgroundImage: `repeating-linear-gradient(90deg, ${ARCADE.stripBorder} 0 6px, transparent 6px 10px)` }} />
      <div className={`flex-1 min-h-0 flex ${portrait ? 'flex-col items-center justify-end' : 'items-end justify-center'}`}
        style={{ gap: portrait ? 10 : 10, padding: portrait ? '6px 4px 10px' : '6px 8px 6px' }}>
        {portrait ? (
          <>
            <Bubble text={say} tail="down" width={136} fontSize={11} />
            {mascot}
          </>
        ) : (
          <>
            {mascot}
            <div style={{ marginBottom: 40 }}><Bubble text={say} tail="left" width={168} fontSize={10} /></div>
          </>
        )}
      </div>
    </div>
  )

  // ---- Panels ----
  const rating = rateRun(game.moves.length, game.par)
  const miniGrid = (g: GurtleGame) => {
    const rows = g.status === 'gaveUp' ? [...ladderOf(g), ...g.reveal] : ladderOf(g)
    const cell = rows.length > 9 ? 5 : 7
    return (
      <div aria-hidden className="flex flex-col flex-shrink-0" style={{ gap: 1 }}>
        {rows.map((wd, i) => (
          <div key={i} className="flex" style={{ gap: 1, opacity: i > g.moves.length && g.status === 'gaveUp' ? 0.5 : 1 }}>
            {tileHits(wd).map((h, j) => <span key={j} style={{ width: cell, height: cell, backgroundColor: h ? '#7aaa4e' : '#6a5a48' }} />)}
          </div>
        ))}
      </div>
    )
  }

  const nextLine = game.mode === 'daily' && (
    <span style={{ fontSize: portrait ? 11 : 9, color: ARCADE.inkSoft }}>{fill(labels.result.next, { time: clockText(untilNext) })}</span>
  )

  const resultPanel = overlay === 'result' && !playing && (
    <ArcadeOverlay>
      <div role="dialog" aria-modal="true" aria-label={labels.result.title} onPointerDown={(e) => e.stopPropagation()}>
        <ArcadePanel style={{ width: portrait ? 296 : 360, padding: portrait ? 12 : 10 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <GurtleMascot mood={won ? 'happy' : 'hide'} scale={2} beat={beat} />
            <div className="flex flex-col min-w-0" style={{ gap: 4 }}>
              <h2 style={{ margin: 0, fontSize: portrait ? 14 : 12, color: ARCADE.amber }}>
                {won ? labels.result.ratings[rating] : fill(labels.result.gaveUp, { name })}
              </h2>
              <span style={{ fontSize: portrait ? 12 : 10 }}>
                {fill(labels.result.route, { start: game.start.toUpperCase() })}
              </span>
              {won && <span style={{ fontSize: portrait ? 12 : 10 }}>{fill(labels.result.summary, { moves: game.moves.length, par: game.par })}</span>}
              {game.hints > 0 && <span style={{ fontSize: portrait ? 11 : 9, color: '#b8a488' }}>{fill(labels.result.hints, { n: game.hints })}</span>}
            </div>
            <div className="ml-auto">{miniGrid(game)}</div>
          </div>
          <div className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 10 }}>
            <ArcadeButton size={btn} onClick={() => void share(game)}>{labels.share}</ArcadeButton>
            {game.mode === 'daily'
              ? <ArcadeButton size={btn} tone="dark" onClick={() => startPractice(level)}>{labels.result.practice}</ArcadeButton>
              : <ArcadeButton size={btn} tone="dark" onClick={() => startPractice(level)}>{labels.newWord}</ArcadeButton>}
            <ArcadeButton size={btn} tone="dark" onClick={() => setOverlay(null)}>{labels.result.close}</ArcadeButton>
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: 6, minHeight: 12 }}>
            {nextLine}
            <span aria-live="polite" style={{ fontSize: portrait ? 11 : 9, color: ARCADE.amber }}>{shareMsg}</span>
          </div>
        </ArcadePanel>
      </div>
    </ArcadeOverlay>
  )

  const streakNow = liveStreak(stats, today)
  const maxBucket = Math.max(1, ...stats.dist)
  const todayBucket = daily.status === 'won' ? Math.min(4, Math.max(0, daily.moves.length - daily.par)) : -1
  const statsPanel = overlay === 'stats' && (
    <ArcadeOverlay>
      <div role="dialog" aria-modal="true" aria-label={labels.statsPanel.title} onPointerDown={(e) => e.stopPropagation()}>
        <ArcadePanel style={{ width: portrait ? 296 : 340, padding: portrait ? 12 : 10 }}>
          <h2 style={{ margin: 0, fontSize: portrait ? 12 : 10, letterSpacing: 1, textTransform: 'uppercase', color: ARCADE.gold }}>{labels.statsPanel.title}</h2>
          <div className="grid grid-cols-4 text-center" style={{ marginTop: 8, gap: 4 }}>
            {[
              [stats.played, labels.statsPanel.played],
              [stats.played ? Math.round((stats.won / stats.played) * 100) : 0, labels.statsPanel.winPct],
              [streakNow, labels.statsPanel.streak],
              [stats.maxStreak, labels.statsPanel.best],
            ].map(([n, label]) => (
              <div key={String(label)} className="flex flex-col items-center" style={{ gap: 3 }}>
                <span style={{ fontSize: portrait ? 18 : 16, color: ARCADE.amber }}>{n}</span>
                <span style={{ fontSize: portrait ? 10 : 8 }}>{label}</span>
              </div>
            ))}
          </div>
          <h3 style={{ margin: '10px 0 4px', fontSize: portrait ? 11 : 9, color: ARCADE.gold }}>{labels.statsPanel.dist}</h3>
          <div className="flex flex-col" style={{ gap: 3 }}>
            {stats.dist.map((count, i) => (
              <div key={i} className="flex items-center" style={{ gap: 6, fontSize: portrait ? 11 : 9 }}>
                <span className="text-right flex-shrink-0" style={{ width: portrait ? 34 : 28 }}>{labels.statsPanel.buckets[i]}</span>
                <span className="flex items-center justify-end" style={{
                  minWidth: 16, width: `${Math.max(8, (count / maxBucket) * 100)}%`, height: portrait ? 14 : 11, padding: '0 3px',
                  backgroundColor: i === todayBucket ? MOSS : ARCADE.panelBorder, color: ARCADE.panelText, fontSize: portrait ? 10 : 8,
                }}>{count}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 6, marginTop: 10 }}>
            <ArcadeButton size={btn} onClick={openBoard}>{labels.statsPanel.board}</ArcadeButton>
            <span className="flex" style={{ gap: 6 }}>
              {daily.status !== 'playing' && <ArcadeButton size={btn} onClick={() => void share(daily)}>{labels.share}</ArcadeButton>}
              <ArcadeButton size={btn} tone="dark" onClick={() => setOverlay(null)}>{labels.statsPanel.close}</ArcadeButton>
            </span>
          </div>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 6, marginTop: 6, minHeight: 12 }}>
            <span style={{ fontSize: portrait ? 11 : 9, color: ARCADE.inkSoft }}>{fill(labels.result.next, { time: clockText(untilNext) })}</span>
            <span aria-live="polite" style={{ fontSize: portrait ? 11 : 9, color: ARCADE.amber }}>{shareMsg}</span>
          </div>
        </ArcadePanel>
      </div>
    </ArcadeOverlay>
  )

  const inputStyle: React.CSSProperties = {
    ...PIXEL_FONT, color: ARCADE.ink, backgroundColor: '#fffef5', border: `1px solid ${ARCADE.stripBorder}`, minWidth: 0,
    fontSize: touch ? 16 : 10, padding: portrait ? '6px' : '2px 4px', height: portrait ? 38 : touch ? 30 : 22,
  }
  const boardRow = portrait ? 24 : 13
  const boardPanel = overlay === 'board' && (
    <ArcadeOverlay>
      <div role="dialog" aria-modal="true" aria-label={labels.board.title} onPointerDown={(e) => e.stopPropagation()}>
        <ArcadePanel style={{ width: portrait ? 296 : 340, padding: portrait ? 12 : 10 }}>
          <div className="flex items-center justify-between">
            <h2 style={{ margin: 0, fontSize: portrait ? 12 : 10, letterSpacing: 1, textTransform: 'uppercase', color: ARCADE.gold }}>{labels.board.title}</h2>
            <GurtleMascot mood="idle" scale={1} />
          </div>
          <ol aria-label={labels.board.title} className="overflow-y-auto" style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', maxHeight: boardRow * 10, fontSize: portrait ? 12 : 9, scrollbarWidth: 'thin' }}>
            {board === undefined ? <li style={{ color: '#b8a488' }}>{labels.board.loading}</li>
              : board === null ? <li style={{ color: '#b8a488' }}>{labels.board.offline}</li>
              : board.length === 0 ? <li style={{ color: '#b8a488' }}>{labels.board.empty}</li>
              : board.map((en, i) => (
                <li key={en.name} className="flex items-center" style={{ gap: 6, height: boardRow, borderBottom: `1px dotted ${ARCADE.panelBorder}` }}>
                  <span style={{ width: portrait ? 26 : 20, color: i < 3 ? ARCADE.gold : '#b8a488' }}>{i + 1}.</span>
                  <span className="flex-1 truncate" style={{ color: en.name === playerName.trim() ? ARCADE.amber : undefined }}>{en.name}</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{dayCount(en.score)}</span>
                </li>
              ))}
          </ol>
          <form onSubmit={postStreak} className="flex flex-col" style={{ gap: 4, marginTop: 8 }}>
            <span style={{ fontSize: portrait ? 11 : 9 }}>
              {bestStreak ? fill(labels.board.yours, { n: dayCount(bestStreak) }) : labels.board.none}
            </span>
            {bestStreak > 0 && (
              <div className="flex items-center" style={{ gap: 6 }}>
                <input aria-label={labels.board.namePh} placeholder={labels.board.namePh} maxLength={16} value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)} className="flex-1" style={inputStyle} />
                <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)}
                  style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
                <ArcadeButton type="submit" size={portrait ? 'xl' : 'sm'} disabled={posting || !playerName.trim()}>
                  {posting ? labels.board.posting : labels.board.post}
                </ArcadeButton>
              </div>
            )}
          </form>
          <div className="flex items-center justify-between" style={{ gap: 6, marginTop: 6 }}>
            <span aria-live="polite" className="min-w-0" style={{ fontSize: portrait ? 11 : 9, color: ARCADE.amber }}>{boardMsg}</span>
            <ArcadeButton size={btn} tone="dark" onClick={() => setOverlay('stats')}>{labels.board.close}</ArcadeButton>
          </div>
        </ArcadePanel>
      </div>
    </ArcadeOverlay>
  )

  return (
    <ArcadeFrame fs={fs} portrait>
      <ScreenStrip time={time} title={labels.title} fs={fs} fsLabels={arcade} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack}>
        <StripButton pressed={mode === 'daily'} onClick={() => switchMode('daily')}>{labels.daily}</StripButton>
        <StripButton pressed={mode === 'practice'} onClick={() => switchMode('practice')}>{labels.practice}</StripButton>
        <StripButton pressed={overlay === 'stats'} onClick={() => { setShareMsg(''); setOverlay(overlay === 'stats' ? null : 'stats') }}>{labels.stats}</StripButton>
        <TutorialButton tutorial={tutorial} />
      </ScreenStrip>

      {portrait ? (
        <div className="relative flex-1 min-h-0 flex flex-col" style={{ backgroundColor: ARCADE.paper }}>
          <div className="flex-1 min-h-0 flex">
            {ladderColumn}
            {stage}
          </div>
          {actions}
          <div style={{ padding: '0 4px 6px' }}>{keyboard}</div>
          {resultPanel}
          {statsPanel}
          {boardPanel}
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 flex" style={{ backgroundColor: ARCADE.paper }}>
          {ladderColumn}
          <div className="flex-1 min-w-0 flex flex-col" style={{ paddingBottom: 6 }}>
            {stage}
            {actions}
            <div style={{ paddingTop: 3 }}>{keyboard}</div>
          </div>
          {resultPanel}
          {statsPanel}
          {boardPanel}
        </div>
      )}

      {tutorial.open && <GurtleTutorial labels={labels} name={name} onClose={tutorial.close} />}
    </ArcadeFrame>
  )
}

/** How to play: the goal, a move, what the colours mean, and the helpers. */
function GurtleTutorial({ labels, name, onClose }: { labels: GurtleLabels; name: string; onClose: () => void }) {
  const { portrait } = useDeskScreen()
  const named = (p: Page): Page => ({ title: fill(p.title, { name }), body: fill(p.body, { name }) })
  const t = { ...labels.tutorial, goal: named(labels.tutorial.goal), moves: named(labels.tutorial.moves), help: named(labels.tutorial.help) }
  const size = portrait ? 24 : 18
  const example = ['cart', 'curt', 'gurt']
  const exampleLadder = (
    <div className="flex items-center" style={{ gap: 14, marginTop: 10 }}>
      <div className="flex flex-col" style={{ gap: 3 }}>
        {example.map((word, i) => {
          const changed = i === 0 ? -1 : diffPositions(example[i - 1], word)[0]
          return (
            <div key={word} className="flex" style={{ gap: 3 }}>
              {word.split('').map((ch, j) => <Tile key={j} ch={ch} size={size} kind={tileHits(word)[j] ? 'hit' : 'miss'} changed={j === changed} />)}
            </div>
          )
        })}
      </div>
      <GurtleMascot mood="walk" scale={2} />
    </div>
  )
  const legend = (
    <div className="flex flex-col" style={{ gap: 6, marginTop: 10 }}>
      {[
        [<Tile key="h" ch="g" size={size} kind="hit" />, t.tiles.hit],
        [<Tile key="m" ch="a" size={size} kind="miss" />, t.tiles.miss],
        [<Tile key="c" ch="u" size={size} kind="hit" changed />, t.tiles.changed],
      ].map(([tileEl, text], i) => (
        <div key={i} className="flex items-center" style={{ gap: 8 }}>{tileEl}<span>{text}</span></div>
      ))}
    </div>
  )
  return (
    <GameTutorial
      onClose={onClose}
      bodyH={{ landscape: 150, portrait: 220 }}
      pages={[
        { ...t.goal, extra: exampleLadder },
        t.moves,
        { ...t.tiles, extra: legend },
        t.help,
      ]}
    />
  )
}
