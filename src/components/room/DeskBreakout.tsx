// src/components/room/DeskBreakout.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  APP_H,
  ARCADE,
  ArcadeButton,
  ArcadeFrame,
  ArcadeOverlay,
  ArcadePanel,
  ArcadeStrip,
  CrtOverlay,
  PIXEL_FONT,
  SCREEN_W,
  useCanvasScale,
  useFullscreen,
  type DeskGameProps,
} from './DeskArcade'
import { StripButton } from './ScreenStrip'
import { useSfx } from './RoomSfxProvider'
import { BEST_KEYS, getBest, setBestIfHigher } from '@/lib/games/storage'
import type { BreakoutEvent, BreakoutState, Brick, PowerUpKind } from '@/lib/games/types'
import {
  BALL_SIZE,
  BRICK_H,
  BRICK_W,
  COURT_H,
  COURT_W,
  createGame,
  launch,
  movePaddle,
  nextLevel,
  PADDLE_H,
  PADDLE_Y,
  STEP_MS,
  step,
  togglePause,
} from '@/lib/games/breakout-engine'

const HUD_LINE = 'rgba(240,220,180,0.12)'
const STEEL = '#8a8070'
const BAND_COLORS = ['', '#8a3a5a', '#b3372c', '#e8a83a', '#d8b048', '#7a9a4a', '#4a8a86', '#5a6a9a', '#6a5a8a']
const POWERUP_COLORS: Record<PowerUpKind, string> = {
  wide: ARCADE.amber,
  multi: ARCADE.teal,
  slow: ARCADE.slate,
  life: ARCADE.rust,
  catch: ARCADE.olive,
}
const POWERUP_GLYPHS: Record<PowerUpKind, string> = { wide: 'W', multi: 'M', slow: 'S', life: '+', catch: 'C' }

/** A 3 x 5 block font, drawn at `scale` px per block to match Pong's digits. */
const BLOCK_FONT: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
  S: ['###', '#..', '###', '..#', '###'],
  C: ['###', '#..', '#..', '#..', '###'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  R: ['###', '#.#', '###', '#.#', '#.#'],
  E: ['###', '#..', '###', '#..', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '#.#', '###', '#.#'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  '+': ['...', '.#.', '###', '.#.', '...'],
}

function lighten(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(v + (255 - v) * t)
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 0xff)},${ch(n & 0xff)})`
}

function darken(hex: string, t: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.round(v * (1 - t))
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 0xff)},${ch(n & 0xff)})`
}

function drawBlockText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale = 2,
  gap = 1,
): number {
  ctx.fillStyle = color
  let cx = x
  for (const ch of text.toUpperCase()) {
    const glyph = BLOCK_FONT[ch]
    if (!glyph) {
      cx += 3 * scale + gap
      continue
    }
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (glyph[r][c] === '#') ctx.fillRect(Math.round(cx + c * scale), Math.round(y + r * scale), scale, scale)
      }
    }
    cx += 3 * scale + gap
  }
  return cx
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  age: number
  life: number
}

function spawnParticles(particles: Particle[], x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    if (particles.length >= 200) return
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6
    const speed = 30 + Math.random() * 70
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 30, color, age: 0, life: 0.5 })
  }
}

function drawBrick(ctx: CanvasRenderingContext2D, brick: Brick): void {
  const base = brick.kind === 'steel' ? STEEL : BAND_COLORS[brick.color] ?? ARCADE.phosphor
  const x = brick.x
  const y = brick.y
  const w = brick.w
  const h = brick.h
  if (brick.kind === 'tough') {
    ctx.fillStyle = darken(base, 0.18)
    ctx.fillRect(x, y, w, h)
    const inner = lighten(base, 0.18)
    ctx.fillStyle = inner
    ctx.fillRect(x + 1, y + 1, w - 2, 1)
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1)
    ctx.fillRect(x + 1, y + 1, 1, h - 2)
    ctx.fillRect(x + w - 2, y + 1, 1, h - 2)
    if (brick.hits === 1) {
      ctx.fillStyle = darken(base, 0.45)
      for (let cx = x + 2; cx <= x + w - 3; cx++) {
        const off = ((cx - x) >> 1) % 2 === 0 ? -1 : 1
        ctx.fillRect(cx, Math.round(y + h / 2 + off), 1, 1)
      }
    }
    return
  }
  ctx.fillStyle = base
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = lighten(base, 0.28)
  ctx.fillRect(x, y, w, 1)
  ctx.fillStyle = lighten(base, 0.14)
  ctx.fillRect(x, y, 1, h)
  ctx.fillStyle = darken(base, 0.3)
  ctx.fillRect(x, y + h - 1, w, 1)
  ctx.fillStyle = darken(base, 0.18)
  ctx.fillRect(x + w - 1, y, 1, h)
  if (brick.kind === 'steel') {
    ctx.fillStyle = lighten(STEEL, 0.22)
    ctx.fillRect(x + 2, y + 2, 1, 1)
    ctx.fillRect(x + w - 3, y + 2, 1, 1)
    ctx.fillRect(x + 2, y + h - 3, 1, 1)
    ctx.fillRect(x + w - 3, y + h - 3, 1, 1)
  }
}

export interface BreakoutLabels {
  field: string
  hudScore: string
  hudHi: string
  hudLevel: string
  title: string
  start: string
  best: string
  score: string
  hint: string
  pause: string
  paused: string
  resume: string
  levelClear: string
  lifeLost: string
  over: string
  playAgain: string
  announceOver: string
}

type ViewMode = 'ready' | 'play' | 'paused' | 'clear' | 'over'

export function DeskBreakout({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<BreakoutLabels>) {
  const fs = useFullscreen()
  const { tone } = useSfx()
  const reduce = useReducedMotion() ?? false

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const courtRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<BreakoutState>(createGame())
  const rngRef = useRef<() => number>(Math.random)
  const keysRef = useRef<Set<string>>(new Set())
  const particlesRef = useRef<Particle[]>([])
  const trailRef = useRef<{ x: number; y: number }[][]>([])
  const shakeUntilRef = useRef(0)
  const lastViewRef = useRef<ViewMode>('ready')
  const startedRef = useRef(false)
  const clearTimerRef = useRef<number | null>(null)
  const toneRef = useRef(tone)
  const labelsRef = useRef(labels)
  const reduceRef = useRef(reduce)
  const bestRef = useRef(0)
  toneRef.current = tone
  labelsRef.current = labels
  reduceRef.current = reduce

  const [view, setView] = useState<ViewMode>('ready')
  const [best, setBest] = useState(0)
  const [clearBanner, setClearBanner] = useState<{ level: number; bonus: number } | null>(null)
  const [announce, setAnnounce] = useState('')
  bestRef.current = best

  const k = useCanvasScale(canvasRef, SCREEN_W)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = Math.max(1, Math.round(SCREEN_W * k))
    canvas.height = Math.max(1, Math.round(APP_H * k))
  }, [k])

  useEffect(() => {
    setBest(getBest(BEST_KEYS.breakoutDesk))
  }, [])

  const doLaunch = useCallback(() => {
    const s = stateRef.current
    if (s.status !== 'ready' && s.status !== 'play') return
    launch(s, rngRef.current)
    startedRef.current = true
    toneRef.current('blip')
    lastViewRef.current = s.status
    setView(s.status)
  }, [])

  const doPause = useCallback(() => {
    const s = stateRef.current
    if (s.status !== 'play' && s.status !== 'paused') return
    togglePause(s)
    toneRef.current('select')
    lastViewRef.current = s.status
    setView(s.status)
  }, [])

  const resetGame = useCallback(() => {
    stateRef.current = createGame()
    startedRef.current = false
    particlesRef.current = []
    trailRef.current = []
    setClearBanner(null)
    lastViewRef.current = 'ready'
    setView('ready')
  }, [])

  const syncView = useCallback(() => {
    const s = stateRef.current
    const v = s.status as ViewMode
    if (v === lastViewRef.current) return
    lastViewRef.current = v
    setView(v)
    if (v === 'over') {
      setBestIfHigher(BEST_KEYS.breakoutDesk, s.score)
      setBest(getBest(BEST_KEYS.breakoutDesk))
    }
  }, [])

  const handleEvents = useCallback((events: BreakoutEvent[], s: BreakoutState) => {
    for (const e of events) {
      switch (e.type) {
        case 'paddle':
          toneRef.current('blip')
          break
        case 'wall':
          toneRef.current('bloop')
          break
        case 'brick':
          toneRef.current('brick', 1 + e.row * 0.07)
          spawnParticles(particlesRef.current, e.x + BRICK_W / 2, e.y + BRICK_H / 2, BAND_COLORS[e.color] ?? ARCADE.phosphor, 8)
          break
        case 'tough':
          toneRef.current('select')
          spawnParticles(particlesRef.current, e.x + BRICK_W / 2, e.y + BRICK_H / 2, BAND_COLORS[e.color] ?? ARCADE.phosphor, 3)
          break
        case 'steel':
          toneRef.current('select')
          break
        case 'powerup':
          toneRef.current('powerup')
          break
        case 'life':
          toneRef.current('lose')
          shakeUntilRef.current = performance.now() + 120
          setAnnounce(labelsRef.current.lifeLost.replace('{n}', String(s.lives)))
          break
        case 'clear': {
          toneRef.current('score')
          const bonus = s.lives * 100
          setClearBanner({ level: s.level, bonus })
          setAnnounce(labelsRef.current.levelClear.replace('{n}', String(s.level)).replace('{bonus}', String(bonus)))
          if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
          clearTimerRef.current = window.setTimeout(() => {
            clearTimerRef.current = null
            nextLevel(stateRef.current)
            setClearBanner(null)
            lastViewRef.current = stateRef.current.status
            setView(stateRef.current.status)
          }, 1400)
          break
        }
        case 'over':
          toneRef.current('lose')
          setBestIfHigher(BEST_KEYS.breakoutDesk, s.score)
          setBest(getBest(BEST_KEYS.breakoutDesk))
          setAnnounce(
            labelsRef.current.announceOver
              .replace('{n}', String(s.score))
              .replace('{best}', String(getBest(BEST_KEYS.breakoutDesk))),
          )
          break
      }
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') {
        e.preventDefault()
        keysRef.current.add('left')
      } else if (key === 'arrowright' || key === 'd') {
        e.preventDefault()
        keysRef.current.add('right')
      } else if (e.key === ' ') {
        e.preventDefault()
        doLaunch()
      } else if (key === 'p') {
        e.preventDefault()
        doPause()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'arrowleft' || key === 'a') keysRef.current.delete('left')
      else if (key === 'arrowright' || key === 'd') keysRef.current.delete('right')
    }
    const onBlur = () => keysRef.current.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [doLaunch, doPause])

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) return
      const s = stateRef.current
      if (s.status === 'play') {
        togglePause(s)
        lastViewRef.current = s.status
        setView(s.status)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(
    () => () => {
      const s = stateRef.current
      if (s.score > 0) setBestIfHigher(BEST_KEYS.breakoutDesk, s.score)
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let last = performance.now()
    let acc = 0

    const draw = () => {
      const s = stateRef.current
      const now = performance.now()
      const reduceNow = reduceRef.current
      ctx.setTransform(k, 0, 0, k, 0, 0)
      ctx.clearRect(0, 0, COURT_W, COURT_H)

      let shakeX = 0
      let shakeY = 0
      if (!reduceNow && now < shakeUntilRef.current) {
        shakeX = Math.round((Math.random() - 0.5) * 4)
        shakeY = Math.round((Math.random() - 0.5) * 4)
      }
      ctx.save()
      ctx.translate(shakeX, shakeY)

      ctx.fillStyle = ARCADE.crt
      ctx.fillRect(0, 0, COURT_W, COURT_H)
      const lift = ctx.createRadialGradient(COURT_W / 2, COURT_H / 2, 20, COURT_W / 2, COURT_H / 2, 300)
      lift.addColorStop(0, '#1c140f')
      lift.addColorStop(1, ARCADE.crt)
      ctx.fillStyle = lift
      ctx.fillRect(0, 0, COURT_W, COURT_H)

      // HUD
      ctx.save()
      ctx.shadowColor = ARCADE.phosphorGlow
      ctx.shadowBlur = 6 * k
      const pad = (n: number) => String(Math.min(99999, Math.max(0, n))).padStart(5, '0')
      const x = drawBlockText(ctx, labelsRef.current.hudScore, 8, 5, ARCADE.phosphor, 2, 2)
      drawBlockText(ctx, pad(s.score), x + 6, 5, ARCADE.phosphor, 2, 2)
      const hx = drawBlockText(ctx, labelsRef.current.hudHi, 120, 5, ARCADE.phosphorDim, 2, 2)
      drawBlockText(ctx, pad(bestRef.current), hx + 6, 5, ARCADE.phosphorDim, 2, 2)
      const levelX = Math.round((COURT_W - 54) / 2)
      const levelEnd = drawBlockText(ctx, labelsRef.current.hudLevel, levelX, 5, ARCADE.phosphor, 2, 2)
      drawBlockText(ctx, String(s.level), levelEnd + 6, 5, ARCADE.phosphor, 2, 2)
      ctx.fillStyle = ARCADE.phosphor
      for (let i = 0; i < s.lives; i++) ctx.fillRect(528 - 16 * i - 12, 9, 12, 3)
      ctx.restore()
      ctx.fillStyle = HUD_LINE
      ctx.fillRect(0, 20, COURT_W, 1)

      // Bricks
      for (const brick of s.bricks) if (brick.alive) drawBrick(ctx, brick)

      // Capsules
      for (const pu of s.powerUps) {
        const cx = Math.round(pu.x)
        const cy = Math.round(pu.y)
        ctx.fillStyle = POWERUP_COLORS[pu.kind]
        ctx.fillRect(cx - 6, cy - 3, 12, 1)
        ctx.fillRect(cx - 7, cy - 2, 14, 1)
        ctx.fillRect(cx - 8, cy - 1, 16, 3)
        ctx.fillRect(cx - 7, cy + 2, 14, 1)
        ctx.fillRect(cx - 6, cy + 3, 12, 1)
        drawBlockText(ctx, POWERUP_GLYPHS[pu.kind], cx - 1.5, cy - 2.5, ARCADE.phosphor, 1, 0)
      }

      // Paddle
      ctx.save()
      ctx.shadowColor = ARCADE.phosphorGlow
      ctx.shadowBlur = 6 * k
      const pw = s.paddle.width
      const px = Math.round(s.paddle.x - pw / 2)
      const py = PADDLE_Y - PADDLE_H / 2
      ctx.fillStyle = ARCADE.phosphor
      ctx.fillRect(px, py, pw, PADDLE_H)
      ctx.fillStyle = ARCADE.rust
      ctx.fillRect(px, py, 4, PADDLE_H)
      ctx.fillRect(px + pw - 4, py, 4, PADDLE_H)
      ctx.fillStyle = lighten(ARCADE.phosphor, 0.3)
      ctx.fillRect(px, py, pw, 1)
      if (s.effects.some((e) => e.kind === 'catch')) {
        ctx.fillStyle = ARCADE.amber
        ctx.fillRect(px, py, pw, 1)
      }
      ctx.restore()

      // Ball trail, then the ball
      if (!reduceNow) {
        const snaps = trailRef.current
        if (snaps.length > 0) {
          ctx.save()
          ctx.fillStyle = ARCADE.phosphor
          for (let i = 0; i < snaps.length; i++) {
            ctx.globalAlpha = ((i + 1) / snaps.length) * 0.35
            for (const dot of snaps[i]) ctx.fillRect(Math.round(dot.x - 3), Math.round(dot.y - 3), BALL_SIZE, BALL_SIZE)
          }
          ctx.restore()
        }
      }
      ctx.save()
      ctx.shadowColor = ARCADE.phosphorGlow
      ctx.shadowBlur = 6 * k
      ctx.fillStyle = ARCADE.phosphor
      for (const ball of s.balls) {
        ctx.fillRect(Math.round(ball.x - BALL_SIZE / 2), Math.round(ball.y - BALL_SIZE / 2), BALL_SIZE, BALL_SIZE)
      }
      ctx.restore()

      // Particles
      if (!reduceNow) {
        for (const p of particlesRef.current) {
          ctx.globalAlpha = Math.max(0, 1 - p.age / p.life)
          ctx.fillStyle = p.color
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2)
        }
        ctx.globalAlpha = 1
      }

      ctx.restore()
    }

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dtMs = Math.min(100, now - last)
      last = now
      const dtSec = dtMs / 1000
      const s = stateRef.current
      const reduceNow = reduceRef.current

      if (s.status === 'ready' || s.status === 'play') {
        let dx = 0
        if (keysRef.current.has('left')) dx -= 420 * dtSec
        if (keysRef.current.has('right')) dx += 420 * dtSec
        if (dx !== 0) movePaddle(s, s.paddle.x + dx)
      }

      if (document.hidden) {
        acc = 0
      } else {
        acc += dtMs
        let steps = 0
        while (acc >= STEP_MS && steps < 8) {
          const events = step(s, rngRef.current)
          if (events.length > 0) handleEvents(events, s)
          acc -= STEP_MS
          steps++
        }
        if (steps === 8) acc = 0
      }
      syncView()

      if (!reduceNow) {
        if (s.status === 'play') {
          trailRef.current.push(s.balls.filter((b) => !b.stuck).map((b) => ({ x: b.x, y: b.y })))
          if (trailRef.current.length > 4) trailRef.current.shift()
        } else {
          trailRef.current.length = 0
        }
        const parts = particlesRef.current
        for (const p of parts) {
          p.age += dtSec
          p.x += p.vx * dtSec
          p.y += p.vy * dtSec
          p.vy += 700 * dtSec
        }
        particlesRef.current = parts.filter((p) => p.age < p.life)
      }

      draw()
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [k, handleEvents, syncView])

  const courtToLocal = (clientX: number) => {
    const el = courtRef.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    const s = r.width / el.offsetWidth
    return (clientX - r.left) / s
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = stateRef.current
    if (s.status !== 'ready' && s.status !== 'play') return
    movePaddle(s, courtToLocal(e.clientX))
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    doLaunch()
  }

  const current = stateRef.current

  return (
    <ArcadeFrame fs={fs} background={ARCADE.crt}>
      <ArcadeStrip time={time} fs={fs} arcade={arcade} desktopLabel={desktopLabel} backLabel={backLabel} onDesktop={onDesktop} onBack={onBack}>
        <StripButton onClick={doPause}>{labels.pause}</StripButton>
      </ArcadeStrip>

      <div
        ref={courtRef}
        className="relative flex-1 overflow-hidden"
        style={{ backgroundColor: ARCADE.crt, touchAction: 'none' }}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={labels.field}
          className="absolute left-0 top-0"
          style={{ width: SCREEN_W, height: APP_H }}
        />
        <CrtOverlay />

        {view === 'ready' && startedRef.current && (
          <p
            className="absolute inset-x-0 text-center pointer-events-none"
            style={{ bottom: 10, fontSize: 9, color: '#c8b89a', ...PIXEL_FONT, textShadow: '1px 1px 0 rgba(0,0,0,0.7)' }}
          >
            {labels.start}
          </p>
        )}

        {view === 'ready' && !startedRef.current && (
          <ArcadeOverlay>
            <div
              className="absolute inset-0 flex items-center justify-center"
              onPointerDown={(e) => {
                e.stopPropagation()
                doLaunch()
              }}
            >
              <ArcadePanel className="px-8 py-5 text-center">
                <p style={{ fontSize: 16, color: ARCADE.phosphor, letterSpacing: 2, textShadow: `2px 2px 0 ${ARCADE.panelShadow}` }}>
                  {labels.title}
                </p>
                <p className="mt-3" style={{ fontSize: 10 }}>
                  {labels.start}
                </p>
                <p className="mt-1.5" style={{ fontSize: 9, color: '#c8b89a' }}>
                  {best > 0 ? labels.best.replace('{n}', String(best)) : ''}
                </p>
                <p className="mt-2.5" style={{ fontSize: 8, color: '#a8987a' }}>
                  {labels.hint}
                </p>
              </ArcadePanel>
            </div>
          </ArcadeOverlay>
        )}

        {view === 'paused' && (
          <ArcadeOverlay>
            <ArcadePanel className="px-8 py-5 text-center">
              <p style={{ fontSize: 12 }}>{labels.paused}</p>
              <div className="mt-3 flex justify-center">
                <ArcadeButton onClick={doPause} size="md">
                  {labels.resume}
                </ArcadeButton>
              </div>
            </ArcadePanel>
          </ArcadeOverlay>
        )}

        {view === 'clear' && clearBanner && (
          <ArcadeOverlay>
            <ArcadePanel className="px-8 py-5 text-center">
              <p style={{ fontSize: 12, color: ARCADE.phosphor }}>
                {labels.levelClear.replace('{n}', String(clearBanner.level)).replace('{bonus}', String(clearBanner.bonus))}
              </p>
            </ArcadePanel>
          </ArcadeOverlay>
        )}

        {view === 'over' && (
          <ArcadeOverlay>
            <ArcadePanel className="px-8 py-5 text-center">
              <p style={{ fontSize: 12 }}>{labels.over}</p>
              <p className="mt-2" style={{ fontSize: 9, color: '#c8b89a' }}>
                {labels.score.replace('{n}', String(current.score))}
              </p>
              <p className="mt-0.5" style={{ fontSize: 9, color: '#c8b89a' }}>
                {labels.best.replace('{n}', String(best))}
              </p>
              <div className="mt-3 flex justify-center">
                <ArcadeButton onClick={resetGame} tone="cream" size="md">
                  {labels.playAgain}
                </ArcadeButton>
              </div>
            </ArcadePanel>
          </ArcadeOverlay>
        )}

        <div className="sr-only" role="status" aria-live="polite">
          {announce}
        </div>
      </div>
    </ArcadeFrame>
  )
}
