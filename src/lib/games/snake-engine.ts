// src/lib/games/snake-engine.ts
/**
 * Pure snake logic. No DOM, no React; every function returns a new state.
 * Walls kill. Food placement goes through an injectable rng so tests replay.
 */

export type Dir = 'up' | 'down' | 'left' | 'right'
export type SnakeStatus = 'playing' | 'over' | 'won'
export interface Point { x: number; y: number }
export interface SnakeState {
  cols: number
  rows: number
  /** Head first. */
  snake: Point[]
  /** Heading the last step used. */
  dir: Dir
  /** Heading the next step will use. */
  next: Dir
  /** null only once the board is full. */
  food: Point | null
  score: number
  status: SnakeStatus
}

const DELTA: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

/** Milliseconds per tick: quicker as the snake grows, never below 70. */
export const tickMs = (score: number) => Math.max(70, 140 - score * 4)

/** Uniformly picks a free cell. Returns null when the board is full. */
export function placeFood(cols: number, rows: number, snake: Point[], rng: () => number): Point | null {
  const taken = new Set(snake.map((p) => p.y * cols + p.x))
  const free: number[] = []
  for (let i = 0; i < cols * rows; i++) if (!taken.has(i)) free.push(i)
  if (free.length === 0) return null
  const i = free[Math.floor(rng() * free.length)]
  return { x: i % cols, y: Math.floor(i / cols) }
}

export function createGame(cols: number, rows: number, rng: () => number = Math.random): SnakeState {
  const y = Math.floor(rows / 2)
  const x = Math.floor(cols / 4)
  const snake = [{ x, y }, { x: x - 1, y }, { x: x - 2, y }]
  return {
    cols,
    rows,
    snake,
    dir: 'right',
    next: 'right',
    food: placeFood(cols, rows, snake, rng),
    score: 0,
    status: 'playing',
  }
}

/**
 * Queues a turn. Reversals are measured against the heading the last step used,
 * not the queued one, so two quick presses can never fold the snake into itself.
 */
export function turn(state: SnakeState, dir: Dir): SnakeState {
  if (state.status !== 'playing' || dir === OPPOSITE[state.dir] || dir === state.next) return state
  return { ...state, next: dir }
}

export function step(state: SnakeState, rng: () => number = Math.random): SnakeState {
  if (state.status !== 'playing') return state
  const dir = state.next
  const d = DELTA[dir]
  const head = { x: state.snake[0].x + d.x, y: state.snake[0].y + d.y }
  if (head.x < 0 || head.x >= state.cols || head.y < 0 || head.y >= state.rows) {
    return { ...state, dir, status: 'over' }
  }
  const eating = state.food !== null && same(head, state.food)
  // The tail cell frees up on this same tick unless the snake is growing into it.
  const body = eating ? state.snake : state.snake.slice(0, -1)
  if (body.some((p) => same(p, head))) return { ...state, dir, status: 'over' }

  const snake = [head, ...body]
  const won = snake.length === state.cols * state.rows
  return {
    ...state,
    dir,
    snake,
    food: eating ? placeFood(state.cols, state.rows, snake, rng) : state.food,
    score: eating ? state.score + 1 : state.score,
    status: won ? 'won' : 'playing',
  }
}
