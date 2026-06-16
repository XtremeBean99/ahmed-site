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
} from '@/lib/games/breakout-engine'
import type { GameState } from '@/lib/games/types'
import { getBest, setBestIfHigher, BEST_KEYS } from '@/lib/games/storage'

const LOGICAL_W = 800
const LOGICAL_H = 600
const CONFIG = { width: LOGICAL_W, height: LOGICAL_H, cols: 10, rows: 6, lives: 3 } as const

export function Breakout() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createInitialState(CONFIG))
  const rafRef = useRef<number>(0)
  const lastRef = useRef<number>(0)
  const reduceRef = useRef(false)

  // HUD mirror (read from state each frame, throttled by React batching).
  const [hud, setHud] = useState<{ score: number; lives: number; status: GameState['status'] }>({ score: 0, lives: CONFIG.lives, status: 'ready' })
  const [best, setBest] = useState(0)

  const resetGame = useCallback(() => {
    stateRef.current = createInitialState(CONFIG)
    setHud({ score: 0, lives: CONFIG.lives, status: 'ready' })
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
      setHud((h) =>
        h.score === s.score && h.lives === s.lives && h.status === s.status
          ? h
          : { score: s.score, lives: s.lives, status: s.status },
      )
      if (s.status === 'won' || s.status === 'lost') {
        if (setBestIfHigher(BEST_KEYS.breakout, s.score)) setBest(s.score)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafRef.current)
      io.disconnect()
    }
  }, [draw])

  // Pointer -> paddle.
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W
    setPaddleX(stateRef.current, x)
  }, [])

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
      ? 'Press space or tap to launch'
      : hud.status === 'paused'
        ? 'Paused'
        : hud.status === 'won'
          ? `Cleared. Score ${hud.score}.`
          : hud.status === 'lost'
            ? `Game over. Score ${hud.score}.`
            : ''

  return (
    <div className="max-w-3xl">
      <div className="grid grid-cols-3 gap-6 border-y border-border py-6">
        <GameStat label="Score" value={hud.score} />
        <GameStat label="Lives" value={hud.lives} />
        <GameStat label="Best" value={best} />
      </div>

      <div className="relative mt-10 select-none">
        <canvas
          ref={canvasRef}
          onPointerMove={onPointerMove}
          onPointerDown={launchOrPause}
          role="img"
          aria-label="Breakout game playfield"
          className="w-full rounded-lg border border-border bg-background touch-none"
          style={{ aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}` }}
        />
        {overlayText && (
          <button
            type="button"
            onClick={launchOrPause}
            className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg text-foreground font-serif text-2xl"
          >
            {overlayText}
          </button>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Mouse or touch to move. Arrow keys or A and D also work. Space launches and pauses,
        P pauses, R restarts. E widens the paddle, M splits the ball, S slows it down, plus adds a life.
      </p>
    </div>
  )
}
