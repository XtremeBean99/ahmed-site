// src/lib/games/mahjong-tutorial.ts
/**
 * The practice hand behind the 4-player tutorial: one stacked deal in which you
 * (seat 0, East) throw out a lone wind, pung a discard, chow from the player on
 * your left, wait on a pair and win by self-draw. The bots follow a script (fixed
 * discards, every claim passed), so the hand always plays out the same way, and
 * `coachFor` reads the state to say which lesson is on and which move it wants.
 * Pure; runs on the ordinary engine.
 */
import { advance, applyAction, legalActions, newMatch, pendingFor, type Action, type GameState } from './mahjong-engine'
import { botAction } from './mahjong-bot'
import { compareCodes, isBonusCode } from './mahjong-scoring'
import { fullSet, type TileCode } from './mahjong-tiles'

const H = (s: string): TileCode[] => s.split(' ')

/** Your 13: a finished chow, a dragon pung, a pair to pung, two characters to chow onto, a lone 9, and two strays. */
export const TUTORIAL_HAND = H('d2 d3 d4 b7 b7 c4 c5 r1 r1 r1 d9 w4 c1')
/** Your two draws: a stray first, then the tile that completes the pair. */
const YOUR_DRAWS = H('b1 d9')
/** Each bot's discards in order: Kai feeds the pung, Lin (on your left) the chow. */
const BOT_DISCARDS: Record<number, TileCode[]> = {
  1: H('b7 w1 w2'),
  2: H('w2 w3'),
  3: H('c6 b9'),
}
/** Seats in the order they draw from the wall: you, Kai (then you pung and discard), Kai, Mei, Lin, Kai, Mei, Lin, you. */
const DRAW_ORDER = [0, 1, 1, 2, 3, 1, 2, 3, 0]

export const TUTORIAL_CHOW: [TileCode, TileCode] = ['c4', 'c5']

/** The stacked practice deal, ready for its first draw. Minimum faan 0, one hand. */
export function tutorialMatch(): GameState {
  const s = newMatch({ seed: 0x7a11, minFaan: 0, rounds: 'east' })
  const pool = fullSet(true)
  const take = (t: TileCode) => {
    const i = pool.indexOf(t)
    if (i < 0) throw new Error(`mahjong tutorial: no ${t} left`)
    pool.splice(i, 1)
    return t
  }
  const hands: TileCode[][] = [TUTORIAL_HAND.map(take), [], [], []]
  for (const seat of [1, 2, 3]) hands[seat] = BOT_DISCARDS[seat].map(take)
  const yourDraws = YOUR_DRAWS.map(take)
  // Bonus tiles and a few spares sit in the dead wall, which this hand never reaches.
  const bonus = pool.filter(isBonusCode)
  const plain = pool.filter((t) => !isBonusCode(t))
  for (const seat of [1, 2, 3]) while (hands[seat].length < 13) hands[seat].push(plain.shift()!)
  const dead = [...bonus, ...plain.splice(0, 14 - bonus.length)]
  // The live wall is drawn with pop(), so the first draw goes last.
  const draws: TileCode[] = []
  let yours = 0
  for (const seat of DRAW_ORDER) draws.push(seat === 0 ? yourDraws[yours++] : plain.shift()!)
  s.wall = [...plain, ...draws.reverse()]
  s.dead = dead
  s.seats.forEach((seat, i) => {
    seat.hand = hands[i].sort(compareCodes)
    seat.bonus = []
    seat.melds = []
    seat.discards = []
    seat.discardHistory = []
  })
  return s
}

/** The scripted bots: their listed discard when it is their turn, and a pass on every claim. */
export function tutorialBotAction(state: GameState, seat: number): Action | null {
  if (legalActions(state, seat).length === 0) return null
  if (state.phase === 'claim') return { type: 'pass' }
  const me = state.seats[seat]
  const tile = BOT_DISCARDS[seat]?.[me.discardHistory.length]
  if (tile && me.hand.includes(tile)) return { type: 'discard', tile }
  return botAction(state, seat, 'easy')
}

export type CoachStep =
  | 'start'
  | 'discardWind'
  | 'watchPung'
  | 'pung'
  | 'discardAfterPung'
  | 'watchChow'
  | 'chow'
  | 'discardReady'
  | 'watchWin'
  | 'win'
  | 'done'

export interface Coach {
  step: CoachStep
  /** The one move the lesson accepts from you; null while the bots play. */
  expect: Action | null
}

/** Which lesson the practice hand is on, read from the state alone. */
export function coachFor(state: GameState): Coach {
  if (state.phase === 'handOver' || state.phase === 'matchOver') return { step: 'done', expect: null }
  const me = state.seats[0]
  const discarded = me.discardHistory.length
  if (pendingFor(state, 0)) {
    if (state.phase === 'claim') {
      if (me.melds.length === 0) return { step: 'pung', expect: { type: 'pung' } }
      if (me.melds.length === 1) return { step: 'chow', expect: { type: 'chow', tiles: TUTORIAL_CHOW } }
      return { step: 'watchWin', expect: { type: 'pass' } }
    }
    if (legalActions(state, 0).some((a) => a.type === 'tsumo')) return { step: 'win', expect: { type: 'tsumo' } }
    if (discarded === 0) return { step: 'discardWind', expect: { type: 'discard', tile: 'w4' } }
    if (discarded === 1) return { step: 'discardAfterPung', expect: { type: 'discard', tile: 'c1' } }
    return { step: 'discardReady', expect: { type: 'discard', tile: 'b1' } }
  }
  const watching: CoachStep[] = ['start', 'watchPung', 'watchChow', 'watchWin']
  return { step: watching[Math.min(discarded, 3)], expect: null }
}

/** Does `a` do what the lesson asks? */
export function matchesCoach(coach: Coach, a: Action): boolean {
  const e = coach.expect
  if (!e || e.type !== a.type) return false
  if (e.type === 'discard' && a.type === 'discard') return e.tile === a.tile
  if (e.type === 'chow' && a.type === 'chow') return e.tiles[0] === a.tiles[0] && e.tiles[1] === a.tiles[1]
  return true
}

/** Plays the practice hand to the end the way the coach asks (for tests and checks). */
export function playTutorial(state: GameState = tutorialMatch(), maxSteps = 400): GameState {
  let s = state
  for (let i = 0; i < maxSteps && s.phase !== 'handOver' && s.phase !== 'matchOver'; i++) {
    if (s.phase === 'draw') {
      s = advance(s)
      continue
    }
    const coach = coachFor(s)
    const next = coach.expect ? applyAction(s, 0, coach.expect) : stepBot(s)
    if (next === s) throw new Error(`mahjong tutorial: stuck at ${coach.step}`)
    s = next
  }
  return s
}

function stepBot(s: GameState): GameState {
  for (const seat of [1, 2, 3]) {
    const a = tutorialBotAction(s, seat)
    if (a) return applyAction(s, seat, a)
  }
  return s
}
