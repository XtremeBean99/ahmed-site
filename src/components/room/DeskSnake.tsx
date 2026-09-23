// src/components/room/DeskSnake.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { createGame, step, turn, tickMs, type Dir } from '@/lib/games/snake-engine'
import { getBest, setBestIfHigher, BEST_KEYS } from '@/lib/games/storage'
import { ScreenStrip, StripButton } from './ScreenStrip'

const COLS = 14
const ROWS = 14
const CELL = 16
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
  const [game, setGame] = useState(() => createGame(COLS, ROWS))
  const [best, setBest] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    setBest(getBest(BEST_KEYS.snake))
  }, [])

  const reset = useCallback(() => {
    setGame(createGame(COLS, ROWS))
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
        setGame((s) => turn(s, dir))
        setPaused(false)
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
  }, [game.status, reset])

  // Coming back to a snake that died in a background tab is nobody's idea of fun.
  useEffect(() => {
    const onHide = () => { if (document.hidden) setPaused(true) }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  const pixelFont = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const
  const overlay =
    game.status === 'over' ? labels.over : game.status === 'won' ? labels.won : paused ? labels.paused : ''

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
        <span>{labels.score.replace('{n}', String(game.score))}</span>
        {best > 0 && <span>{labels.best.replace('{n}', String(best))}</span>}
        <span aria-live="polite">{overlay}</span>
        <span className="ml-auto">
          <StripButton onClick={reset}>{labels.reset}</StripButton>
        </span>
      </div>

      {/* Board */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5">
        <div
          role="img"
          aria-label={labels.board}
          className="relative"
          style={{
            width: COLS * CELL,
            height: ROWS * CELL,
            // globals.css sets box-sizing: border-box globally, which would shrink
            // the padding box by the border and throw the last row and column out
            // of step with the grid. Cells are positioned inside it, so opt out.
            boxSizing: 'content-box',
            backgroundColor: BOARD,
            border: '2px solid #c8b8a8',
            backgroundImage: `repeating-linear-gradient(90deg, ${GRID} 0 1px, transparent 1px ${CELL}px), repeating-linear-gradient(180deg, ${GRID} 0 1px, transparent 1px ${CELL}px)`,
          }}
        >
          {game.food && (
            <svg
              className="absolute"
              style={{ left: game.food.x * CELL + 1, top: game.food.y * CELL + 1 }}
              width={CELL - 2}
              height={CELL - 2}
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
              style={{ left: p.x * CELL + 1, top: p.y * CELL + 1, width: CELL - 2, height: CELL - 2, backgroundColor: i === 0 ? HEAD : BODY }}
            />
          ))}

          {overlay && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(232,224,216,0.75)' }}>
              <div
                className="border-2 px-4 py-2 text-center"
                style={{ backgroundColor: '#3d2e1e', borderColor: '#5a4430', borderRadius: '3px', color: '#e8d5b0', ...pixelFont }}
              >
                <p style={{ fontSize: '12px' }}>{overlay}</p>
                <button
                  type="button"
                  onClick={() => (paused && game.status === 'playing' ? setPaused(false) : reset())}
                  className="mt-1.5 border px-2 py-0.5 outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8d5b0]"
                  style={{ borderColor: '#5a4430', backgroundColor: '#2d2116', fontSize: '9px', color: '#c8b89a', ...pixelFont }}
                >
                  {paused && game.status === 'playing' ? labels.resume : labels.reset}
                </button>
              </div>
            </div>
          )}
        </div>
        <p style={{ fontSize: '9px', color: '#8a7a68', ...pixelFont }}>{labels.hint}</p>
      </div>
    </div>
  )
}
