import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, step, turn, placeFood, tickMs, type SnakeState } from './snake-engine'

/** Food is pinned to the last free cell, well away from the starting snake. */
const lastFree = () => 0.999999

function run(state: SnakeState, ticks: number): SnakeState {
  for (let i = 0; i < ticks; i++) state = step(state, lastFree)
  return state
}

test('starts as a length-3 snake heading right, with food off the body', () => {
  const g = createGame(10, 6, lastFree)
  assert.equal(g.snake.length, 3)
  assert.equal(g.dir, 'right')
  assert.equal(g.status, 'playing')
  assert.ok(g.food)
  assert.ok(!g.snake.some((p) => p.x === g.food!.x && p.y === g.food!.y))
})

test('hitting a wall ends the game', () => {
  // Head starts at x=2 on a 10-wide board, so 7 steps reach x=9 and the 8th leaves.
  const g = run(createGame(10, 6, lastFree), 8)
  assert.equal(g.status, 'over')
})

test('a 180-degree turn is rejected, a legal turn is queued and applied', () => {
  const g = createGame(10, 6, lastFree)
  assert.equal(turn(g, 'left'), g, 'reversal must be ignored, not queued')
  const up = turn(g, 'up')
  assert.equal(up.next, 'up')
  assert.equal(up.dir, 'right', 'the queued turn only applies on the next step')
  const after = step(up, lastFree)
  assert.equal(after.dir, 'up')
  assert.equal(after.snake[0].y, g.snake[0].y - 1)
})

test('two turns inside one tick cannot fold the snake into itself', () => {
  // right -> up queued -> left would be a reversal of the APPLIED heading.
  const g = turn(turn(createGame(10, 6, lastFree), 'up'), 'left')
  assert.equal(g.next, 'up')
  assert.equal(step(g, lastFree).status, 'playing')
})

test('the snake may move into the cell its tail is vacating', () => {
  // A length-4 snake turned into a tight square lands on its own old tail cell.
  let g = createGame(10, 6, lastFree)
  g = { ...g, snake: [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 3 }], dir: 'right', next: 'down' }
  const after = step(g, lastFree)
  assert.equal(after.status, 'playing')
  assert.deepEqual(after.snake[0], { x: 4, y: 3 })
})

test('running into the body ends the game', () => {
  // (4,3) is a mid-body cell here, not the tail, so it is still occupied next tick.
  let g = createGame(10, 6, lastFree)
  g = {
    ...g,
    snake: [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }],
    dir: 'right',
    next: 'down',
  }
  assert.equal(step(g, lastFree).status, 'over')
})

test('eating grows the snake by one, scores, and respawns food off the body', () => {
  const g = createGame(10, 6, lastFree)
  const fed = step({ ...g, food: { x: 3, y: 3 }, snake: [{ x: 3, y: 2 }, { x: 2, y: 2 }], next: 'down' }, lastFree)
  assert.equal(fed.score, 1)
  assert.equal(fed.snake.length, 3)
  assert.ok(!fed.snake.some((p) => p.x === fed.food!.x && p.y === fed.food!.y))
})

test('filling the board wins instead of hanging on food placement', () => {
  // 2x2 board, three cells of snake, the fourth holds the food.
  const g: SnakeState = {
    cols: 2, rows: 2,
    snake: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    dir: 'up', next: 'right',
    food: { x: 1, y: 0 },
    score: 3,
    status: 'playing',
  }
  const won = step(g, lastFree)
  assert.equal(won.status, 'won')
  assert.equal(won.food, null)
  assert.equal(placeFood(2, 2, won.snake, lastFree), null)
})

test('the tick speeds up with the score but never below 70ms', () => {
  assert.equal(tickMs(0), 140)
  assert.equal(tickMs(5), 120)
  assert.equal(tickMs(100), 70)
})
