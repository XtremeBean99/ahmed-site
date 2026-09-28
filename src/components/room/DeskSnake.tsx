// src/components/room/DeskSnake.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame, step, turn, tickMs, type Dir } from '@/lib/games/snake-engine'
import { getBest, setBestIfHigher, BEST_KEYS } from '@/lib/games/storage'
import { swipeDirection } from '@/lib/room/gestures'
import { useStageScale } from '@/lib/room/useStageScale'
import { ScreenStrip, StripButton, useDeskScreen } from './ScreenStrip'
import { ArcadeButton, ArcadeFrame, useFullscreen } from './DeskArcade'
import { ARCADE } from './pixel-ui'
import { DeskDpad } from './DeskDpad'

const COLS = 14
const ROWS = 14
const CELL = 16
const PORTRAIT_MAX_CELL = 20
const PORTRAIT_SCORE_H = 24
const PORTRAIT_GAPS = 16
const DPAD_MAX = 52
const DPAD_MIN = 40
// Mirrors DeskDpad's own gap so the block height is exact.
const dpadBlock = (size: number) => size * 3 + 2 * Math.max(2, Math.floor(size / 13))
const BOARD = '#e8e0d8'
const GRID = '#dcd2c4'
const BODY = '#5a7a3a'
const HEAD = '#3a5a2a'
const FOOD = '#8a3a2a'
const SHINE = '#b0553f'
const STEM = '#5a4a3a'
const LEAF = '#5a7a3a'

const KEYS: Record<string, Dir> = {
  arrowup: 'up', w: 'up',
  arrowdown: 'down', s: 'down',
  arrowleft: 'left', a: 'left',
  arrowright: 'right', d: 'right',
}

export interface SnakeLabels {
  board: string
  score: string
  best: string
  reset: string
  over: string
  won: string
  paused: string
  resume: string
  hint: string
  pause: string
  hintTouch: string
  dpadUp: string
  dpadDown: string
  dpadLeft: string
  dpadRight: string
}

interface DeskSnakeProps {
  time: string
  backLabel: string
  desktopLabel: string
  labels: SnakeLabels
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
}

export function DeskSnake({ time, backLabel, desktopLabel, labels, onBack, onDesktop }: DeskSnakeProps) {
  const fs = useFullscreen()
  const { portrait, w, h } = useDeskScreen()
  const { mobile } = useStageScale()
  const [game, setGame] = useState(() => createGame(COLS, ROWS))
  const [best, setBest] = useState(0)
  const [paused, setPaused] = useState(false)
  const swipeStart = useRef<{ x: number; y: number; steered: boolean } | null>(null)

  // Portrait phones steer with swipes or the D-pad; touch landscape gets the
  // D-pad beside the board. A desktop with a mouse is untouched.
  const touch = portrait || mobile

  useEffect(() => {
    setBest(getBest(BEST_KEYS.snake))
  }, [])

  const reset = useCallback(() => {
    setGame(createGame(COLS, ROWS))
    setPaused(false)
  }, [])

  const steer = useCallback((dir: Dir) => {
    setGame((s) => turn(s, dir))
    setPaused(false)
  }, [])

  // The interval is rebuilt on each score change so the game speeds up.
  useEffect(() => {
    if (game.status !== 'playing' || paused) return
    const id = setInterval(() => setGame((s) => step(s)), tickMs(game.score))
    return () => clearInterval(id)
  }, [game.status, game.score, paused])

  useEffect(() => {
    if (game.status !== 'playing' && setBestIfHigher(BEST_KEYS.snake, game.score)) setBest(game.score)
  }, [game.status, game.score])

  // The game owns the screen while it is open, so keys are read from the window
  // rather than a focused element: clicking the desk must not break the controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEYS[e.key.toLowerCase()]
      if (dir) {
        e.preventDefault()
        steer(dir)
      } else if (e.key === ' ') {
        e.preventDefault()
        setPaused((p) => !p)
      } else if (e.key === 'Enter' && game.status !== 'playing') {
        e.preventDefault()
        reset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [game.status, reset, steer])

  // Coming back to a snake that died in a background tab is nobody's idea of fun.
  useEffect(() => {
    const onHide = () => { if (document.hidden) setPaused(true) }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  const onBoardPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!touch || (e.target as HTMLElement).closest('button')) return
    swipeStart.current = { x: e.clientX, y: e.clientY, steered: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  // One finger can chain turns: each turn restarts the swipe from where it fired.
  const onBoardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    if (!start) return
    const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y)
    if (!dir) return
    swipeStart.current = { x: e.clientX, y: e.clientY, steered: true }
    steer(dir)
  }
  const onBoardPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = swipeStart.current
    if (!start) return
    swipeStart.current = null
    const dir = swipeDirection(e.clientX - start.x, e.clientY - start.y)
    if (dir) steer(dir)
    // Only a plain tap restarts: lifting the finger after a swipe that ended the game must not.
    else if (!start.steered && game.status !== 'playing') reset()
  }
  const onBoardPointerCancel = () => {
    swipeStart.current = null
  }

  const pixelFont = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const
  const overlay =
    game.status === 'over' ? labels.over : game.status === 'won' ? labels.won : paused ? labels.paused : ''
  const dpadLabels = { up: labels.dpadUp, down: labels.dpadDown, left: labels.dpadLeft, right: labels.dpadRight }

  // Portrait: cells as big as fit, up to 20px, after the strip, toolbar, score
  // row and D-pad have taken their share. On short screens the D-pad shrinks
  // (not below 40px) before the board drops under 16px cells.
  const avail = h - 88 - PORTRAIT_SCORE_H - PORTRAIT_GAPS
  const dpad = Math.max(DPAD_MIN, Math.min(DPAD_MAX, Math.floor((avail - (ROWS * 16 + 4) - 8) / 3)))
  const cell = portrait
    ? Math.max(1, Math.min(
      PORTRAIT_MAX_CELL,
      Math.floor((w - 16) / COLS),
      Math.floor((avail - dpadBlock(dpad) - 4) / ROWS),
    ))
    : CELL

  const board = (cellSize: number) => (
    <div
      role="img"
      aria-label={labels.board}
      className="relative"
      onPointerDown={onBoardPointerDown}
      onPointerMove={onBoardPointerMove}
      onPointerUp={onBoardPointerUp}
      onPointerCancel={onBoardPointerCancel}
      style={{
        width: COLS * cellSize,
        height: ROWS * cellSize,
        // globals.css sets box-sizing: border-box globally, which would shrink
        // the padding box by the border and throw the last row and column out
        // of step with the grid. Cells are positioned inside it, so opt out.
        boxSizing: 'content-box',
        backgroundColor: BOARD,
        border: '2px solid #c8b8a8',
        touchAction: touch ? 'none' : undefined,
        backgroundImage: `repeating-linear-gradient(90deg, ${GRID} 0 1px, transparent 1px ${cellSize}px), repeating-linear-gradient(180deg, ${GRID} 0 1px, transparent 1px ${cellSize}px)`,
      }}
    >
      {game.food && (
        <svg
          className="absolute"
          style={{ left: game.food.x * cellSize + 1, top: game.food.y * cellSize + 1 }}
          width={cellSize - 2}
          height={cellSize - 2}
          viewBox="0 0 7 7"
          shapeRendering="crispEdges"
          aria-hidden
        >
          <rect x="3" y="0" width="1" height="1" fill={STEM} />
          <rect x="4" y="0" width="2" height="1" fill={LEAF} />
          <rect x="2" y="1" width="3" height="1" fill={FOOD} />
          <rect x="1" y="2" width="5" height="1" fill={FOOD} />
          <rect x="0" y="3" width="7" height="2" fill={FOOD} />
          <rect x="1" y="5" width="5" height="1" fill={FOOD} />
          <rect x="2" y="6" width="3" height="1" fill={FOOD} />
          <rect x="2" y="2" width="1" height="1" fill={SHINE} />
        </svg>
      )}
      {game.snake.map((p, i) => (
        <span
          key={`${p.x}-${p.y}`}
          className="absolute"
          style={{ left: p.x * cellSize + 1, top: p.y * cellSize + 1, width: cellSize - 2, height: cellSize - 2, backgroundColor: i === 0 ? HEAD : BODY }}
        />
      ))}

      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(232,224,216,0.75)' }}>
          <div
            className="border-2 px-4 py-2 text-center"
            style={{ backgroundColor: '#3d2e1e', borderColor: '#5a4430', borderRadius: '3px', color: '#e8d5b0', ...pixelFont }}
          >
            <p style={{ fontSize: portrait ? 14 : 12 }}>{overlay}</p>
            <ArcadeButton
              size={portrait ? 'xl' : 'sm'}
              className="mt-1.5"
              onClick={() => (paused && game.status === 'playing' ? setPaused(false) : reset())}
            >
              {paused && game.status === 'playing' ? labels.resume : labels.reset}
            </ArcadeButton>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <ArcadeFrame fs={fs} portrait={portrait}>
      <ScreenStrip time={time} fs={fs} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack}>
        {portrait && (
          <>
            <StripButton onClick={() => setPaused((p) => !p)}>{paused ? labels.resume : labels.pause}</StripButton>
            <StripButton onClick={reset}>{labels.reset}</StripButton>
          </>
        )}
      </ScreenStrip>

      {portrait ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Score row */}
          <div
            className="flex items-center gap-2 px-3 border-b flex-shrink-0"
            style={{ height: PORTRAIT_SCORE_H, backgroundColor: ARCADE.strip, borderColor: ARCADE.stripBorder, fontSize: 12, color: ARCADE.ink, ...pixelFont }}
          >
            <span>{labels.score.replace('{n}', String(game.score))}</span>
            {best > 0 && <span>{labels.best.replace('{n}', String(best))}</span>}
            <span aria-live="polite">{overlay}</span>
          </div>

          {/* Board and D-pad, centred in the space that is left */}
          <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0">
            {board(cell)}
            <DeskDpad size={dpad} onDir={steer} labels={dpadLabels} />
          </div>
        </div>
      ) : (
        <>
          {/* Status bar */}
          <div
            className="flex items-center gap-3 pl-3 pr-[5px] border-b flex-shrink-0"
            style={{ height: 24, backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontSize: '10px', color: '#3a3028', ...pixelFont }}
          >
            <span>{labels.score.replace('{n}', String(game.score))}</span>
            {best > 0 && <span>{labels.best.replace('{n}', String(best))}</span>}
            <span aria-live="polite">{overlay}</span>
            <span className="ml-auto">
              <StripButton onClick={reset}>{labels.reset}</StripButton>
            </span>
          </div>

          {/* Board */}
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
            {mobile ? (
              <div className="flex items-center justify-center gap-4">
                {board(CELL)}
                <DeskDpad size={36} onDir={steer} labels={dpadLabels} />
              </div>
            ) : (
              board(CELL)
            )}
            <p style={{ fontSize: '9px', color: ARCADE.phosphorDim, ...pixelFont }}>{mobile ? labels.hintTouch : labels.hint}</p>
          </div>
        </>
      )}
    </ArcadeFrame>
  )
}
