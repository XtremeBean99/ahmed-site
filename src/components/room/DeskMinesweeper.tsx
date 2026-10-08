// src/components/room/DeskMinesweeper.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBoard, reveal, toggleFlag, flagCount, type Board } from '@/lib/games/minesweeper-engine'
import { getBest, setBestIfLower, BEST_KEYS } from '@/lib/games/storage'
import { useStageScale } from '@/lib/room/useStageScale'
import { ScreenStrip, StripButton, useDeskScreen } from './ScreenStrip'
import { ArcadeButton, ArcadeFrame, useFullscreen } from './DeskArcade'
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

  useEffect(() => {
    setBest(getBest(BEST_KEYS.minesweeper))
  }, [])

  // Timer runs from the first reveal until the game ends, and stops while How to play is open
  useEffect(() => {
    if (board.status !== 'playing' || !board.minesPlaced || tutorial.open) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [board.status, board.minesPlaced, tutorial.open])

  useEffect(() => {
    if (board.status === 'won' && setBestIfLower(BEST_KEYS.minesweeper, elapsed)) {
      setBest(elapsed)
    }
  }, [board.status, elapsed])

  const reset = useCallback(() => {
    setBoard(createBoard(ROWS, COLS, MINES))
    setElapsed(0)
  }, [])

  const doReveal = (r: number, c: number) => setBoard((b) => reveal(b, r, c))
  const doFlag = (r: number, c: number) => setBoard((b) => toggleFlag(b, r, c))

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

  return (
    <ArcadeFrame fs={fs} portrait={portrait}>
      <ScreenStrip time={time} fs={fs} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack}>
        <TutorialButton tutorial={tutorial} />
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
            {best > 0 && <span>{labels.best.replace('{s}', String(best))}</span>}
            <span aria-live="polite" className="sr-only">{status}</span>
            <span className="ml-auto">
              <StripButton onClick={reset}>{labels.reset}</StripButton>
            </span>
          </div>

          {/* Board */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            {grid(cell)}
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
            {best > 0 && <span>{labels.best.replace('{s}', String(best))}</span>}
            <span aria-live="polite">{status}</span>
            <span className="ml-auto">
              <StripButton onClick={reset}>{labels.reset}</StripButton>
            </span>
          </div>

          {/* Board */}
          <div className="flex-1 flex items-center justify-center">
            {grid(CELL)}
          </div>
        </>
      )}
      {tutorial.open && <MinesTutorial labels={labels} onClose={tutorial.close} />}
    </ArcadeFrame>
  )
}
