import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mulberry32 } from './cards'
import type { BreakoutState, Brick } from './types'
import {
  BALL_SIZE,
  BASE_SPEED,
  COURT_W,
  createGame,
  GRID_X,
  GRID_Y,
  launch,
  levelSpeed,
  LEVELS,
  MAX_LIVES,
  MAX_SPEED,
  movePaddle,
  nextLevel,
  PADDLE_H,
  PADDLE_Y,
  parseLevel,
  POWERUP_H,
  scoreForRow,
  START_LIVES,
  step,
  togglePause,
} from './breakout-engine'

const noDrop = () => 0.999999
const mid = () => 0.5

const farBrick = (): Brick => ({
  col: 0,
  row: 0,
  x: GRID_X,
  y: GRID_Y,
  w: 34,
  h: 10,
  kind: 'normal',
  color: 1,
  hits: 0,
  alive: true,
})

function playState(overrides?: Partial<BreakoutState>): BreakoutState {
  const s = createGame()
  s.status = 'play'
  return Object.assign(s, overrides)
}

function ballAt(s: BreakoutState, x: number, y: number, vx: number, vy: number): BreakoutState {
  s.balls = [{ x, y, vx, vy, stuck: false }]
  s.status = 'play'
  return s
}

function setBallAtOffset(s: BreakoutState, offset: number): void {
  const half = s.paddle.width / 2
  ballAt(s, s.paddle.x + offset * half, PADDLE_Y - PADDLE_H / 2 - BALL_SIZE / 2 - 1, 0, 240)
  s.bricks = [farBrick()]
}

function brickBelow(s: BreakoutState, brick: Brick): void {
  ballAt(s, brick.x + brick.w / 2, brick.y + brick.h + BALL_SIZE / 2 + 1, 0, -240)
}

test('levels parse to the right dimensions and grid positions', () => {
  assert.equal(LEVELS.length, 8)
  for (const rows of LEVELS) for (const row of rows) assert.equal(row.length, 14)
  const bricks = parseLevel(LEVELS[0])
  assert.equal(bricks.length, 84)
  const first = bricks[0]
  assert.equal(first.x, GRID_X)
  assert.equal(first.y, GRID_Y)
  assert.equal(first.w, 34)
  assert.equal(first.h, 10)
  const last = bricks[bricks.length - 1]
  assert.equal(last.col, 13)
  assert.equal(last.x + last.w, GRID_X + 502)
})

test('parseLevel maps chars to brick kinds and colour bands', () => {
  const bricks = parseLevel(['1', 'T', 'S'])
  assert.equal(bricks.length, 3)
  assert.deepEqual(
    bricks.map((b) => [b.kind, b.color, b.row]),
    [
      ['normal', 1, 0],
      ['tough', 2, 1],
      ['steel', 3, 2],
    ],
  )
})

test('createGame starts ready on level 1 with a stuck ball on the paddle', () => {
  const s = createGame()
  assert.equal(s.status, 'ready')
  assert.equal(s.score, 0)
  assert.equal(s.lives, START_LIVES)
  assert.equal(s.level, 1)
  assert.equal(s.loop, 0)
  assert.equal(s.paddle.width, 56)
  assert.equal(s.balls.length, 1)
  assert.equal(s.balls[0].stuck, true)
  assert.equal(s.balls[0].y, PADDLE_Y - PADDLE_H / 2 - BALL_SIZE / 2)
})

test('movePaddle clamps to the court and carries the stuck ball', () => {
  const s = createGame()
  movePaddle(s, 100)
  assert.equal(s.paddle.x, 100)
  assert.equal(s.balls[0].x, 100)
  movePaddle(s, -50)
  assert.equal(s.paddle.x, s.paddle.width / 2)
  assert.equal(s.balls[0].x, s.paddle.width / 2)
  movePaddle(s, COURT_W + 50)
  assert.equal(s.paddle.x, COURT_W - s.paddle.width / 2)
})

test('launch starts play at the base speed for the level', () => {
  const s = createGame()
  launch(s, mid)
  assert.equal(s.status, 'play')
  assert.equal(s.balls[0].stuck, false)
  assert.ok(Math.abs(s.balls[0].vx) < 0.001)
  assert.equal(s.balls[0].vy, -BASE_SPEED)
})

test('paddle angle follows the hit offset up to 60 degrees from vertical', () => {
  const s = playState()
  setBallAtOffset(s, 0)
  let events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'paddle'))
  assert.ok(Math.abs(s.balls[0].vx) < 0.001)
  assert.ok(s.balls[0].vy < 0)

  setBallAtOffset(s, 0.5)
  events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'paddle'))
  assert.ok(s.balls[0].vx > 0)
  assert.ok(Math.abs(s.balls[0].vy) >= 0.35 * Math.hypot(s.balls[0].vx, s.balls[0].vy))

  setBallAtOffset(s, -1)
  events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'paddle'))
  assert.ok(s.balls[0].vx < 0)
})

test('a normal brick breaks and scores by row', () => {
  const s = playState()
  const target = farBrick()
  s.bricks = [target, { ...farBrick(), col: 1, x: GRID_X + 36 }]
  brickBelow(s, target)
  const events = step(s, noDrop)
  assert.equal(target.alive, false)
  assert.equal(s.score, scoreForRow(0))
  const brick = events.find((e) => e.type === 'brick')
  assert.deepEqual(brick, { type: 'brick', row: 0, x: target.x, y: target.y, color: target.color })
})

test('a tough brick needs two hits and scores double', () => {
  const s = playState()
  const target: Brick = { ...farBrick(), kind: 'tough', color: 1 }
  s.bricks = [target, { ...farBrick(), col: 1, x: GRID_X + 36 }]
  brickBelow(s, target)
  let events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'tough'))
  assert.equal(target.alive, true)
  assert.equal(target.hits, 1)
  assert.equal(s.score, 0)

  brickBelow(s, target)
  events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'brick'))
  assert.equal(target.alive, false)
  assert.equal(s.score, scoreForRow(0) * 2)
})

test('steel never breaks and does not block the clear', () => {
  const s = playState()
  const steel: Brick = { ...farBrick(), kind: 'steel', color: 0 }
  const normal = { ...farBrick(), col: 1, x: GRID_X + 36 }
  s.bricks = [steel, normal]
  brickBelow(s, normal)
  const events = step(s, noDrop)
  assert.equal(steel.alive, true)
  assert.equal(normal.alive, false)
  assert.equal(s.status, 'clear')
  assert.equal(s.score, scoreForRow(0) + s.lives * 100)
  assert.ok(events.some((e) => e.type === 'clear'))
})

test('wall and HUD line bounces reflect the ball', () => {
  const s = playState({ bricks: [farBrick()] })
  ballAt(s, 4, 100, -240, -30)
  let events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'wall'))
  assert.ok(s.balls[0].vx > 0)

  ballAt(s, 100, 24, 0, -240)
  events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'wall'))
  assert.ok(s.balls[0].vy > 0)
  assert.equal(s.balls[0].y, 23)
})

test('the vy floor stops the ball crawling sideways after a wall bounce', () => {
  const s = playState({ bricks: [farBrick()] })
  ballAt(s, 6, 100, -400, -10)
  step(s, noDrop)
  const b = s.balls[0]
  const speed = Math.hypot(b.vx, b.vy)
  assert.ok(Math.abs(b.vy) >= 0.35 * speed)
})

test('a 440 px/s ball cannot tunnel through a brick row', () => {
  const s = playState()
  const target = farBrick()
  s.bricks = [target, { ...farBrick(), col: 1, x: GRID_X + 36 }]
  ballAt(s, target.x + target.w / 2, target.y - BALL_SIZE / 2 - 1, 0, MAX_SPEED)
  const events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'brick'))
  assert.equal(target.alive, false)
  assert.ok(s.balls[0].vy < 0)
})

test('a 440 px/s ball cannot tunnel through the paddle', () => {
  const s = playState({ bricks: [farBrick()] })
  ballAt(s, s.paddle.x, 240, 0, MAX_SPEED)
  let bounced = false
  for (let i = 0; i < 12 && !bounced; i++) {
    const events = step(s, noDrop)
    if (events.some((e) => e.type === 'paddle')) bounced = true
  }
  assert.equal(bounced, true)
  assert.ok(s.balls.length > 0)
  assert.ok(s.balls[0].vy < 0)
})

test('losing the last ball costs a life and resets to ready', () => {
  const s = playState({
    lives: 3,
    effects: [{ kind: 'wide', remainingMs: 5000 }],
    powerUps: [{ kind: 'life', x: 100, y: 100 }],
  })
  ballAt(s, s.paddle.x, 300, 0, 240)
  const events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'life'))
  assert.equal(s.lives, 2)
  assert.equal(s.status, 'ready')
  assert.equal(s.balls.length, 1)
  assert.equal(s.balls[0].stuck, true)
  assert.deepEqual(s.effects, [])
  assert.deepEqual(s.powerUps, [])
})

test('no lives left is game over', () => {
  const s = playState({ lives: 1 })
  ballAt(s, s.paddle.x, 300, 0, 240)
  const events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'life'))
  assert.ok(events.some((e) => e.type === 'over'))
  assert.equal(s.status, 'over')
})

test('wide power-up widens the paddle and expires back to base', () => {
  const s = playState({ bricks: [farBrick()] })
  ballAt(s, s.paddle.x, 150, 0, 240)
  s.powerUps = [{ kind: 'wide', x: s.paddle.x, y: PADDLE_Y - PADDLE_H / 2 - POWERUP_H / 2 }]
  const events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'powerup' && e.kind === 'wide'))
  assert.equal(s.paddle.width, 84)
  s.effects[0].remainingMs = 1
  step(s, noDrop)
  assert.equal(s.paddle.width, 56)
  assert.equal(s.effects.length, 0)
})

test('multi power-up splits each ball into three', () => {
  const s = playState({ bricks: [farBrick()] })
  ballAt(s, s.paddle.x, 150, 0, 240)
  s.powerUps = [{ kind: 'multi', x: s.paddle.x, y: PADDLE_Y - PADDLE_H / 2 - POWERUP_H / 2 }]
  const events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'powerup' && e.kind === 'multi'))
  assert.equal(s.balls.length, 3)
})

test('slow power-up scales ball speed and restores it on expiry', () => {
  const s = playState({ bricks: [farBrick()] })
  ballAt(s, s.paddle.x, 150, 0, 240)
  s.powerUps = [{ kind: 'slow', x: s.paddle.x, y: PADDLE_Y - PADDLE_H / 2 - POWERUP_H / 2 }]
  const events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'powerup' && e.kind === 'slow'))
  assert.equal(Math.hypot(s.balls[0].vx, s.balls[0].vy), 240 * 0.7)
  s.effects[0].remainingMs = 1
  step(s, noDrop)
  assert.ok(Math.abs(Math.hypot(s.balls[0].vx, s.balls[0].vy) - 240) < 0.001)
})

test('life power-up adds a life up to the maximum', () => {
  const s = playState({ bricks: [farBrick()], lives: 3 })
  ballAt(s, s.paddle.x, 150, 0, 240)
  s.powerUps = [{ kind: 'life', x: s.paddle.x, y: PADDLE_Y - PADDLE_H / 2 - POWERUP_H / 2 }]
  step(s, noDrop)
  assert.equal(s.lives, 4)

  s.lives = MAX_LIVES
  s.powerUps = [{ kind: 'life', x: s.paddle.x, y: PADDLE_Y - PADDLE_H / 2 - POWERUP_H / 2 }]
  step(s, noDrop)
  assert.equal(s.lives, MAX_LIVES)
})

test('catch power-up sticks the ball to the paddle and launch releases it', () => {
  const s = playState({ bricks: [farBrick()] })
  ballAt(s, s.paddle.x, 150, 0, 240)
  s.powerUps = [{ kind: 'catch', x: s.paddle.x, y: PADDLE_Y - PADDLE_H / 2 - POWERUP_H / 2 }]
  let events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'powerup' && e.kind === 'catch'))

  ballAt(s, s.paddle.x, PADDLE_Y - PADDLE_H / 2 - BALL_SIZE / 2 - 1, 0, 240)
  events = step(s, noDrop)
  assert.ok(events.some((e) => e.type === 'paddle'))
  assert.equal(s.balls[0].stuck, true)
  assert.equal(s.balls[0].vx, 0)
  assert.equal(s.balls[0].vy, 0)

  launch(s, mid)
  assert.equal(s.balls[0].stuck, false)
  assert.ok(s.balls[0].vy < 0)
})

test('power-up drops honour the 12 % chance and pick a kind from the rng', () => {
  const s = playState()
  const target = farBrick()
  s.bricks = [target, { ...farBrick(), col: 1, x: GRID_X + 36 }]
  brickBelow(s, target)
  const seq = [0.05, 0.1]
  step(s, () => seq.shift() ?? 0.9)
  assert.equal(s.powerUps.length, 1)
  assert.equal(s.powerUps[0].kind, 'wide')

  const s2 = playState()
  const target2 = farBrick()
  s2.bricks = [target2, { ...farBrick(), col: 1, x: GRID_X + 36 }]
  brickBelow(s2, target2)
  step(s2, noDrop)
  assert.equal(s2.powerUps.length, 0)
})

test('level progression loops 8 -> 1 with the loop speed bonus', () => {
  const s = createGame()
  assert.equal(levelSpeed(s), BASE_SPEED)
  nextLevel(s)
  assert.equal(s.level, 2)
  assert.equal(s.status, 'ready')
  assert.equal(s.balls[0].stuck, true)
  assert.equal(levelSpeed(s), BASE_SPEED + 15)
  for (let i = 0; i < 6; i++) nextLevel(s)
  assert.equal(s.level, 8)
  assert.equal(levelSpeed(s), BASE_SPEED + 7 * 15)
  nextLevel(s)
  assert.equal(s.level, 1)
  assert.equal(s.loop, 1)
  assert.equal(levelSpeed(s), BASE_SPEED + 30)
})

test('paddle hit speed is capped at 440 px/s', () => {
  const s = playState()
  setBallAtOffset(s, 0)
  s.balls[0].vy = MAX_SPEED
  step(s, noDrop)
  assert.ok(Math.hypot(s.balls[0].vx, s.balls[0].vy) <= MAX_SPEED + 0.001)
})

test('step is a no-op outside play', () => {
  const ready = createGame()
  const before = JSON.stringify(ready)
  step(ready, noDrop)
  assert.equal(JSON.stringify(ready), before)

  const s = createGame()
  launch(s, mid)
  togglePause(s)
  assert.equal(s.status, 'paused')
  const frozen = JSON.stringify(s)
  step(s, noDrop)
  assert.equal(JSON.stringify(s), frozen)
  togglePause(s)
  assert.equal(s.status, 'play')
})

test('seeded runs replay identically', () => {
  const run = (seed: number) => {
    const s = createGame()
    const rng = mulberry32(seed)
    launch(s, rng)
    for (let i = 0; i < 300; i++) step(s, rng)
    return s
  }
  assert.equal(JSON.stringify(run(7)), JSON.stringify(run(7)))
})
