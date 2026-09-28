// src/lib/games/breakout-engine.ts
/**
 * Pure Breakout logic for the desk arcade. No DOM, no React, no Math.random:
 * callers inject an rng. The per-frame physics functions mutate the
 * BreakoutState object the caller owns (this is the one documented exception
 * to the return-new-state rule, so a 120 Hz loop never allocates); command
 * functions like createGame and nextLevel build fresh state or reset it.
 */
import type { Ball, BreakoutEvent, BreakoutState, Brick, PowerUpKind } from './types'

export const COURT_W = 536
export const COURT_H = 280
export const HUD_H = 20
export const PADDLE_W = 56
export const PADDLE_H = 8
export const PADDLE_Y = 262
export const BALL_SIZE = 6
export const BRICK_W = 34
export const BRICK_H = 10
export const BRICK_GAP = 2
export const GRID_X = 17
export const GRID_Y = 36
export const COLS = 14
export const MAX_ROWS = 8

export const STEP_MS = 1000 / 120
const STEP_SEC = STEP_MS / 1000
const EPS = 0.001

export const BASE_SPEED = 240
export const SPEED_PER_LEVEL = 15
export const SPEED_PER_LOOP = 30
export const MAX_SPEED = 440
export const PADDLE_HIT_BOOST = 1.02
export const MIN_VY_RATIO = 0.35
export const MAX_ANGLE = Math.PI / 3

export const POWERUP_DROP_CHANCE = 0.12
export const POWERUP_FALL_SPEED = 90
export const POWERUP_W = 16
export const POWERUP_H = 7
export const WIDE_MS = 12000
export const SLOW_MS = 10000
export const CATCH_MS = 12000
export const WIDE_FACTOR = 1.5
export const SLOW_FACTOR = 0.7
export const MAX_LIVES = 5
export const START_LIVES = 3
export const CLEAR_BONUS_PER_LIFE = 100

const POWERUP_KINDS: PowerUpKind[] = ['wide', 'multi', 'slow', 'life', 'catch']

export interface CourtGeometry {
  courtW: number
  courtH: number
  hudH: number
  paddleW: number
  paddleH: number
  paddleY: number
  ballSize: number
  brickW: number
  brickH: number
  brickGap: number
  gridX: number
  gridY: number
  speedScale: number
}

export const LANDSCAPE_COURT: CourtGeometry = {
  courtW: COURT_W,
  courtH: COURT_H,
  hudH: HUD_H,
  paddleW: PADDLE_W,
  paddleH: PADDLE_H,
  paddleY: PADDLE_Y,
  ballSize: BALL_SIZE,
  brickW: BRICK_W,
  brickH: BRICK_H,
  brickGap: BRICK_GAP,
  gridX: GRID_X,
  gridY: GRID_Y,
  speedScale: 1,
}

export const PORTRAIT_COURT: CourtGeometry = {
  courtW: 304,
  courtH: 400,
  hudH: 20,
  paddleW: 44,
  paddleH: 8,
  paddleY: 382,
  ballSize: 6,
  brickW: 18,
  brickH: 10,
  brickGap: 2,
  gridX: 13,
  gridY: 36,
  speedScale: 400 / 280,
}

export type BreakoutGameState = BreakoutState & { geo: CourtGeometry }

function geoOf(state: BreakoutState): CourtGeometry {
  return (state as Partial<BreakoutGameState>).geo ?? LANDSCAPE_COURT
}

function setGeo(state: BreakoutState, geo: CourtGeometry): void {
  const s = state as BreakoutGameState
  s.geo = geo
}

/** One char per brick: `.` empty, `1`..`8` a normal brick of that band, `T` tough, `S` steel. */
export const LEVELS: string[][] = [
  [
    '11111111111111',
    '22222222222222',
    '33333333333333',
    '44444444444444',
    '55555555555555',
    '66666666666666',
  ],
  [
    '......11......',
    '.....2222.....',
    '....333333....',
    '...44444444...',
    '..5555555555..',
    '.666666666666.',
    '77777777777777',
    '88888888888888',
  ],
  [
    '1.1.1.1.1.1.1.',
    '.2.2.2.2.2.2.2',
    '3.3.3.3.3.3.3.',
    '.4.4.4.4.4.4.4',
    '5.5.5.T.T.5.5.',
    '.6.6.6.6.6.6.6',
    '7.7.7.7.7.7.7.',
    '.8.8.8.8.8.8.8',
  ],
  [
    '..111....111..',
    '.11111..11111.',
    '11111111111111',
    '11111111111111',
    '11111111111111',
    '.111111111111.',
    '..1111111111..',
    '....111111....',
  ],
  [
    'S.S.S.S.S.S.S.',
    'SS..........SS',
    'S.3333333333.S',
    'S.4T444444T4.S',
    'S.5555555555.S',
    'SS..........SS',
    '6.6.6.6.6.6.6.',
    '.7.7.7.7.7.7.7',
  ],
  [
    '.....11.......',
    '....2222......',
    '...33333333...',
    '..4444444444..',
    '.555555555555.',
    '..6666666666..',
    '..77.77..77.7.',
    '...88..88..8..',
  ],
  [
    '..11......11..',
    '.1221....1221.',
    '123321..123321',
    '.1221....1221.',
    '..11......11..',
    '..6666666666..',
    '...77777777...',
    '....888888....',
  ],
  [
    'S.S.S.S.S.S.S.',
    '1.1.1.1.1.1.1.',
    '2.2.2.2.2.2.2.',
    '3.3.3.3.3.3.3.',
    '4.4.4.4.4.4.4.',
    '5.5.5.5.5.5.5.',
    '6.6.6.6.6.6.6.',
    '7.7.7.7.7.7.7.',
  ],
]

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Score for a brick row (0-indexed): rows 1-2 = 70, 3-4 = 50, 5-6 = 30, 7-8 = 10. */
export const scoreForRow = (row: number) => (row < 2 ? 70 : row < 4 ? 50 : row < 6 ? 30 : 10)

/** Build the bricks for one of the hand-made maps. Rows shorter than 14 are padded with `.`. */
export function parseLevel(rows: string[], geo: CourtGeometry = LANDSCAPE_COURT): Brick[] {
  const bricks: Brick[] = []
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = rows[r][c] ?? '.'
      if (ch === '.') continue
      const kind = ch === 'S' ? 'steel' : ch === 'T' ? 'tough' : 'normal'
      const color = kind === 'normal' ? Number(ch) : r + 1
      bricks.push({
        col: c,
        row: r,
        x: geo.gridX + c * (geo.brickW + geo.brickGap),
        y: geo.gridY + r * (geo.brickH + geo.brickGap),
        w: geo.brickW,
        h: geo.brickH,
        kind,
        color,
        hits: 0,
        alive: true,
      })
    }
  }
  return bricks
}

/** Ball speed for the current level and loop, including an active slow effect. */
export function levelSpeed(state: BreakoutState): number {
  const base = BASE_SPEED + (state.level - 1) * SPEED_PER_LEVEL + state.loop * SPEED_PER_LOOP
  return base * (hasEffect(state, 'slow') ? SLOW_FACTOR : 1) * geoOf(state).speedScale
}

function hasEffect(state: BreakoutState, kind: 'wide' | 'slow' | 'catch'): boolean {
  return state.effects.some((e) => e.kind === kind)
}

function setEffect(state: BreakoutState, kind: 'wide' | 'slow' | 'catch', ms: number): void {
  const existing = state.effects.find((e) => e.kind === kind)
  if (existing) existing.remainingMs = ms
  else state.effects.push({ kind, remainingMs: ms })
}

function serveBall(state: BreakoutState): Ball {
  const geo = geoOf(state)
  return { x: state.paddle.x, y: geo.paddleY - geo.paddleH / 2 - geo.ballSize / 2, vx: 0, vy: 0, stuck: true }
}

export function createGame(geo: CourtGeometry = LANDSCAPE_COURT): BreakoutGameState {
  const state: BreakoutGameState = {
    status: 'ready',
    score: 0,
    lives: START_LIVES,
    level: 1,
    loop: 0,
    paddle: { x: geo.courtW / 2, width: geo.paddleW },
    balls: [],
    bricks: parseLevel(LEVELS[0], geo),
    powerUps: [],
    effects: [],
    geo,
  }
  state.balls = [serveBall(state)]
  return state
}

function alignStuckBalls(state: BreakoutState): void {
  const geo = geoOf(state)
  for (const ball of state.balls) {
    if (ball.stuck) {
      ball.x = state.paddle.x
      ball.y = geo.paddleY - geo.paddleH / 2 - geo.ballSize / 2
    }
  }
}

/** Clamp the paddle to the court and carry any stuck ball with it. Mutates state. */
export function movePaddle(state: BreakoutState, x: number): void {
  const geo = geoOf(state)
  const half = state.paddle.width / 2
  state.paddle.x = clamp(x, half, geo.courtW - half)
  alignStuckBalls(state)
}

function releaseStuck(state: BreakoutState, rng: () => number): void {
  const speed = levelSpeed(state)
  for (const ball of state.balls) {
    if (!ball.stuck) continue
    const angle = -Math.PI / 2 + (rng() * 0.3 - 0.15)
    ball.vx = Math.cos(angle) * speed
    ball.vy = Math.sin(angle) * speed
    ball.stuck = false
  }
}

/** Launch from 'ready', or release a caught ball while playing. Mutates state. */
export function launch(state: BreakoutState, rng: () => number = Math.random): void {
  if (state.status === 'ready') {
    state.status = 'play'
    releaseStuck(state, rng)
  } else if (state.status === 'play') {
    releaseStuck(state, rng)
  }
}

export function togglePause(state: BreakoutState): void {
  if (state.status === 'play') state.status = 'paused'
  else if (state.status === 'paused') state.status = 'play'
}

/** Move to the next level (looping 8 -> 1 with a +30 px/s speed bonus). Mutates state. */
export function nextLevel(state: BreakoutState, geo: CourtGeometry = geoOf(state)): void {
  setGeo(state, geo)
  if (state.level >= LEVELS.length) {
    state.level = 1
    state.loop += 1
  } else {
    state.level += 1
  }
  state.bricks = parseLevel(LEVELS[state.level - 1], geo)
  state.powerUps = []
  state.effects = []
  state.paddle.width = geo.paddleW
  state.paddle.x = geo.courtW / 2
  state.balls = [serveBall(state)]
  state.status = 'ready'
}

interface Hit {
  t: number
  enterX: number
  enterY: number
}

/**
 * Swept AABB test: the moving ball (a ballSize square, center pos) against a
 * rect, using the slab method over [0, 1] of one 1/120 s step.
 */
function sweptHit(ball: Ball, dx: number, dy: number, rx: number, ry: number, rw: number, rh: number, half: number): Hit | null {
  const minX = rx - half
  const maxX = rx + rw + half
  const minY = ry - half
  const maxY = ry + rh + half
  let enterX = -Infinity
  let exitX = Infinity
  if (dx > 0) {
    enterX = (minX - ball.x) / dx
    exitX = (maxX - ball.x) / dx
  } else if (dx < 0) {
    enterX = (maxX - ball.x) / dx
    exitX = (minX - ball.x) / dx
  } else if (ball.x < minX || ball.x > maxX) {
    return null
  }
  let enterY = -Infinity
  let exitY = Infinity
  if (dy > 0) {
    enterY = (minY - ball.y) / dy
    exitY = (maxY - ball.y) / dy
  } else if (dy < 0) {
    enterY = (maxY - ball.y) / dy
    exitY = (minY - ball.y) / dy
  } else if (ball.y < minY || ball.y > maxY) {
    return null
  }
  const enter = Math.max(enterX, enterY)
  const exit = Math.min(exitX, exitY)
  if (enter > exit || enter > 1 || exit < 0) return null
  return { t: Math.max(0, enter), enterX, enterY }
}

/** Reflection axis: the slab whose overlap starts last is the face that was hit. */
function hitAxis(ball: Ball, hit: Hit, dx: number, dy: number, rx: number, ry: number, rw: number, rh: number, half: number): 'x' | 'y' {
  if (hit.enterX > hit.enterY) return 'x'
  if (hit.enterY > hit.enterX) return 'y'
  const cx = ball.x + dx * hit.t
  const cy = ball.y + dy * hit.t
  const penX = half + rw / 2 - Math.abs(cx - (rx + rw / 2))
  const penY = half + rh / 2 - Math.abs(cy - (ry + rh / 2))
  return penX <= penY ? 'x' : 'y'
}

function reflect(ball: Ball, axis: 'x' | 'y', rx: number, ry: number, rw: number, rh: number, half: number): void {
  if (axis === 'x') {
    ball.vx = -ball.vx
    ball.x = ball.vx > 0 ? rx + rw + half + EPS : rx - half - EPS
  } else {
    ball.vy = -ball.vy
    ball.y = ball.vy > 0 ? ry + rh + half + EPS : ry - half - EPS
  }
}

/** |vy| never falls below 35 % of the speed so the ball cannot crawl sideways. */
function enforceVyFloor(ball: Ball): void {
  const speed = Math.hypot(ball.vx, ball.vy)
  if (speed === 0) return
  const minVy = speed * MIN_VY_RATIO
  if (Math.abs(ball.vy) < minVy) {
    const sign = ball.vy === 0 ? -1 : Math.sign(ball.vy)
    ball.vy = sign * minVy
    const vx = Math.sqrt(Math.max(0, speed * speed - ball.vy * ball.vy))
    ball.vx = ball.vx < 0 ? -vx : vx
  }
}

function maybeDropPowerUp(state: BreakoutState, brick: Brick, rng: () => number): void {
  if (rng() >= POWERUP_DROP_CHANCE) return
  const kind = POWERUP_KINDS[Math.floor(rng() * POWERUP_KINDS.length)]
  state.powerUps.push({ kind, x: brick.x + brick.w / 2, y: brick.y + brick.h / 2 })
}

function splitBalls(state: BreakoutState): void {
  const source = [...state.balls]
  for (const ball of source) {
    const speed = Math.hypot(ball.vx, ball.vy) || levelSpeed(state)
    const base = ball.stuck ? -Math.PI / 2 : Math.atan2(ball.vy, ball.vx)
    for (const da of [(-25 * Math.PI) / 180, (25 * Math.PI) / 180]) {
      state.balls.push({
        x: ball.x,
        y: ball.y,
        vx: Math.cos(base + da) * speed,
        vy: Math.sin(base + da) * speed,
        stuck: false,
      })
    }
  }
}

function applyPowerUp(state: BreakoutState, kind: PowerUpKind, events: BreakoutEvent[]): void {
  const geo = geoOf(state)
  switch (kind) {
    case 'wide':
      state.paddle.width = Math.round(geo.paddleW * WIDE_FACTOR)
      state.paddle.x = clamp(state.paddle.x, state.paddle.width / 2, geo.courtW - state.paddle.width / 2)
      alignStuckBalls(state)
      setEffect(state, 'wide', WIDE_MS)
      break
    case 'multi':
      splitBalls(state)
      break
    case 'slow':
      for (const ball of state.balls) {
        ball.vx *= SLOW_FACTOR
        ball.vy *= SLOW_FACTOR
      }
      setEffect(state, 'slow', SLOW_MS)
      break
    case 'life':
      state.lives = Math.min(MAX_LIVES, state.lives + 1)
      break
    case 'catch':
      setEffect(state, 'catch', CATCH_MS)
      break
  }
  events.push({ type: 'powerup', kind })
}

function expireEffects(state: BreakoutState, rng: () => number): void {
  const geo = geoOf(state)
  for (const e of state.effects) e.remainingMs -= STEP_MS
  const expired = state.effects.filter((e) => e.remainingMs <= 0)
  state.effects = state.effects.filter((e) => e.remainingMs > 0)
  for (const e of expired) {
    if (e.kind === 'wide') {
      state.paddle.width = geo.paddleW
      state.paddle.x = clamp(state.paddle.x, geo.paddleW / 2, geo.courtW - geo.paddleW / 2)
      alignStuckBalls(state)
    } else if (e.kind === 'slow') {
      for (const ball of state.balls) {
        ball.vx /= SLOW_FACTOR
        ball.vy /= SLOW_FACTOR
      }
    } else {
      releaseStuck(state, rng)
    }
  }
}

function loseLife(state: BreakoutState, events: BreakoutEvent[]): void {
  const geo = geoOf(state)
  state.lives -= 1
  events.push({ type: 'life' })
  state.powerUps = []
  state.effects = []
  state.paddle.width = geo.paddleW
  state.paddle.x = clamp(state.paddle.x, geo.paddleW / 2, geo.courtW - geo.paddleW / 2)
  if (state.lives <= 0) {
    state.status = 'over'
    events.push({ type: 'over' })
  } else {
    state.balls = [serveBall(state)]
    state.status = 'ready'
  }
}

function paddleBounce(state: BreakoutState, ball: Ball, events: BreakoutEvent[]): void {
  const geo = geoOf(state)
  const half = geo.ballSize / 2
  const p = state.paddle
  if (hasEffect(state, 'catch')) {
    ball.stuck = true
    ball.vx = 0
    ball.vy = 0
    ball.x = p.x
    ball.y = geo.paddleY - geo.paddleH / 2 - half
    events.push({ type: 'paddle' })
    return
  }
  const offset = clamp((ball.x - p.x) / (p.width / 2), -1, 1)
  const angle = -Math.PI / 2 + offset * MAX_ANGLE
  const speedNow = Math.hypot(ball.vx, ball.vy) || levelSpeed(state)
  let speed = Math.min(MAX_SPEED * geo.speedScale, speedNow * PADDLE_HIT_BOOST)
  if (hasEffect(state, 'slow')) speed *= SLOW_FACTOR
  ball.vx = Math.cos(angle) * speed
  ball.vy = Math.sin(angle) * speed
  ball.y = geo.paddleY - geo.paddleH / 2 - half - EPS
  events.push({ type: 'paddle' })
}

function brickHit(state: BreakoutState, ball: Ball, brick: Brick, axis: 'x' | 'y', events: BreakoutEvent[], rng: () => number): void {
  const half = geoOf(state).ballSize / 2
  const event = { row: brick.row, x: brick.x, y: brick.y, color: brick.color }
  if (brick.kind === 'steel') {
    reflect(ball, axis, brick.x, brick.y, brick.w, brick.h, half)
    events.push({ type: 'steel', ...event })
    return
  }
  if (brick.kind === 'tough' && brick.hits === 0) {
    brick.hits = 1
    reflect(ball, axis, brick.x, brick.y, brick.w, brick.h, half)
    events.push({ type: 'tough', ...event })
    return
  }
  brick.alive = false
  const base = scoreForRow(brick.row)
  state.score += brick.kind === 'tough' ? base * 2 : base
  reflect(ball, axis, brick.x, brick.y, brick.w, brick.h, half)
  events.push({ type: 'brick', ...event })
  maybeDropPowerUp(state, brick, rng)
}

function stepBalls(state: BreakoutState, events: BreakoutEvent[], rng: () => number): void {
  const geo = geoOf(state)
  const half = geo.ballSize / 2
  const fallen: Ball[] = []
  for (const ball of state.balls) {
    if (ball.stuck) continue
    const dx = ball.vx * STEP_SEC
    const dy = ball.vy * STEP_SEC
    const hit = firstHit(state, ball, dx, dy)
    if (!hit) {
      ball.x += dx
      ball.y += dy
    } else if (hit.kind === 'wall') {
      ball.x += dx * hit.t
      ball.y += dy * hit.t
      if (hit.axis === 'x') {
        ball.vx = -ball.vx
        ball.x = ball.vx > 0 ? half : geo.courtW - half
      } else {
        ball.vy = -ball.vy
        ball.y = geo.hudH + half
      }
      events.push({ type: 'wall' })
    } else if (hit.kind === 'paddle') {
      ball.x += dx * hit.t
      ball.y += dy * hit.t
      if (hit.axis === 'x') {
        ball.vx = -ball.vx
        ball.x = ball.vx > 0 ? state.paddle.x + state.paddle.width / 2 + half + EPS : state.paddle.x - state.paddle.width / 2 - half - EPS
      } else {
        paddleBounce(state, ball, events)
      }
    } else {
      ball.x += dx * hit.t
      ball.y += dy * hit.t
      brickHit(state, ball, hit.brick, hit.axis, events, rng)
    }
    enforceVyFloor(ball)
    if (ball.y - half > geo.courtH) fallen.push(ball)
  }
  if (fallen.length > 0) state.balls = state.balls.filter((b) => !fallen.includes(b))
}

type HitCandidate =
  | { t: number; kind: 'wall'; axis: 'x' | 'y' }
  | { t: number; kind: 'paddle'; axis: 'x' | 'y' }
  | { t: number; kind: 'brick'; brick: Brick; axis: 'x' | 'y' }

function firstHit(state: BreakoutState, ball: Ball, dx: number, dy: number): HitCandidate | null {
  const geo = geoOf(state)
  const half = geo.ballSize / 2
  let best: HitCandidate | null = null
  const consider = (c: HitCandidate) => {
    if (!best || c.t < best.t) best = c
  }
  if (dx < 0) {
    const t = (ball.x - half) / -dx
    if (t <= 1) consider({ t: Math.max(0, t), kind: 'wall', axis: 'x' })
  } else if (dx > 0) {
    const t = (geo.courtW - (ball.x + half)) / dx
    if (t <= 1) consider({ t: Math.max(0, t), kind: 'wall', axis: 'x' })
  }
  if (dy < 0) {
    const t = (ball.y - half - geo.hudH) / -dy
    if (t <= 1) consider({ t: Math.max(0, t), kind: 'wall', axis: 'y' })
  }
  if (dy > 0) {
    const p = state.paddle
    const rx = p.x - p.width / 2
    const ry = geo.paddleY - geo.paddleH / 2
    const hit = sweptHit(ball, dx, dy, rx, ry, p.width, geo.paddleH, half)
    if (hit) consider({ t: hit.t, kind: 'paddle', axis: hitAxis(ball, hit, dx, dy, rx, ry, p.width, geo.paddleH, half) })
  }
  for (const brick of state.bricks) {
    if (!brick.alive) continue
    const hit = sweptHit(ball, dx, dy, brick.x, brick.y, brick.w, brick.h, half)
    if (hit) consider({ t: hit.t, kind: 'brick', brick, axis: hitAxis(ball, hit, dx, dy, brick.x, brick.y, brick.w, brick.h, half) })
  }
  return best
}

function stepPowerUps(state: BreakoutState, events: BreakoutEvent[]): void {
  const geo = geoOf(state)
  const p = state.paddle
  const halfW = p.width / 2
  const top = geo.paddleY - geo.paddleH / 2
  const bottom = geo.paddleY + geo.paddleH / 2
  const remaining = []
  for (const pu of state.powerUps) {
    pu.y += POWERUP_FALL_SPEED * geo.speedScale * STEP_SEC
    const caught =
      pu.x + POWERUP_W / 2 >= p.x - halfW &&
      pu.x - POWERUP_W / 2 <= p.x + halfW &&
      pu.y + POWERUP_H / 2 >= top &&
      pu.y - POWERUP_H / 2 <= bottom
    if (caught) applyPowerUp(state, pu.kind, events)
    else if (pu.y - POWERUP_H / 2 <= geo.courtH) remaining.push(pu)
  }
  state.powerUps = remaining
}

/** Advance the simulation by one fixed 1/120 s step. Returns sound/particle events. Mutates state. */
export function step(state: BreakoutState, rng: () => number = Math.random): BreakoutEvent[] {
  if (state.status !== 'play') return []
  const events: BreakoutEvent[] = []
  expireEffects(state, rng)
  stepBalls(state, events, rng)
  if (state.balls.length === 0) {
    loseLife(state, events)
  } else if (state.status === 'play' && state.bricks.every((b) => !b.alive || b.kind === 'steel')) {
    state.score += state.lives * CLEAR_BONUS_PER_LIFE
    state.status = 'clear'
    events.push({ type: 'clear' })
  }
  if (state.status === 'play') stepPowerUps(state, events)
  return events
}
