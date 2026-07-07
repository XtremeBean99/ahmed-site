// src/components/room/DeskMinesweeper.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBoard, reveal, toggleFlag, flagCount, type Board } from '@/lib/games/minesweeper-engine'
import { getBest, setBestIfLower, BEST_KEYS } from '@/lib/games/storage'
import { ScreenStrip, StripButton } from './ScreenStrip'

const ROWS = 9
const COLS = 9
const MINES = 10
const CELL = 24
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
  const [board, setBoard] = useState<Board>(() => createBoard(ROWS, COLS, MINES))
  const [elapsed, setElapsed] = useState(0)
  const [best, setBest] = useState(0)
  const [focus, setFocus] = useState({ r: 0, c: 0 })
  const longPress = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pressFlagged = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setBest(getBest(BEST_KEYS.minesweeper))
  }, [])

  // Timer runs from the first reveal until the game ends
  useEffect(() => {
    if (board.status !== 'playing' || !board.minesPlaced) return
    const id = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [board.status, board.minesPlaced])

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

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={() => onDesktop()}>{desktopLabel}</StripButton>
        <StripButton onClick={onBack} ariaLabel={backLabel}>← {backLabel}</StripButton>
      </ScreenStrip>

      {/* Status bar */}
      <div
        className="flex items-center gap-3 px-3 border-b flex-shrink-0"
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
        <div
          ref={gridRef}
          role="group"
          aria-label={labels.board}
          onKeyDown={onKeyDown}
          className="grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, ${CELL}px)` }}
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const r = Math.floor(i / COLS)
            const c = i % COLS
            const cell = board.cells[i]
            const revealed = cell.state === 'revealed'
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
                  doReveal(r, c)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  doFlag(r, c)
                }}
                onPointerDown={(e) => {
                  if (e.pointerType !== 'mouse') {
                    longPress.current = setTimeout(() => {
                      pressFlagged.current = true
                      doFlag(r, c)
                    }, 350)
                  }
                }}
                onPointerUp={() => clearTimeout(longPress.current)}
                onPointerLeave={() => clearTimeout(longPress.current)}
                className="outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                style={{
                  width: CELL,
                  height: CELL,
                  fontSize: '12px',
                  lineHeight: 1,
                  backgroundColor: revealed ? '#e8e0d8' : '#c8b8a8',
                  border: revealed ? '1px solid #d8c8b8' : '2px outset #e8e0d8',
                  color: revealed && cell.adjacent > 0 ? NUMBER_COLORS[cell.adjacent] : '#3a3028',
                  ...pixelFont,
                }}
              >
                {cell.state === 'flagged' ? '⚑' : revealed ? (cell.mine ? '✱' : cell.adjacent || '') : ''}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
