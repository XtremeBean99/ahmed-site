// --- Breakout ---
export type BrickKind = 'normal' | 'tough' | 'steel'
export type PowerUpKind = 'wide' | 'multi' | 'slow' | 'life' | 'catch'
export type EffectKind = 'wide' | 'slow' | 'catch'
export type BreakoutStatus = 'ready' | 'play' | 'paused' | 'clear' | 'over'

export interface Ball {
  x: number // center x
  y: number // center y
  vx: number
  vy: number
  /** True while resting on the paddle (serve, after a lost life, or under catch). */
  stuck: boolean
}

export interface Paddle {
  x: number // center x
  width: number
}

export interface Brick {
  col: number
  row: number
  x: number // top-left
  y: number
  w: number
  h: number
  kind: BrickKind
  /** Colour band 1..8 by row (steel always draws its own grey). */
  color: number
  /** Tough bricks only: 0 untouched, 1 cracked (breaks on the next hit). */
  hits: number
  alive: boolean
}

export interface PowerUp {
  kind: PowerUpKind
  x: number // center
  y: number
}

export interface ActiveEffect {
  kind: EffectKind
  remainingMs: number
}

export interface BreakoutState {
  status: BreakoutStatus
  score: number
  lives: number
  level: number // 1..8
  loop: number // completed full cycles of the 8 levels
  paddle: Paddle
  balls: Ball[]
  bricks: Brick[]
  powerUps: PowerUp[]
  effects: ActiveEffect[]
}

export type BreakoutEvent =
  | { type: 'paddle' }
  | { type: 'wall' }
  | { type: 'brick'; row: number; x: number; y: number; color: number }
  | { type: 'tough'; row: number; x: number; y: number; color: number }
  | { type: 'steel'; row: number; x: number; y: number; color: number }
  | { type: 'powerup'; kind: PowerUpKind }
  | { type: 'life' }
  | { type: 'clear' }
  | { type: 'over' }

// --- Typing test ---
export type CharStatus = 'untyped' | 'correct' | 'incorrect' | 'current'

export interface CharState {
  char: string
  status: CharStatus
}
