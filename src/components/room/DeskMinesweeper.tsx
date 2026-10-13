// src/components/room/DeskMinesweeper.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBoard, createDailyBoard, reveal, toggleFlag, flagCount, type Board } from '@/lib/games/minesweeper-engine'
import { getBest, setBestIfLower, BEST_KEYS, readJson, writeJson } from '@/lib/games/storage'
import { mulberry32 } from '@/lib/games/cards'
import { dailyDate, dailySeed, msUntilNextDaily, parseDailyResult, type DailyResult } from '@/lib/games/daily'
import { useStageScale } from '@/lib/room/useStageScale'
import { ScreenStrip, StripButton, useDeskScreen } from './ScreenStrip'
import { ArcadeButton, ArcadeFrame, ArcadeOverlay, ArcadePanel, useFullscreen } from './DeskArcade'
import { ARCADE } from './pixel-ui'
import { GameTutorial, KeyRows, TutorialButton, useTutorial } from './GameTutorial'

const ROWS = 9
const COLS = 9
const MINES = 10
const CELL = 24
const PORTRAIT_MAX_CELL = 32
const PORTRAIT_COUNTERS_H = 44
const PORTRAIT_TOGGLE_H = 38
const PORTRAIT_GAPS = 16
const NUMBER_COLORS = ['', '#2a4a8a', '#2a6a3a', '#8a2a2a', '#4a2a6a', '#6a4a2a', '#2a6a6a', '#3a3028', '#111111']

export interface MinesLabels {
  board: string
  cell: string
  minesLeft: string
  time: string
  best: string
  reset: string
  won: string
  lost: string
  reveal: string
  flag: string
  tutorial: MinesTutorialLabels
  daily: MinesDailyLabels
}

export interface MinesDailyLabels {
  /** Strip toggle */
  button: string
  /** Status bar, `{date}` */
  title: string
  won: string
  lost: string
  /** `{h}` `{m}` until the next board */
  next: string
  namePh: string
  post: string
  posting: string
  /** `{n}` is today's rank */
  posted: string
  error: string
  classic: string
}

/** Today's attempt, kept so each visitor gets one try a day. */
const DAILY_KEY = 'minesweeper-daily'
/** Shared with the Scores app. */
const NAME_KEY = 'hiscore-name'

const newDailyBoard = (date: string) => createDailyBoard(ROWS, COLS, MINES, mulberry32(dailySeed('minesweeper', date)))

function untilNext(labels: MinesDailyLabels): string {
  const mins = Math.ceil(msUntilNextDaily() / 60_000)
  return labels.next.replace('{h}', String(Math.floor(mins / 60))).replace('{m}', String(mins % 60))
}

type Page = { title: string; body: string }
export interface MinesTutorialLabels {
  goal: Page
  numbers: Page & { caption: string }
  flags: Page
  controls: Page & { move: string; open: string; flag: string }
}

/** A 3 by 4 corner of a board: numbers around a flagged mine, one square still closed. */
const EXAMPLE: (number | 'flag' | 'closed' | 0)[][] = [
  [0, 1, 'flag', 'closed'],
  [0, 1, 2, 'closed'],
  [0, 0, 1, 1],
]

function MinesTutorial({ labels, onClose }: { labels: MinesLabels; onClose: () => void }) {
  const { portrait } = useDeskScreen()
  const t = labels.tutorial
  const cell = portrait ? 24 : 18
  const font = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const
  return (
    <GameTutorial
      onClose={onClose}
      pages={[
        t.goal,
        {
          ...t.numbers,
          extra: (
            <figure className="m-0 flex flex-col items-center" style={{ gap: 4, marginTop: 8 }}>
              <div className="grid" style={{ gridTemplateColumns: `repeat(4, ${cell}px)` }} aria-hidden>
                {EXAMPLE.flat().map((v, i) => {
                  const open = v !== 'flag' && v !== 'closed'
                  return (
                    <span
                      key={i}
                      className="flex items-center justify-center"
                      style={{
                        width: cell,
                        height: cell,
                        fontSize: portrait ? 14 : 11,
                        lineHeight: 1,
                        backgroundColor: open ? '#e8e0d8' : '#c8b8a8',
                        border: open ? '1px solid #d8c8b8' : '2px outset #e8e0d8',
                        color: typeof v === 'number' && v > 0 ? NUMBER_COLORS[v] : '#3a3028',
                        textShadow: 'none',
                        ...font,
                      }}
                    >
                      {v === 'flag' ? '⚑' : typeof v === 'number' && v > 0 ? v : ''}
                    </span>
                  )
                })}
              </div>
              <figcaption style={{ fontSize: portrait ? 10 : 9, lineHeight: 1.2 }}>{t.numbers.caption}</figcaption>
            </figure>
          ),
        },
        t.flags,
        {
          ...t.controls,
          extra: (
            <KeyRows
              portrait={portrait}
              rows={[
                { keys: ['←', '↑', '→', '↓'], text: t.controls.move },
                { keys: ['Enter', 'Space'], text: t.controls.open },
                { keys: ['F'], text: t.controls.flag },
              ]}
            />
          ),
        },
      ]}
    />
  )
}

interface DeskMinesweeperProps {
  time: string
  backLabel: string
  desktopLabel: string
  labels: MinesLabels
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
}

export function DeskMinesweeper({ time, backLabel, desktopLabel, labels, onBack, onDesktop }: DeskMinesweeperProps) {
  const fs = useFullscreen()
  const { portrait, w, h } = useDeskScreen()
  const { mobile } = useStageScale()
  const [board, setBoard] = useState<Board>(() => createBoard(ROWS, COLS, MINES))
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState(0)
  const [focus, setFocus] = useState({ r: 0, c: 0 })
  const [flagMode, setFlagMode] = useState(false)
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pressFlagged = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const tutorial = useTutorial('minesweeper-tutorial-seen')
  // Daily challenge: the day's date while in daily mode, else null.
  const [dailyOn, setDailyOn] = useState<string | null>(null)
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null)
  // The daily board opens pre-cascaded, so its clock waits for the first move.
  const [dailyStarted, setDailyStarted] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [posting, setPosting] = useState(false)
  const [postMsg, setPostMsg] = useState('')

  const startDaily = useCallback(() => {
    const date = dailyDate()
    const saved = parseDailyResult(readJson(DAILY_KEY))
    setDailyOn(date)
    setDailyResult(saved && saved.date === date ? saved : null)
    setDailyStarted(false)
    setPostMsg('')
    setBoard(newDailyBoard(date))
    setElapsed(0)
  }, [])

  useEffect(() => {
    setBest(getBest(BEST_KEYS.minesweeper))
    const saved = readJson(NAME_KEY)
    if (typeof saved === 'string') setName(saved)
    // /?app=minesweeper&daily opens straight on today's board (a one-shot flag).
    const url = new URL(window.location.href)
    if (url.searchParams.has('daily')) {
      url.searchParams.delete('daily')
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
      startDaily()
    }
  }, [startDaily])

  // Timer runs from the first reveal until the game ends, and stops while How to play is open
  const clockRunning = board.minesPlaced && (!dailyOn || dailyStarted) && !dailyResult
  useEffect(() => {
    if (board.status !== 'playing' || !clockRunning || tutorial.open) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [board.status, clockRunning, tutorial.open])

  useEffect(() => {
    if (dailyOn) return
    if (board.status === 'won' && setBestIfLower(BEST_KEYS.minesweeper, elapsed)) {
      setBest(elapsed)
    }
  }, [board.status, elapsed, dailyOn])

  // A finished daily is remembered for the day: one try each.
  useEffect(() => {
    if (!dailyOn || dailyResult || board.status === 'playing') return
    const result = { date: dailyOn, won: board.status === 'won', time: elapsed }
    writeJson(DAILY_KEY, result)
    setDailyResult(result)
  }, [board.status, dailyOn, dailyResult, elapsed])

  const reset = useCallback(() => {
    setDailyOn(null)
    setDailyResult(null)
    setBoard(createBoard(ROWS, COLS, MINES))
    setElapsed(0)
  }, [])

  const postDaily = async (e: React.FormEvent) => {
    e.preventDefault()
    if (posting || !dailyResult?.won || !name.trim()) return
    setPosting(true); setPostMsg('')
    writeJson(NAME_KEY, name.trim())
    try {
      const r = await fetch('/api/highscores/daily', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: 'minesweeper', date: dailyResult.date, name: name.trim(), score: dailyResult.time, website }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) { setPostMsg(d.error || labels.daily.error); return }
      setPostMsg(typeof d.rank === 'number' ? labels.daily.posted.replace('{n}', String(d.rank)) : labels.daily.posted.replace('#{n}', ''))
    } catch { setPostMsg(labels.daily.error) } finally { setPosting(false) }
  }

  const dailyLocked = Boolean(dailyOn && dailyResult)
  const doReveal = (r: number, c: number) => { if (dailyLocked) return; if (dailyOn) setDailyStarted(true); setBoard((b) => reveal(b, r, c)) }
  const doFlag = (r: number, c: number) => { if (dailyLocked) return; if (dailyOn) setDailyStarted(true); setBoard((b) => toggleFlag(b, r, c)) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const move = ({
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    } as Record<string, [number, number]>)[e.key]
    if (move) {
      e.preventDefault()
      const r = Math.min(ROWS - 1, Math.max(0, focus.r + move[0]))
      const c = Math.min(COLS - 1, Math.max(0, focus.c + move[1]))
      setFocus({ r, c })
      ;(gridRef.current?.querySelector(`[data-cell="${r}-${c}"]`) as HTMLButtonElement | null)?.focus()
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault()
      doFlag(focus.r, focus.c)
    }
  }

  const status = board.status === 'won' ? labels.won : board.status === 'lost' ? labels.lost : ''
  const pixelFont = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

  // Portrait: cells as big as fit, up to 32px, after the counters row and the
  // Reveal/Flag toggle row have taken their share of the screen.
  const contentH = h - 44
  const cell = portrait
    ? Math.max(1, Math.min(
      PORTRAIT_MAX_CELL,
      Math.floor((w - 16) / COLS),
      Math.floor((contentH - PORTRAIT_COUNTERS_H - PORTRAIT_TOGGLE_H - PORTRAIT_GAPS) / ROWS),
    ))
    : CELL

  const grid = (cellSize: number) => (
    <div
      ref={gridRef}
      role="group"
      aria-label={labels.board}
      onKeyDown={onKeyDown}
      className="grid"
      style={{ gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)` }}
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const r = Math.floor(i / COLS)
        const c = i % COLS
        const cellData = board.cells[i]
        const revealed = cellData.state === 'revealed'
        return (
          <button
            key={i}
            type="button"
            data-cell={`${r}-${c}`}
            tabIndex={focus.r === r && focus.c === c ? 0 : -1}
            aria-label={labels.cell.replace('{r}', String(r + 1)).replace('{c}', String(c + 1))}
            onFocus={() => setFocus({ r, c })}
            onClick={() => {
              if (pressFlagged.current) { pressFlagged.current = false; return }
              if (flagMode) doFlag(r, c)
              else doReveal(r, c)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              doFlag(r, c)
            }}
            onPointerDown={(e) => {
              // A long-press left over from a cancelled touch must not swallow this tap.
              pressFlagged.current = false
              if (e.pointerType !== 'mouse') {
                longPress.current = setTimeout(() => {
                  pressFlagged.current = true
                  doFlag(r, c)
                }, 350)
              }
            }}
            onPointerUp={() => clearTimeout(longPress.current)}
            onPointerLeave={() => clearTimeout(longPress.current)}
            onPointerCancel={() => clearTimeout(longPress.current)}
            className="outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
            style={{
              width: cellSize,
              height: cellSize,
              fontSize: cellSize >= 32 ? '16px' : '12px',
              lineHeight: 1,
              backgroundColor: revealed ? '#e8e0d8' : '#c8b8a8',
              border: revealed ? '1px solid #d8c8b8' : '2px outset #e8e0d8',
              color: revealed && cellData.adjacent > 0 ? NUMBER_COLORS[cellData.adjacent] : '#3a3028',
              ...pixelFont,
            }}
          >
            {cellData.state === 'flagged' ? '⚑' : revealed ? (cellData.mine ? '✱' : cellData.adjacent || '') : ''}
          </button>
        )
      })}
    </div>
  )

  const small = portrait ? 11 : 9
  // Shown once today's daily is done, whether just now or earlier today.
  const dailyPanel = dailyOn && dailyResult && (
    <ArcadeOverlay>
      <ArcadePanel className="px-4 py-3 text-center" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', maxWidth: portrait ? 280 : 300 }}>
        <p style={{ fontSize: portrait ? 13 : 11, margin: 0 }}>
          {dailyResult.won ? labels.daily.won.replace('{s}', String(dailyResult.time)) : labels.daily.lost}
        </p>
        <p style={{ fontSize: small, margin: 0, opacity: 0.8 }}>{untilNext(labels.daily)}</p>
        {dailyResult.won && (
          <form onSubmit={postDaily} className="flex items-center gap-1.5">
            <input aria-label={labels.daily.namePh} placeholder={labels.daily.namePh} maxLength={16} value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ ...pixelFont, fontSize: portrait || mobile ? 16 : 10, width: portrait ? 130 : 110, height: portrait ? 38 : 22, padding: '2px 4px', color: ARCADE.ink, backgroundColor: '#fffef5', border: `1px solid ${ARCADE.stripBorder}`, textShadow: 'none' }} />
            <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)}
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
            <ArcadeButton type="submit" tone="cream" size={portrait ? 'xl' : 'sm'} disabled={posting || !name.trim()}>
              {posting ? labels.daily.posting : labels.daily.post}
            </ArcadeButton>
          </form>
        )}
        {postMsg && <p aria-live="polite" style={{ fontSize: small, margin: 0 }}>{postMsg}</p>}
        <ArcadeButton tone="cream" size={portrait ? 'xl' : 'sm'} onClick={reset}>{labels.daily.classic}</ArcadeButton>
      </ArcadePanel>
    </ArcadeOverlay>
  )

  return (
    <ArcadeFrame fs={fs} portrait={portrait}>
      <ScreenStrip time={time} fs={fs} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack}>
        <TutorialButton tutorial={tutorial} />
        <StripButton pressed={Boolean(dailyOn)} onClick={dailyOn ? reset : startDaily}>{labels.daily.button}</StripButton>
        {mobile && !portrait && (
          <>
            <StripButton pressed={!flagMode} onClick={() => setFlagMode(false)}>{labels.reveal}</StripButton>
            <StripButton pressed={flagMode} onClick={() => setFlagMode(true)}>{labels.flag}</StripButton>
          </>
        )}
      </ScreenStrip>

      {portrait ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Counters row */}
          <div
            className="flex items-center gap-1.5 px-2 border-b flex-shrink-0"
            style={{ height: PORTRAIT_COUNTERS_H, backgroundColor: ARCADE.strip, borderColor: ARCADE.stripBorder, fontSize: 12, color: ARCADE.ink, ...pixelFont }}
          >
            <span>{labels.minesLeft.replace('{n}', String(MINES - flagCount(board)))}</span>
            <span>{labels.time.replace('{s}', String(elapsed))}</span>
            {dailyOn ? <span>{labels.daily.title.replace('{date}', dailyOn.slice(5))}</span>
              : best > 0 && <span>{labels.best.replace('{s}', String(best))}</span>}
            <span aria-live="polite" className="sr-only">{status}</span>
            <span className="ml-auto">
              <StripButton onClick={reset}>{dailyOn ? labels.daily.classic : labels.reset}</StripButton>
            </span>
          </div>

          {/* Board */}
          <div className="relative flex-1 flex items-center justify-center min-h-0">
            {grid(cell)}
            {dailyPanel}
          </div>

          {/* Reveal/Flag toggle, replaced by the result once the game ends */}
          <div className="flex items-center justify-center gap-2 flex-shrink-0" style={{ height: PORTRAIT_TOGGLE_H }}>
            {status ? (
              <span aria-hidden style={{ fontSize: 14, color: ARCADE.ink, ...pixelFont }}>{status}</span>
            ) : (
              <>
                <ArcadeButton size="xl" pressed={!flagMode} onClick={() => setFlagMode(false)}>{labels.reveal}</ArcadeButton>
                <ArcadeButton size="xl" pressed={flagMode} onClick={() => setFlagMode(true)}>{labels.flag}</ArcadeButton>
              </>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Status bar */}
          <div
            className="flex items-center gap-3 pl-3 pr-[5px] border-b flex-shrink-0"
            style={{ height: 24, backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontSize: '10px', color: '#3a3028', ...pixelFont }}
          >
            <span>{labels.minesLeft.replace('{n}', String(MINES - flagCount(board)))}</span>
            <span>{labels.time.replace('{s}', String(elapsed))}</span>
            {dailyOn ? <span>{labels.daily.title.replace('{date}', dailyOn)}</span>
              : best > 0 && <span>{labels.best.replace('{s}', String(best))}</span>}
            <span aria-live="polite">{status}</span>
            <span className="ml-auto">
              <StripButton onClick={reset}>{dailyOn ? labels.daily.classic : labels.reset}</StripButton>
            </span>
          </div>

          {/* Board */}
          <div className="relative flex-1 flex items-center justify-center">
            {grid(CELL)}
            {dailyPanel}
          </div>
        </>
      )}
      {tutorial.open && <MinesTutorial labels={labels} onClose={tutorial.close} />}
    </ArcadeFrame>
  )
}
