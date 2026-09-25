import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BALL_SIZE,
  COURT_H,
  COURT_W,
  PADDLE_H,
  createMatch,
  predictInterceptY,
  serveBall,
  step,
  type PongInput,
  type PongState,
} from './pong-engine'
import { mulberry32 } from './cards'

const DT = 1 / 120
const noInput: PongInput = { left: 0, right: 0 }
const straight = () => 0.5

function playState(over: Partial<PongState> = {}): PongState {
  const base = createMatch('2p', 'normal', straight)
  return {
    ...base,
    status: 'play',
    timer: 0,
    ball: { x: (COURT_W - BALL_SIZE) / 2, y: (COURT_H - BALL_SIZE) / 2, vx: 220, vy: 0 },
    ...over,
  }
}

const approx = (actual: number, expected: number, eps = 1e-6) => {
  assert.ok(Math.abs(actual - expected) < eps, `${actual} !~ ${expected}`)
}

test('createMatch starts a centred serve with a random server', () => {
  const left = createMatch('1p', 'normal', () => 0)
  assert.equal(left.server, 'left')
  const right = createMatch('1p', 'normal', () => 0.9)
  assert.equal(right.server, 'right')
  assert.equal(left.status, 'serve')
  assert.equal(left.timer, 1)
  assert.deepEqual(left.ball, { x: 265, y: 137, vx: 0, vy: 0 })
  assert.deepEqual(left.score, [0, 0])
  assert.equal(left.left.y, (COURT_H - PADDLE_H) / 2)
  assert.equal(left.right.y, (COURT_H - PADDLE_H) / 2)
})

test('the serve launches after the 1.0s countdown toward the receiver', () => {
  const rng = mulberry32(7)
  const server = createMatch('2p', 'normal', rng).server
  let state = createMatch('2p', 'normal', rng)
  const events: { type: string; side?: string }[] = []
  for (let i = 0; i < 121; i++) {
    const r = step(state, DT, noInput, rng)
    state = r.state
    events.push(...r.events)
  }
  assert.equal(state.status, 'play')
  assert.ok(events.some((e) => e.type === 'serve' && e.side === server))
  if (server === 'left') assert.ok(state.ball.vx > 0)
  else assert.ok(state.ball.vx < 0)
  approx(Math.hypot(state.ball.vx, state.ball.vy), 220)
})

test('serves stay within 25 degrees of horizontal at 220 px/s', () => {
  for (let seed = 0; seed < 25; seed++) {
    const ball = serveBall('left', mulberry32(seed))
    const angle = Math.atan2(ball.vy, ball.vx)
    assert.ok(Math.abs(angle) <= (25 * Math.PI) / 180 + 1e-9)
    approx(Math.hypot(ball.vx, ball.vy), 220)
    assert.ok(ball.vx > 0)
  }
})

test('top and bottom walls reflect the ball and emit a wall event', () => {
  const top = playState({ ball: { x: 265, y: 1, vx: 200, vy: -180 } })
  const rTop = step(top, DT, noInput, straight)
  assert.ok(rTop.events.some((e) => e.type === 'wall'))
  assert.ok(rTop.state.ball.vy > 0)
  assert.ok(rTop.state.ball.y >= 0)

  const bottom = playState({ ball: { x: 265, y: COURT_H - BALL_SIZE - 1, vx: 200, vy: 180 } })
  const rBottom = step(bottom, DT, noInput, straight)
  assert.ok(rBottom.events.some((e) => e.type === 'wall'))
  assert.ok(rBottom.state.ball.vy < 0)
  assert.ok(rBottom.state.ball.y + BALL_SIZE <= COURT_H)
})

test('a centre paddle hit returns the ball flat at 6 percent more speed', () => {
  const s = playState({
    ball: { x: 505, y: 137, vx: 220, vy: 0 },
    right: { y: 140 - PADDLE_H / 2 },
  })
  const r = step(s, DT, noInput, straight)
  assert.ok(r.events.some((e) => e.type === 'paddle' && e.side === 'right'))
  assert.ok(r.state.ball.vx < 0)
  approx(r.state.ball.vy, 0)
  approx(Math.hypot(r.state.ball.vx, r.state.ball.vy), 220 * 1.06, 1e-6)
  assert.equal(r.state.rally, 1)
})

test('a paddle hit angle follows offset times 55 degrees', () => {
  const s = playState({
    ball: { x: 505, y: 123, vx: 220, vy: 0 },
    right: { y: 140 - PADDLE_H / 2 },
  })
  const r = step(s, DT, noInput, straight)
  assert.ok(r.state.ball.vx < 0)
  assert.ok(r.state.ball.vy < 0, 'hitting the top half sends the ball upward')
  const offset = (123 + BALL_SIZE / 2 - 140) / (PADDLE_H / 2)
  const expected = offset * 55 * Math.PI / 180
  const actual = Math.atan2(r.state.ball.vy, -r.state.ball.vx)
  approx(actual, expected)
})

test('ball speed-up is capped at 520 px/s', () => {
  const s = playState({
    ball: { x: 505, y: 137, vx: 500, vy: 0 },
    right: { y: 140 - PADDLE_H / 2 },
  })
  const r = step(s, DT, noInput, straight)
  assert.ok(r.state.ball.vx < 0)
  approx(Math.hypot(r.state.ball.vx, r.state.ball.vy), 520)
})

test('the swept collision never tunnels a max-speed ball through a paddle', () => {
  // At dt=1/20 the ball moves 26px, further than the paddle and ball together,
  // so a naive move-then-check would skip right past the face.
  const s = playState({
    ball: { x: 500, y: 137, vx: 520, vy: 0 },
    right: { y: 140 - PADDLE_H / 2 },
  })
  const r = step(s, 1 / 20, noInput, straight)
  assert.ok(r.events.some((e) => e.type === 'paddle' && e.side === 'right'))
  assert.ok(!r.events.some((e) => e.type === 'score'))
  assert.ok(r.state.ball.vx < 0)
})

test('a ball past the left edge scores for the right player', () => {
  const s = playState({ ball: { x: 10, y: 137, vx: -300, vy: 0 }, left: { y: 0 } })
  const r = step(s, 0.1, noInput, straight)
  assert.equal(r.state.score[1], 1)
  assert.equal(r.state.status, 'point')
  assert.equal(r.state.timer, 0.7)
  assert.equal(r.state.server, 'right')
  assert.ok(r.events.some((e) => e.type === 'score' && e.side === 'right'))
})

test('a ball past the right edge scores for the left player', () => {
  const s = playState({ ball: { x: COURT_W - 16, y: 137, vx: 300, vy: 0 }, right: { y: COURT_H - PADDLE_H } })
  const r = step(s, 0.1, noInput, straight)
  assert.equal(r.state.score[0], 1)
  assert.equal(r.state.server, 'left')
  assert.ok(r.events.some((e) => e.type === 'score' && e.side === 'left'))
})

test('after a point pause the serve heads toward the player who conceded', () => {
  const scored = step(playState({ ball: { x: 10, y: 137, vx: -300, vy: 0 }, left: { y: 0 } }), 0.1, noInput, straight).state
  const serving = step(scored, 0.7, noInput, straight).state
  assert.equal(serving.status, 'serve')
  assert.equal(serving.timer, 1)
  const launched = step(serving, 1, noInput, straight).state
  assert.equal(launched.status, 'play')
  assert.ok(launched.ball.vx < 0, 'right serves toward the left conceder')
})

test('first to 7 ends the match with a winner', () => {
  const s = playState({ ball: { x: 10, y: 137, vx: -300, vy: 0 }, left: { y: 0 }, score: [6, 6] })
  const r = step(s, 0.1, noInput, straight)
  assert.equal(r.state.status, 'over')
  assert.equal(r.state.winner, 'right')
  assert.equal(r.state.score[1], 7)
  assert.ok(r.events.some((e) => e.type === 'over' && e.side === 'right'))
})

test('paddles move at 320 px/s from keys and clamp inside the court', () => {
  const up = step(playState({ left: { y: 100 } }), 0.05, { left: -1, right: 0 }, straight)
  assert.equal(up.state.left.y, 100 - 320 * 0.05)

  const down = step(playState({ right: { y: 100 } }), 0.05, { left: 0, right: 1 }, straight)
  assert.equal(down.state.right.y, 100 + 320 * 0.05)

  const clampTop = step(playState({ left: { y: 0 } }), 0.05, { left: -1, right: 0 }, straight)
  assert.equal(clampTop.state.left.y, 0)

  const clampBottom = step(playState({ right: { y: COURT_H - PADDLE_H } }), 0.05, { left: 0, right: 1 }, straight)
  assert.equal(clampBottom.state.right.y, COURT_H - PADDLE_H)
})

test('a mouse target moves the left paddle at up to 700 px/s', () => {
  const s = createMatch('1p', 'normal', straight)
  const state = { ...s, status: 'play' as const, timer: 0, left: { y: 0 } }
  const r = step(state, 0.1, { left: 0, leftTarget: 140, right: 0 }, straight)
  assert.equal(r.state.left.y, 70)
})

test('2P input moves both paddles independently', () => {
  const r = step(playState({ left: { y: 100 }, right: { y: 100 } }), 0.05, { left: -1, right: 1 }, straight)
  assert.equal(r.state.left.y, 84)
  assert.equal(r.state.right.y, 116)
})

test('the CPU aims at the predicted intercept, reflecting wall bounces', () => {
  const s = createMatch('1p', 'hard', straight)
  const state: PongState = {
    ...s,
    status: 'play',
    timer: 0,
    ball: { x: 300, y: 30, vx: 240, vy: -160 },
    right: { y: 0 },
    cpu: { reaction: 0, aimOffset: 0 },
  }
  const predicted = predictInterceptY(state.ball)
  assert.ok(predicted >= BALL_SIZE / 2 && predicted <= COURT_H - BALL_SIZE / 2)
  assert.ok(predicted > 30, 'without the wall reflection the straight line would leave the court')
  const r = step(state, 0.1, noInput, straight)
  assert.equal(r.state.right.y, 33, 'hard CPU covers 330 * 0.1 px toward the intercept')
})

test('the CPU waits out its reaction time before tracking', () => {
  const s = createMatch('1p', 'easy', straight)
  const state: PongState = {
    ...s,
    status: 'play',
    timer: 0,
    ball: { x: 300, y: 137, vx: 240, vy: 0 },
    right: { y: 0 },
    cpu: { reaction: 0.24, aimOffset: 0 },
  }
  const reacting = step(state, 0.3, noInput, straight)
  assert.equal(reacting.state.cpu.reaction, 0)
  assert.equal(reacting.state.right.y, 0, 'holds still while reacting')
  const tracking = step(reacting.state, 0.1, noInput, straight)
  assert.ok(tracking.state.right.y > 0)
})

test('the CPU drifts back to centre when the ball is moving away', () => {
  const s = createMatch('1p', 'normal', straight)
  const state: PongState = {
    ...s,
    status: 'play',
    timer: 0,
    ball: { x: 300, y: 137, vx: -240, vy: 0 },
    right: { y: 0 },
    cpu: { reaction: 0, aimOffset: 0 },
  }
  const r = step(state, 0.1, noInput, straight)
  assert.ok(r.state.right.y > 0, 'moves down toward the centre line')
  assert.ok(r.state.right.y <= 24)
})

test('a seeded rng replays an identical match', () => {
  const rngA = mulberry32(99)
  const rngB = mulberry32(99)
  let a = createMatch('1p', 'normal', rngA)
  let b = createMatch('1p', 'normal', rngB)
  assert.deepEqual(a, b)
  const inputs: PongInput[] = [
    { left: -1, right: 0 },
    { left: 0, leftTarget: 120, right: 0 },
    { left: 1, right: 0 },
    { left: 0, right: 0 },
  ]
  for (let i = 0; i < 500; i++) {
    const input = inputs[i % inputs.length]
    const ra = step(a, DT, input, rngA)
    const rb = step(b, DT, input, rngB)
    assert.deepEqual(ra.events, rb.events)
    a = ra.state
    b = rb.state
  }
  assert.deepEqual(a, b)
})

test('over matches no longer step', () => {
  const s = playState({ ball: { x: 10, y: 137, vx: -300, vy: 0 }, left: { y: 0 }, score: [6, 6] })
  const over = step(s, 0.1, noInput, straight).state
  const after = step(over, 0.5, { left: -1, right: 0 }, straight)
  assert.equal(after.state, over, 'the same state object comes back untouched')
  assert.deepEqual(after.events, [])
})
