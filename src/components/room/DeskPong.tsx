// src/components/room/DeskPong.tsx
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  ARCADE,
  ArcadeButton,
  ArcadeFrame,
  ArcadeOverlay,
  ArcadePanel,
  ArcadeStrip,
  BlockTitle,
  CrtOverlay,
  PIXEL_FONT,
  useCanvasScale,
  useFullscreen,
  type DeskGameProps,
} from './DeskArcade'
import {
  BALL_SIZE,
  COURT_H,
  COURT_W,
  LEFT_X,
  PADDLE_H,
  PADDLE_W,
  RIGHT_X,
  createMatch,
  step,
  type PongDifficulty,
  type PongEvent,
  type PongInput,
  type PongMode,
  type PongSide,
  type PongState,
} from '@/lib/games/pong-engine'
import { BEST_KEYS, getBest, readJson, setBestIfHigher, writeJson } from '@/lib/games/storage'
import { useSfx } from './RoomSfxProvider'

const DT = 1 / 120

export interface PongLabels {
  court: string
  onePlayer: string
  twoPlayers: string
  difficulty: string
  easy: string
  normal: string
  hard: string
  hint: string
  bestRally: string
  paused: string
  resume: string
  menu: string
  rematch: string
  finalScore: string
  youWin: string
  cpuWins: string
  player1Wins: string
  player2Wins: string
  scoreAnnounce: string
}

const clampNum = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/** 3 x 5 block digits, one row of 3 bits per scan line. */
const DIGITS: number[][] = [
  [1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1, 1],
  [0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1],
  [1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
  [1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1],
  [1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  [1, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
  [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
]

function drawDigit(ctx: CanvasRenderingContext2D, n: number, centreX: number, topY: number, block: number) {
  const bits = DIGITS[n]
  const x = Math.round(centreX - block * 1.5)
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 3; c++) {
      if (bits[r * 3 + c]) ctx.fillRect(x + c * block, topY + r * block, block, block)
    }
  }
}

const TRAIL_ALPHA = [0.22, 0.14, 0.08, 0.04]

function drawCourt(
  ctx: CanvasRenderingContext2D,
  k: number,
  state: PongState | null,
  trail: { x: number; y: number }[],
  flash: { side: PongSide; until: number } | null,
) {
  ctx.setTransform(k, 0, 0, k, 0, 0)

  // Warm phosphor CRT: a faint centre lift, then a 1px inset border like screen burn.
  const lift = ctx.createRadialGradient(COURT_W / 2, COURT_H / 2, 24, COURT_W / 2, COURT_H / 2, 340)
  lift.addColorStop(0, '#1c140f')
  lift.addColorStop(1, ARCADE.crt)
  ctx.fillStyle = lift
  ctx.fillRect(0, 0, COURT_W, COURT_H)
  ctx.strokeStyle = 'rgba(240,220,180,0.08)'
  ctx.lineWidth = 1
  ctx.strokeRect(4.5, 4.5, COURT_W - 9, COURT_H - 9)

  ctx.fillStyle = 'rgba(240,220,180,0.4)'
  for (let y = 8; y < COURT_H; y += 14) ctx.fillRect(COURT_W / 2 - 1, y, 2, 8)

  if (flash && performance.now() < flash.until) {
    ctx.fillStyle = 'rgba(240,220,180,0.06)'
    ctx.fillRect(flash.side === 'left' ? 0 : COURT_W / 2, 0, COURT_W / 2, COURT_H)
  }

  const leftY = state?.left.y ?? (COURT_H - PADDLE_H) / 2
  const rightY = state?.right.y ?? (COURT_H - PADDLE_H) / 2

  ctx.save()
  ctx.shadowBlur = 6 * k
  ctx.shadowColor = ARCADE.phosphorGlow
  ctx.fillStyle = ARCADE.phosphor

  ctx.globalAlpha = 0.85
  drawDigit(ctx, state ? state.score[0] : 0, COURT_W / 2 - 64, 18, 6)
  drawDigit(ctx, state ? state.score[1] : 0, COURT_W / 2 + 64, 18, 6)
  ctx.globalAlpha = 1

  ctx.fillRect(LEFT_X, leftY, PADDLE_W, PADDLE_H)
  ctx.fillRect(RIGHT_X, rightY, PADDLE_W, PADDLE_H)
  ctx.restore()

  // Trail has no glow; the ball itself does.
  ctx.fillStyle = ARCADE.phosphor
  for (let i = 0; i < trail.length; i++) {
    ctx.globalAlpha = TRAIL_ALPHA[i]
    ctx.fillRect(trail[i].x, trail[i].y, BALL_SIZE, BALL_SIZE)
  }
  ctx.globalAlpha = 1

  if (state && state.status !== 'over') {
    ctx.save()
    ctx.shadowBlur = 6 * k
    ctx.shadowColor = ARCADE.phosphorGlow
    ctx.fillStyle = ARCADE.phosphor
    ctx.fillRect(state.ball.x, state.ball.y, BALL_SIZE, BALL_SIZE)
    ctx.restore()
  }

  if (state && state.status === 'serve') {
    const n = clampNum(Math.ceil(state.timer * 3), 1, 3)
    ctx.save()
    ctx.shadowBlur = 4 * k
    ctx.shadowColor = ARCADE.phosphorGlow
    ctx.fillStyle = ARCADE.phosphor
    drawDigit(ctx, n, COURT_W / 2, 112, 3)
    ctx.restore()
  }
}

export function DeskPong({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<PongLabels>) {
  const fs = useFullscreen()
  const { tone } = useSfx()
  const reduce = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const k = useCanvasScale(canvasRef, COURT_W)

  const [view, setView] = useState<'menu' | 'play' | 'over'>('menu')
  const [paused, setPaused] = useState(false)
  const [mode, setMode] = useState<PongMode>('1p')
  const [difficulty, setDifficulty] = useState<PongDifficulty>('normal')
  const [bestRally, setBestRally] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const [finalState, setFinalState] = useState<PongState | null>(null)

  const matchRef = useRef<PongState | null>(null)
  const trailRef = useRef<{ x: number; y: number }[]>([])
  const keysRef = useRef({ w: false, s: false, up: false, down: false })
  const mouseTargetRef = useRef<number | undefined>(undefined)
  const flashRef = useRef<{ side: PongSide; until: number } | null>(null)
  const viewRef = useRef(view)
  const modeRef = useRef(mode)
  const difficultyRef = useRef(difficulty)
  const pausedRef = useRef(paused)

  useEffect(() => {
    viewRef.current = view
    modeRef.current = mode
    difficultyRef.current = difficulty
    pausedRef.current = paused
  })

  useEffect(() => {
    const raw = readJson('pong-prefs')
    if (raw && typeof raw === 'object') {
      const p = raw as { mode?: unknown; difficulty?: unknown }
      if (p.mode === '1p' || p.mode === '2p') setMode(p.mode)
      if (p.difficulty === 'easy' || p.difficulty === 'normal' || p.difficulty === 'hard') setDifficulty(p.difficulty)
    }
    setBestRally(getBest(BEST_KEYS.pong))
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = Math.round(COURT_W * k)
    canvas.height = Math.round(COURT_H * k)
  }, [k])

  const start = useCallback((nextMode: PongMode, nextDifficulty: PongDifficulty) => {
    matchRef.current = createMatch(nextMode, nextDifficulty, Math.random)
    trailRef.current = []
    mouseTargetRef.current = undefined
    flashRef.current = null
    setFinalState(null)
    setMode(nextMode)
    setDifficulty(nextDifficulty)
    setView('play')
    setPaused(false)
    setAnnouncement('')
    writeJson('pong-prefs', { mode: nextMode, difficulty: nextDifficulty })
  }, [])

  const chooseDifficulty = useCallback((d: PongDifficulty) => {
    setDifficulty(d)
    writeJson('pong-prefs', { mode: modeRef.current, difficulty: d })
    tone('select')
  }, [tone])

  const resume = useCallback(() => setPaused(false), [])
  const rematch = useCallback(() => {
    start(modeRef.current, difficultyRef.current)
  }, [start])
  const toMenu = useCallback(() => {
    matchRef.current = null
    trailRef.current = []
    setFinalState(null)
    setView('menu')
    setPaused(false)
  }, [])

  // Game loop: fixed 1/120s physics with an accumulator, canvas redrawn per frame.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const buildInput = (): PongInput => {
      const keys = keysRef.current
      const m = modeRef.current
      const leftUp = m === '1p' ? keys.w || keys.up : keys.w
      const leftDown = m === '1p' ? keys.s || keys.down : keys.s
      const rightUp = m === '2p' ? keys.up : false
      const rightDown = m === '2p' ? keys.down : false
      return {
        left: leftUp ? -1 : leftDown ? 1 : 0,
        leftTarget: m === '1p' ? mouseTargetRef.current : undefined,
        right: rightUp ? -1 : rightDown ? 1 : 0,
      }
    }

    const recordWin = (d: PongDifficulty) => {
      const wins = { easy: 0, normal: 0, hard: 0 }
      const raw = readJson('pong-save')
      if (raw && typeof raw === 'object') {
        const saved = (raw as { wins?: unknown }).wins
        if (saved && typeof saved === 'object') {
          for (const key of ['easy', 'normal', 'hard'] as const) {
            const v = (saved as { easy?: unknown; normal?: unknown; hard?: unknown })[key]
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) wins[key] = v
          }
        }
      }
      wins[d] += 1
      writeJson('pong-save', { wins })
    }

    const handleEvents = (events: PongEvent[], state: PongState) => {
      for (const ev of events) {
        if (ev.type === 'paddle') {
          tone('blip', Math.min(1.4, 1 + 0.02 * state.rally))
        } else if (ev.type === 'wall') {
          tone('bloop')
        } else if (ev.type === 'score') {
          tone('score')
          setAnnouncement(
            labels.scoreAnnounce.replace('{l}', String(state.score[0])).replace('{r}', String(state.score[1])),
          )
          setBestIfHigher(BEST_KEYS.pong, state.longestRally)
          setBestRally(state.longestRally)
          if (!reduce) flashRef.current = { side: ev.side, until: performance.now() + 120 }
        } else if (ev.type === 'over') {
          const winner = ev.side
          setFinalState(state)
          setView('over')
          setPaused(false)
          if (modeRef.current === '1p') {
            if (winner === 'left') {
              tone('win')
              recordWin(state.difficulty)
            } else {
              tone('lose')
            }
          } else {
            tone('win')
          }
          const result =
            modeRef.current === '1p'
              ? winner === 'left'
                ? labels.youWin
                : labels.cpuWins
              : winner === 'left'
                ? labels.player1Wins
                : labels.player2Wins
          setAnnouncement(result)
        }
      }
    }

    let raf = 0
    let last = performance.now()
    let acc = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const elapsed = Math.min(100, now - last)
      last = now
      const current = matchRef.current
      if (current && viewRef.current === 'play' && !pausedRef.current && !document.hidden) {
        acc += elapsed / 1000
        let s = current
        while (acc >= DT && s.status !== 'over') {
          acc -= DT
          const r = step(s, DT, buildInput(), Math.random)
          s = r.state
          matchRef.current = s
          handleEvents(r.events, s)
        }
        if (s.status === 'play') {
          trailRef.current = [{ x: s.ball.x, y: s.ball.y }, ...trailRef.current].slice(0, 4)
        } else {
          trailRef.current = []
        }
      } else {
        acc = 0
      }
      drawCourt(ctx, k, matchRef.current, trailRef.current, flashRef.current)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [k, reduce, tone, labels])

  // The app owns the screen while it is open, so keys are read from the window.
  useEffect(() => {
    const setKey = (key: string, down: boolean) => {
      const keys = keysRef.current
      if (key === 'w') keys.w = down
      else if (key === 's') keys.s = down
      else if (key === 'arrowup') keys.up = down
      else if (key === 'arrowdown') keys.down = down
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === ' ' || key === 'p') {
        if (viewRef.current === 'play') {
          e.preventDefault()
          setPaused((p) => !p)
        }
        return
      }
      if (key === 'enter') {
        if (viewRef.current === 'menu') {
          e.preventDefault()
          start(modeRef.current, difficultyRef.current)
        } else if (viewRef.current === 'over') {
          e.preventDefault()
          rematch()
        }
        return
      }
      if (key === 'w' || key === 's' || key === 'arrowup' || key === 'arrowdown') {
        e.preventDefault()
        mouseTargetRef.current = undefined
        setKey(key, true)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key === 'w' || key === 's' || key === 'arrowup' || key === 'arrowdown') setKey(key, false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [start, rematch])

  useEffect(() => {
    const onHide = () => {
      if (document.hidden && viewRef.current === 'play') setPaused(true)
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modeRef.current !== '1p') return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0) return
    const scale = rect.width / el.offsetWidth
    mouseTargetRef.current = clampNum((e.clientY - rect.top) / scale, 0, COURT_H)
  }

  const resultTitle = finalState
    ? finalState.mode === '1p'
      ? finalState.winner === 'left'
        ? labels.youWin
        : labels.cpuWins
      : finalState.winner === 'left'
        ? labels.player1Wins
        : labels.player2Wins
    : ''

  return (
    <ArcadeFrame fs={fs} background={ARCADE.crt}>
      <ArcadeStrip time={time} fs={fs} arcade={arcade} desktopLabel={desktopLabel} backLabel={backLabel} onDesktop={onDesktop} onBack={onBack} />
      <div className="relative flex-1 overflow-hidden" onMouseMove={onMouseMove}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={labels.court}
          className="absolute inset-0"
          style={{ width: COURT_W, height: COURT_H }}
        />
        <CrtOverlay />
        <div className="sr-only" aria-live="polite">{announcement}</div>

        {view === 'menu' && (
          <ArcadeOverlay>
            <div className="flex flex-col items-center gap-4">
              <BlockTitle text="PONG" />
              <div className="flex flex-col items-stretch gap-2">
                <ArcadeButton size="lg" onClick={() => { tone('select'); start('1p', difficulty) }}>
                  {labels.onePlayer}
                </ArcadeButton>
                <div className="flex justify-center gap-1.5" role="group" aria-label={labels.difficulty}>
                  {(['easy', 'normal', 'hard'] as const).map((d) => (
                    <ArcadeButton key={d} size="sm" tone="dark" pressed={difficulty === d} ariaLabel={labels[d]} onClick={() => chooseDifficulty(d)}>
                      {labels[d]}
                    </ArcadeButton>
                  ))}
                </div>
                <ArcadeButton size="lg" onClick={() => { tone('select'); start('2p', difficulty) }}>
                  {labels.twoPlayers}
                </ArcadeButton>
              </div>
              <p className="text-center" style={{ ...PIXEL_FONT, fontSize: 9, color: ARCADE.panelText, whiteSpace: 'pre' }}>
                {labels.hint}
              </p>
              {bestRally > 0 && (
                <p style={{ ...PIXEL_FONT, fontSize: 9, color: ARCADE.panelText }}>
                  {labels.bestRally.replace('{n}', String(bestRally))}
                </p>
              )}
            </div>
          </ArcadeOverlay>
        )}

        {view === 'play' && paused && (
          <ArcadeOverlay>
            <ArcadePanel className="flex flex-col items-center gap-3 px-6 py-5">
              <p style={{ ...PIXEL_FONT, fontSize: 12 }}>{labels.paused}</p>
              <div className="flex gap-2">
                <ArcadeButton onClick={resume}>{labels.resume}</ArcadeButton>
                <ArcadeButton tone="dark" onClick={toMenu}>{labels.menu}</ArcadeButton>
              </div>
            </ArcadePanel>
          </ArcadeOverlay>
        )}

        {view === 'over' && finalState && (
          <ArcadeOverlay>
            <ArcadePanel className="flex flex-col items-center gap-3 px-6 py-5">
              <p style={{ ...PIXEL_FONT, fontSize: 16 }}>{resultTitle}</p>
              <p style={{ ...PIXEL_FONT, fontSize: 12 }}>
                {labels.finalScore.replace('{l}', String(finalState.score[0])).replace('{r}', String(finalState.score[1]))}
              </p>
              <div className="flex gap-2">
                <ArcadeButton onClick={rematch}>{labels.rematch}</ArcadeButton>
                <ArcadeButton tone="dark" onClick={toMenu}>{labels.menu}</ArcadeButton>
              </div>
            </ArcadePanel>
          </ArcadeOverlay>
        )}
      </div>
    </ArcadeFrame>
  )
}
