import type {
  Ball,
  Brick,
  BreakoutConfig,
  GameState,
  PowerUp,
  PowerUpKind,
} from './types'

export const BALL_SPEED = 360 // logical units / sec
export const POWERUP_DROP_CHANCE = 0.18
export const SLOW_FACTOR = 0.7
export const EXPAND_FACTOR = 1.5
export const MAX_LIVES = 5
export const EFFECT_MS: Record<'expand' | 'slow', number> = { expand: 12000, slow: 10000 }

// Score is time-based: it starts high and falls the longer a clear takes, so a
// faster run earns a higher score (more time = lower score). Reaches 0 at 125s.
export const SCORE_BASE = 10000
export const SCORE_PER_SEC = 80

/** Derive the time-based score from elapsed play time. */
export function scoreFromTime(elapsedMs: number): number {
  return Math.max(0, Math.round(SCORE_BASE - (elapsedMs / 1000) * SCORE_PER_SEC))
}

export const POWERUP_META: Record<PowerUpKind, { glyph: string; label: string }> = {
  expand: { glyph: 'E', label: 'Wider paddle' },
  multi: { glyph: 'M', label: 'Multi ball' },
  slow: { glyph: 'S', label: 'Slow ball' },
  life: { glyph: '+', label: 'Extra life' },
}

const POWERUP_KINDS: PowerUpKind[] = ['expand', 'multi', 'slow', 'life']

function makeBall(width: number, height: number): Ball {
  return { pos: { x: width / 2, y: height - 60 }, vel: { x: 0, y: 0 }, radius: 8 }
}

function buildBricks(width: number, cols: number, rows: number): Brick[] {
  const top = 60
  const gap = 6
  const side = 30
  const brickW = (width - side * 2 - gap * (cols - 1)) / cols
  const brickH = 22
  const bricks: Brick[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push({
        x: side + c * (brickW + gap),
        y: top + r * (brickH + gap),
        width: brickW,
        height: brickH,
        row: r,
        alive: true,
      })
    }
  }
  return bricks
}

export function createInitialState(config: BreakoutConfig): GameState {
  const { width, height, cols, rows, lives } = config
  const paddleWidth = width * 0.16
  return {
    status: 'ready',
    paddle: { x: width / 2, y: height - 40, width: paddleWidth, baseWidth: paddleWidth, height: 14 },
    balls: [makeBall(width, height)],
    bricks: buildBricks(width, cols, rows),
    powerUps: [],
    effects: [],
    score: SCORE_BASE,
    elapsedMs: 0,
    lives,
    width,
    height,
  }
}

export function setPaddleX(state: GameState, x: number): void {
  const half = state.paddle.width / 2
  state.paddle.x = Math.max(half, Math.min(state.width - half, x))
}

export function launchBalls(state: GameState): void {
  const slowed = state.effects.some((e) => e.kind === 'slow')
  const speed = BALL_SPEED * (slowed ? SLOW_FACTOR : 1)
  for (const ball of state.balls) {
    if (ball.vel.x === 0 && ball.vel.y === 0) {
      const angle = -Math.PI / 2 + (Math.random() * 0.6 - 0.3)
      ball.vel.x = Math.cos(angle) * speed
      ball.vel.y = Math.sin(angle) * speed
    }
  }
}

export function startGame(state: GameState): void {
  if (state.status === 'ready') {
    state.status = 'playing'
    launchBalls(state)
  }
}

export function togglePause(state: GameState): void {
  if (state.status === 'playing') state.status = 'paused'
  else if (state.status === 'paused') state.status = 'playing'
}

function collideWalls(ball: Ball, state: GameState): void {
  if (ball.pos.x - ball.radius < 0) {
    ball.pos.x = ball.radius
    ball.vel.x = Math.abs(ball.vel.x)
  } else if (ball.pos.x + ball.radius > state.width) {
    ball.pos.x = state.width - ball.radius
    ball.vel.x = -Math.abs(ball.vel.x)
  }
  if (ball.pos.y - ball.radius < 0) {
    ball.pos.y = ball.radius
    ball.vel.y = Math.abs(ball.vel.y)
  }
}

function collidePaddle(ball: Ball, state: GameState): void {
  const p = state.paddle
  const left = p.x - p.width / 2
  const right = p.x + p.width / 2
  const top = p.y - p.height / 2
  if (
    ball.vel.y > 0 &&
    ball.pos.y + ball.radius >= top &&
    ball.pos.y - ball.radius <= p.y + p.height / 2 &&
    ball.pos.x >= left &&
    ball.pos.x <= right
  ) {
    const offset = (ball.pos.x - p.x) / (p.width / 2) // -1..1
    const maxAngle = Math.PI / 3 // 60 degrees
    const angle = -Math.PI / 2 + offset * maxAngle
    const speed = Math.hypot(ball.vel.x, ball.vel.y) || BALL_SPEED
    ball.vel.x = Math.cos(angle) * speed
    ball.vel.y = Math.sin(angle) * speed
    ball.pos.y = top - ball.radius
  }
}

function maybeDropPowerUp(state: GameState, brick: Brick): void {
  if (Math.random() > POWERUP_DROP_CHANCE) return
  const kind = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)]
  state.powerUps.push({
    kind,
    pos: { x: brick.x + brick.width / 2, y: brick.y + brick.height / 2 },
    width: 28,
    height: 16,
    vy: 150,
  })
}

function collideBricks(ball: Ball, state: GameState): void {
  for (const brick of state.bricks) {
    if (!brick.alive) continue
    if (
      ball.pos.x + ball.radius > brick.x &&
      ball.pos.x - ball.radius < brick.x + brick.width &&
      ball.pos.y + ball.radius > brick.y &&
      ball.pos.y - ball.radius < brick.y + brick.height
    ) {
      brick.alive = false
      const overlapX = Math.min(
        ball.pos.x + ball.radius - brick.x,
        brick.x + brick.width - (ball.pos.x - ball.radius),
      )
      const overlapY = Math.min(
        ball.pos.y + ball.radius - brick.y,
        brick.y + brick.height - (ball.pos.y - ball.radius),
      )
      if (overlapX < overlapY) ball.vel.x = -ball.vel.x
      else ball.vel.y = -ball.vel.y
      maybeDropPowerUp(state, brick)
      break // at most one brick per ball per step
    }
  }
}

function addMultiBalls(state: GameState): void {
  const source = [...state.balls]
  for (const ball of source) {
    const speed = Math.hypot(ball.vel.x, ball.vel.y) || BALL_SPEED
    const base = Math.atan2(ball.vel.y, ball.vel.x)
    for (const da of [-0.4, 0.4]) {
      state.balls.push({
        pos: { x: ball.pos.x, y: ball.pos.y },
        vel: { x: Math.cos(base + da) * speed, y: Math.sin(base + da) * speed },
        radius: ball.radius,
      })
    }
  }
}

function applyPowerUp(state: GameState, kind: PowerUpKind): void {
  switch (kind) {
    case 'life':
      state.lives = Math.min(state.lives + 1, MAX_LIVES)
      break
    case 'multi':
      addMultiBalls(state)
      break
    case 'expand': {
      const existing = state.effects.find((e) => e.kind === 'expand')
      if (existing) existing.remainingMs = EFFECT_MS.expand
      else {
        state.paddle.width = state.paddle.baseWidth * EXPAND_FACTOR
        state.effects.push({ kind: 'expand', remainingMs: EFFECT_MS.expand })
      }
      break
    }
    case 'slow': {
      const existing = state.effects.find((e) => e.kind === 'slow')
      if (existing) existing.remainingMs = EFFECT_MS.slow
      else {
        for (const ball of state.balls) {
          ball.vel.x *= SLOW_FACTOR
          ball.vel.y *= SLOW_FACTOR
        }
        state.effects.push({ kind: 'slow', remainingMs: EFFECT_MS.slow })
      }
      break
    }
  }
}

function catchPowerUps(state: GameState): void {
  const p = state.paddle
  const left = p.x - p.width / 2
  const right = p.x + p.width / 2
  const top = p.y - p.height / 2
  const bottom = p.y + p.height / 2
  const remaining: PowerUp[] = []
  for (const pu of state.powerUps) {
    const hit =
      pu.pos.x + pu.width / 2 >= left &&
      pu.pos.x - pu.width / 2 <= right &&
      pu.pos.y + pu.height / 2 >= top &&
      pu.pos.y - pu.height / 2 <= bottom
    if (hit) applyPowerUp(state, pu.kind)
    else remaining.push(pu)
  }
  state.powerUps = remaining
}

function expireEffects(state: GameState, dtMs: number): void {
  for (const e of state.effects) e.remainingMs -= dtMs
  for (const e of state.effects) {
    if (e.remainingMs > 0) continue
    if (e.kind === 'expand') {
      state.paddle.width = state.paddle.baseWidth
    } else if (e.kind === 'slow') {
      for (const ball of state.balls) {
        ball.vel.x /= SLOW_FACTOR
        ball.vel.y /= SLOW_FACTOR
      }
    }
  }
  state.effects = state.effects.filter((e) => e.remainingMs > 0)
}

function loseBall(state: GameState): void {
  state.lives -= 1
  if (state.lives <= 0) {
    state.status = 'lost'
    return
  }
  // Reset board state for the next ball.
  state.effects = []
  state.paddle.width = state.paddle.baseWidth
  state.powerUps = []
  state.balls = [makeBall(state.width, state.height)]
  state.status = 'ready'
}

/** Advance the simulation by dt seconds. No-op unless status is 'playing'. */
export function stepPhysics(state: GameState, dt: number): void {
  if (state.status !== 'playing') return
  const dtMs = dt * 1000

  // Time-based score: accrues while playing, falls as time passes.
  state.elapsedMs += dtMs
  state.score = scoreFromTime(state.elapsedMs)

  for (const ball of state.balls) {
    ball.pos.x += ball.vel.x * dt
    ball.pos.y += ball.vel.y * dt
    collideWalls(ball, state)
    collidePaddle(ball, state)
    collideBricks(ball, state)
  }

  state.balls = state.balls.filter((b) => b.pos.y - b.radius <= state.height)
  if (state.balls.length === 0) {
    loseBall(state)
    return
  }

  for (const pu of state.powerUps) pu.pos.y += pu.vy * dt
  catchPowerUps(state)
  state.powerUps = state.powerUps.filter((pu) => pu.pos.y - pu.height / 2 <= state.height)

  expireEffects(state, dtMs)

  if (state.bricks.every((b) => !b.alive)) state.status = 'won'
}
