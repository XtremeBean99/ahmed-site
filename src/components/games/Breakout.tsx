'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GameStat } from './GameStat'
import {
  createInitialState,
  setPaddleX,
  startGame,
  stepPhysics,
  togglePause,
  POWERUP_META,
  SCORE_BASE,
} from '@/lib/games/breakout-engine'
import type { GameState } from '@/lib/games/types'
import { getBest, setBestIfHigher, addScore, getTopScores, BEST_KEYS, SCORES_KEYS } from '@/lib/games/storage'
import { useT } from '@/lib/i18n/client'

const LOGICAL_W = 800
const LOGICAL_H = 600
const CONFIG = { width: LOGICAL_W, height: LOGICAL_H, cols: 10, rows: 6, lives: 3 } as const

/** Format a whole-second count as m:ss. */
function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Breakout() {
  const t = useT().breakout
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createInitialState(CONFIG))
  const rafRef = useRef<number>(0)
  const lastRef = useRef<number>(0)
  const reduceRef = useRef(false)
  const scoredRef = useRef(false)

  // HUD mirror. Updates at most once per second (plus on lives/status change)
  // to avoid a React re-render on every animation frame.
  const [hud, setHud] = useState<{
    seconds: number
    lives: number
    status: GameState['status']
    score: number
    elapsedMs: number
  }>({ seconds: 0, lives: CONFIG.lives, status: 'ready', score: SCORE_BASE, elapsedMs: 0 })
  const [best, setBest] = useState(0)
  const [topScores, setTopScores] = useState<number[]>([])

  const resetGame = useCallback(() => {
    stateRef.current = createInitialState(CONFIG)
    scoredRef.current = false
    setHud({ seconds: 0, lives: CONFIG.lives, status: 'ready', score: SCORE_BASE, elapsedMs: 0 })
  }, [])

  // Draw a single frame.
  const draw = useCallback((ctx: CanvasRenderingContext2D, s: GameState) => {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H)
    // Playfield border
    ctx.strokeStyle = '#27272a'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, LOGICAL_W - 2, LOGICAL_H - 2)
    // Bricks (alpha banded by row for monochrome depth)
    for (const b of s.bricks) {
      if (!b.alive) continue
      const alpha = 0.55 + (b.row / Math.max(CONFIG.rows - 1, 1)) * 0.4
      ctx.fillStyle = `rgba(250,250,250,${alpha})`
      ctx.fillRect(b.x, b.y, b.width, b.height)
    }
    // Paddle
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(s.paddle.x - s.paddle.width / 2, s.paddle.y - s.paddle.height / 2, s.paddle.width, s.paddle.height)
    // Balls
    for (const ball of s.balls) {
      ctx.beginPath()
      ctx.arc(ball.pos.x, ball.pos.y, ball.radius, 0, Math.PI * 2)
      ctx.fill()
    }
    // Power-up capsules (white pill, zinc border, glyph)
    for (const pu of s.powerUps) {
      const x = pu.pos.x - pu.width / 2
      const y = pu.pos.y - pu.height / 2
      ctx.fillStyle = '#fafafa'
      ctx.strokeStyle = '#27272a'
      ctx.lineWidth = 1
      const r = pu.height / 2
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath()
        ctx.roundRect(x, y, pu.width, pu.height, r)
        ctx.fill()
        ctx.stroke()
      } else {
        ctx.fillRect(x, y, pu.width, pu.height)
        ctx.strokeRect(x, y, pu.width, pu.height)
      }
      ctx.fillStyle = '#09090b'
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(POWERUP_META[pu.kind].glyph, pu.pos.x, pu.pos.y + 0.5)
    }
  }, [])

  // Game loop.
  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setBest(getBest(BEST_KEYS.breakout))
    setTopScores(getTopScores(SCORES_KEYS.breakout))

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    // DPR-aware sizing against the logical resolution.
    const setupSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = LOGICAL_W * dpr
      canvas.height = LOGICAL_H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    setupSize()

    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.1 })
    io.observe(canvas)

    const tick = (t: number) => {
      const s = stateRef.current
      const last = lastRef.current || t
      let dt = (t - last) / 1000
      lastRef.current = t
      if (dt > 0.05) dt = 0.05 // clamp after tab switch
      const active = visible && !document.hidden
      if (active && s.status === 'playing') stepPhysics(s, dt)
      draw(ctx, s)
      const seconds = Math.floor(s.elapsedMs / 1000)
      setHud((h) =>
        h.seconds === seconds && h.lives === s.lives && h.status === s.status
          ? h
          : { seconds, lives: s.lives, status: s.status, score: s.score, elapsedMs: s.elapsedMs },
      )
      if (s.status === 'won') {
        if (!scoredRef.current) {
          scoredRef.current = true
          if (setBestIfHigher(BEST_KEYS.breakout, s.score)) setBest(s.score)
          addScore(SCORES_KEYS.breakout, s.score)
          setTopScores(getTopScores(SCORES_KEYS.breakout))
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      io.disconnect()
    }
  }, [draw])

  // Pointer -> paddle. Used by both move and down so the paddle tracks the
  // finger/cursor immediately.
  const movePaddleToEvent = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W
    setPaddleX(stateRef.current, x)
  }, [])

  // Touch/click on the canvas moves the paddle and may launch or restart - but
  // it must NOT toggle pause, otherwise every drag-to-move on a touchscreen
  // pauses the game. Pausing is done with the dedicated control button.
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    movePaddleToEvent(e)
    const s = stateRef.current
    if (s.status === 'ready') startGame(s)
    else if (s.status === 'won' || s.status === 'lost') resetGame()
    else if (s.status === 'paused') togglePause(s)
  }, [movePaddleToEvent, resetGame])

  // Explicit launch/pause/resume/restart - for the keyboard, the overlay, and
  // the on-screen control button.
  const launchOrPause = useCallback(() => {
    const s = stateRef.current
    if (s.status === 'ready') startGame(s)
    else if (s.status === 'won' || s.status === 'lost') resetGame()
    else togglePause(s)
  }, [resetGame])

  // Keyboard controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current
      const step = 40
      if (e.key === 'ArrowLeft' || e.key === 'a') setPaddleX(s, s.paddle.x - step)
      else if (e.key === 'ArrowRight' || e.key === 'd') setPaddleX(s, s.paddle.x + step)
      else if (e.key === ' ') {
        e.preventDefault()
        launchOrPause()
      } else if (e.key === 'p') togglePause(s)
      else if (e.key === 'r') resetGame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [launchOrPause, resetGame])

  const overlayText =
    hud.status === 'ready'
      ? t.launch
      : hud.status === 'paused'
        ? t.paused
        : hud.status === 'won'
          ? `${t.clearedBefore}${(hud.elapsedMs / 1000).toFixed(1)}${t.clearedAfter}${hud.score}.`
          : hud.status === 'lost'
            ? t.gameOver
            : ''

  // Label for the on-screen control button, by current status.
  const controlLabel =
    hud.status === 'ready'
      ? t.start
      : hud.status === 'playing'
        ? t.pause
        : hud.status === 'paused'
          ? t.resume
          : t.restart

  return (
    <div className="max-w-3xl">
      <div className="grid grid-cols-4 gap-4 border-y border-border py-6">
        <GameStat label={t.time} value={formatClock(hud.seconds)} />
        <GameStat label={t.score} value={hud.score} />
        <GameStat label={t.lives} value={hud.lives} />
        <GameStat label={t.best} value={best} />
      </div>

      <div className="relative mt-10 select-none">
        <canvas
          ref={canvasRef}
          onPointerMove={movePaddleToEvent}
          onPointerDown={onPointerDown}
          role="img"
          aria-label={t.playfield}
          className="w-full rounded-lg border border-border bg-transparent touch-none"
          style={{ aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}` }}
        />
        <noscript>
          <div className="flex items-center justify-center rounded-lg border border-border bg-surface py-24 text-center text-muted-foreground" style={{ aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}` }}>
            JavaScript is required to play Breakout.
          </div>
        </noscript>
        {overlayText && (
          <button
            type="button"
            onClick={launchOrPause}
            aria-live="polite"
            className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg text-foreground font-serif text-2xl"
          >
            {overlayText}
          </button>
        )}
      </div>

      {/* On-screen controls - essential on touch devices, where there is no
          keyboard to launch/pause/restart. */}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={launchOrPause}
          className="bg-foreground text-background px-5 py-2 rounded-md text-sm font-medium hover:bg-muted-foreground transition-colors"
        >
          {controlLabel}
        </button>
        {(hud.status === 'playing' || hud.status === 'paused') && (
          <button
            type="button"
            onClick={resetGame}
            className="border border-border text-foreground px-5 py-2 rounded-md text-sm font-medium hover:bg-surface-hover transition-colors"
          >
            {t.restart}
          </button>
        )}
      </div>

      {topScores.length > 0 && (
        <div className="mt-6 border-t border-border pt-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">{t.topScores}</p>
          <ol className="space-y-1">
            {topScores.map((s, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-muted-foreground text-right">{i + 1}.</span>
                <span className="tabular-nums text-foreground">{s.toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        {t.instructions}
      </p>
    </div>
  )
}
