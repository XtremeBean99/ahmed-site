// src/lib/games/pong-engine.ts
/**
 * Pure Pong logic for the desk arcade. No DOM, no React, no Math.random:
 * every random draw flows through the rng the caller injects. `step` returns a
 * new state and never mutates the one it is given.
 */

export type PongMode = '1p' | '2p'
export type PongDifficulty = 'easy' | 'normal' | 'hard'
export type PongStatus = 'serve' | 'play' | 'point' | 'over'
export type PongSide = 'left' | 'right'

export interface PongBall { x: number; y: number; vx: number; vy: number }
export interface PongPaddle { y: number }
/** CPU memory: seconds of reaction time left, and the aim error for this rally. */
export interface PongCpu { reaction: number; aimOffset: number }

export interface PongState {
  mode: PongMode
  difficulty: PongDifficulty
  status: PongStatus
  ball: PongBall
  left: PongPaddle
  right: PongPaddle
  score: [number, number]
  /** Seconds left in the current serve countdown or point pause. */
  timer: number
  server: PongSide
  /** Paddle hits in the current rally. */
  rally: number
  longestRally: number
  winner?: PongSide
  cpu: PongCpu
}

export interface PongInput {
  left: -1 | 0 | 1
  /** Desired centre y for the left paddle (1P mouse). Undefined means use keys. */
  leftTarget?: number
  right: -1 | 0 | 1
}

export type PongEvent =
  | { type: 'paddle'; side: PongSide }
  | { type: 'wall' }
  | { type: 'score'; side: PongSide }
  | { type: 'serve'; side: PongSide }
  | { type: 'over'; side: PongSide }

export const COURT_W = 536
export const COURT_H = 280
export const PADDLE_W = 6
export const PADDLE_H = 36
export const LEFT_X = 18
export const RIGHT_X = COURT_W - 18 - PADDLE_W
export const BALL_SIZE = 6

const PADDLE_SPEED = 320
const MOUSE_SPEED = 700
const SERVE_SPEED = 220
const MAX_BALL_SPEED = 520
const BALL_SPEEDUP = 1.06
const MAX_SERVE_ANGLE = 25
const MAX_HIT_ANGLE = 55
const WIN_SCORE = 7
const SERVE_DELAY = 1.0
const POINT_DELAY = 0.7
const DEG = Math.PI / 180

const DIFFICULTY = {
  easy: { speed: 170, reaction: 0.24, error: 26 },
  normal: { speed: 240, reaction: 0.14, error: 13 },
  hard: { speed: 330, reaction: 0.06, error: 5 },
} as const

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const mod = (n: number, m: number) => ((n % m) + m) % m

const centreBall = (): PongBall => ({
  x: (COURT_W - BALL_SIZE) / 2,
  y: (COURT_H - BALL_SIZE) / 2,
  vx: 0,
  vy: 0,
})

/**
 * The ball's centre y when it reaches the right paddle face, folding the
 * straight-line path off the top and bottom walls.
 */
export function predictInterceptY(ball: PongBall): number {
  const centreX = ball.x + BALL_SIZE / 2
  const t = (RIGHT_X - centreX) / ball.vx
  const straight = ball.y + BALL_SIZE / 2 + ball.vy * t
  const min = BALL_SIZE / 2
  const span = COURT_H - BALL_SIZE
  const folded = mod(straight - min, span * 2)
  return min + (folded <= span ? folded : span * 2 - folded)
}

/** A serve from the centre toward the opponent, within 25 degrees of horizontal. */
export function serveBall(side: PongSide, rng: () => number): PongBall {
  const angle = (rng() * 2 - 1) * MAX_SERVE_ANGLE * DEG
  const dir = side === 'left' ? 1 : -1
  return {
    x: (COURT_W - BALL_SIZE) / 2,
    y: (COURT_H - BALL_SIZE) / 2,
    vx: dir * SERVE_SPEED * Math.cos(angle),
    vy: SERVE_SPEED * Math.sin(angle),
  }
}

export function createMatch(mode: PongMode, difficulty: PongDifficulty, rng: () => number): PongState {
  const server: PongSide = rng() < 0.5 ? 'left' : 'right'
  return {
    mode,
    difficulty,
    status: 'serve',
    ball: centreBall(),
    left: { y: (COURT_H - PADDLE_H) / 2 },
    right: { y: (COURT_H - PADDLE_H) / 2 },
    score: [0, 0],
    timer: SERVE_DELAY,
    server,
    rally: 0,
    longestRally: 0,
    cpu: { reaction: 0, aimOffset: 0 },
  }
}

function movePaddleBy(paddle: PongPaddle, dir: number, dt: number): PongPaddle {
  return { y: clamp(paddle.y + dir * PADDLE_SPEED * dt, 0, COURT_H - PADDLE_H) }
}

function movePaddleToward(paddle: PongPaddle, targetCentre: number, speed: number, dt: number): PongPaddle {
  const centre = paddle.y + PADDLE_H / 2
  const delta = clamp(targetCentre - centre, -speed * dt, speed * dt)
  return { y: clamp(paddle.y + delta, 0, COURT_H - PADDLE_H) }
}

function cpuForServe(state: PongState, ball: PongBall, rng: () => number): PongCpu {
  const d = DIFFICULTY[state.difficulty]
  return {
    reaction: ball.vx > 0 ? d.reaction : 0,
    aimOffset: (rng() * 2 - 1) * d.error,
  }
}

function movePaddles(state: PongState, dt: number, input: PongInput): PongState {
  let left = state.left
  let right = state.right
  let cpu = state.cpu

  if (state.mode === '1p' && input.leftTarget !== undefined) {
    left = movePaddleToward(left, input.leftTarget, MOUSE_SPEED, dt)
  } else if (input.left !== 0) {
    left = movePaddleBy(left, input.left, dt)
  }

  if (state.mode === '2p') {
    if (input.right !== 0) right = movePaddleBy(right, input.right, dt)
  } else {
    const d = DIFFICULTY[state.difficulty]
    if (state.status !== 'play' || state.ball.vx <= 0) {
      right = movePaddleToward(right, COURT_H / 2, d.speed, dt)
    } else if (cpu.reaction > 0) {
      cpu = { ...cpu, reaction: Math.max(0, cpu.reaction - dt) }
    } else {
      const target = clamp(predictInterceptY(state.ball) + cpu.aimOffset, PADDLE_H / 2, COURT_H - PADDLE_H / 2)
      right = movePaddleToward(right, target, d.speed, dt)
    }
  }

  return { ...state, left, right, cpu }
}

interface Hit { t: number; kind: 'wallTop' | 'wallBottom' | 'paddleLeft' | 'paddleRight' | 'scoreLeft' | 'scoreRight' }

function candidates(ball: PongBall, left: PongPaddle, right: PongPaddle): Hit[] {
  const hits: Hit[] = []
  if (ball.vy < 0) hits.push({ t: -ball.y / ball.vy, kind: 'wallTop' })
  else if (ball.vy > 0) hits.push({ t: (COURT_H - BALL_SIZE - ball.y) / ball.vy, kind: 'wallBottom' })

  if (ball.vx < 0) {
    const face = LEFT_X + PADDLE_W
    const t = (ball.x - face) / -ball.vx
    if (t >= 0) {
      const y = ball.y + ball.vy * t
      if (y + BALL_SIZE > left.y && y < left.y + PADDLE_H) hits.push({ t, kind: 'paddleLeft' })
    }
    hits.push({ t: -(ball.x + BALL_SIZE) / ball.vx, kind: 'scoreLeft' })
  } else if (ball.vx > 0) {
    const t = (RIGHT_X - (ball.x + BALL_SIZE)) / ball.vx
    if (t >= 0) {
      const y = ball.y + ball.vy * t
      if (y + BALL_SIZE > right.y && y < right.y + PADDLE_H) hits.push({ t, kind: 'paddleRight' })
    }
    hits.push({ t: (COURT_W - ball.x) / ball.vx, kind: 'scoreRight' })
  }
  return hits
}

/** Advances the ball through dt with swept face collisions; never tunnels. */
function moveBall(state: PongState, dt: number, events: PongEvent[]): PongState {
  let ball = { ...state.ball }
  let rally = state.rally
  let status: PongStatus = state.status
  let score: [number, number] = state.score
  let timer = state.timer
  let server = state.server
  let longestRally = state.longestRally
  let winner = state.winner
  let rem = dt

  while (rem > 0) {
    const hits = candidates(ball, state.left, state.right).filter((h) => h.t >= 0 && h.t <= rem)
    if (hits.length === 0) {
      ball = { ...ball, x: ball.x + ball.vx * rem, y: ball.y + ball.vy * rem }
      rem = 0
      break
    }
    const hit = hits.reduce((a, b) => (b.t < a.t ? b : a))
    ball = { ...ball, x: ball.x + ball.vx * hit.t, y: ball.y + ball.vy * hit.t }
    rem -= hit.t

    if (hit.kind === 'wallTop') {
      ball = { ...ball, y: 0, vy: -ball.vy }
      events.push({ type: 'wall' })
    } else if (hit.kind === 'wallBottom') {
      ball = { ...ball, y: COURT_H - BALL_SIZE, vy: -ball.vy }
      events.push({ type: 'wall' })
    } else if (hit.kind === 'paddleLeft' || hit.kind === 'paddleRight') {
      const side: PongSide = hit.kind === 'paddleLeft' ? 'left' : 'right'
      const paddle = side === 'left' ? state.left : state.right
      const speed = Math.min(Math.hypot(ball.vx, ball.vy) * BALL_SPEEDUP, MAX_BALL_SPEED)
      const offset = clamp((ball.y + BALL_SIZE / 2 - (paddle.y + PADDLE_H / 2)) / (PADDLE_H / 2), -1, 1)
      const angle = offset * MAX_HIT_ANGLE * DEG
      const dir = side === 'left' ? 1 : -1
      ball = {
        ...ball,
        x: side === 'left' ? LEFT_X + PADDLE_W : RIGHT_X - BALL_SIZE,
        vx: dir * speed * Math.cos(angle),
        vy: speed * Math.sin(angle),
      }
      rally += 1
      events.push({ type: 'paddle', side })
    } else {
      const scorer: PongSide = hit.kind === 'scoreLeft' ? 'right' : 'left'
      score = scorer === 'right' ? [score[0], score[1] + 1] : [score[0] + 1, score[1]]
      server = scorer
      longestRally = Math.max(longestRally, rally)
      rally = 0
      events.push({ type: 'score', side: scorer })
      if (score[0] >= WIN_SCORE || score[1] >= WIN_SCORE) {
        status = 'over'
        winner = scorer
        events.push({ type: 'over', side: scorer })
      } else {
        status = 'point'
        timer = POINT_DELAY
      }
      ball = centreBall()
      rem = 0
    }
  }

  return { ...state, ball, rally, status, score, timer, server, longestRally, winner }
}

function playTick(state: PongState, dt: number, input: PongInput, events: PongEvent[]): PongState {
  const moved = movePaddles(state, dt, input)
  const prevVx = moved.ball.vx
  const next = moveBall(moved, dt, events)
  // The CPU re-reacts every time the ball turns back toward it.
  if (next.status === 'play' && prevVx <= 0 && next.ball.vx > 0) {
    return { ...next, cpu: { ...next.cpu, reaction: DIFFICULTY[next.difficulty].reaction } }
  }
  return next
}

function tick(state: PongState, dt: number, input: PongInput, rng: () => number, events: PongEvent[]): PongState {
  if (state.status === 'serve') {
    const moved = movePaddles(state, dt, input)
    const timer = state.timer - dt
    if (timer > 0) return { ...moved, timer }
    const ball = serveBall(state.server, rng)
    events.push({ type: 'serve', side: state.server })
    return { ...moved, status: 'play', timer: 0, ball, cpu: cpuForServe(state, ball, rng) }
  }

  if (state.status === 'point') {
    const moved = movePaddles(state, dt, input)
    const timer = state.timer - dt
    if (timer > 0) return { ...moved, timer }
    return { ...moved, status: 'serve', timer: SERVE_DELAY }
  }

  return playTick(state, dt, input, events)
}

export function step(state: PongState, dt: number, input: PongInput, rng: () => number): { state: PongState; events: PongEvent[] } {
  if (state.status === 'over' || dt <= 0) return { state, events: [] }
  const events: PongEvent[] = []
  return { state: tick(state, dt, input, rng, events), events }
}
