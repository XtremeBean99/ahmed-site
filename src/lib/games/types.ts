// --- Breakout ---
export interface Vec2 {
  x: number
  y: number
}

export interface Ball {
  pos: Vec2
  vel: Vec2
  radius: number
}

export interface Paddle {
  x: number // center x (logical units)
  y: number // center y
  width: number
  baseWidth: number
  height: number
}

export interface Brick {
  x: number // top-left
  y: number
  width: number
  height: number
  row: number
  alive: boolean
}

export type PowerUpKind = 'expand' | 'multi' | 'slow' | 'life'

export interface PowerUp {
  kind: PowerUpKind
  pos: Vec2 // center
  width: number
  height: number
  vy: number
}

/** Only timed power-ups appear here; 'multi' and 'life' are instant. */
export interface ActiveEffect {
  kind: Extract<PowerUpKind, 'expand' | 'slow'>
  remainingMs: number
}

export type GameStatus = 'ready' | 'playing' | 'paused' | 'won' | 'lost'

export interface GameState {
  status: GameStatus
  paddle: Paddle
  balls: Ball[]
  bricks: Brick[]
  powerUps: PowerUp[]
  effects: ActiveEffect[]
  score: number // time-based: higher for a faster clear
  elapsedMs: number // total active play time
  lives: number
  width: number // logical playfield width
  height: number // logical playfield height
}

export interface BreakoutConfig {
  width: number
  height: number
  cols: number
  rows: number
  lives: number
}

// --- Typing test ---
export type CharStatus = 'untyped' | 'correct' | 'incorrect' | 'current'

export interface CharState {
  char: string
  status: CharStatus
}
