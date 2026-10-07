// src/lib/games/mahjong-engine.ts
/**
 * Pure 4-player Hong Kong (old style) mahjong state machine. No DOM, no React.
 * Bots live in mahjong-bot.ts; hand maths and scoring in mahjong-scoring.ts.
 *
 * Conventions
 *  - Immutable API: every function returns new data; the input state is never
 *    mutated. An illegal `applyAction` returns the SAME state object back.
 *  - Seats 0..3 in turn order (seat+1 plays after seat). Seat 0 is the human.
 *    Seat wind = ((seat - dealer + 4) % 4) + 1 (1=East .. 4=North).
 *  - 144 tiles. Dead wall: 14 tiles kept apart from the live wall. Live draws
 *    `pop()` from `wall`; replacement tiles (flowers, kongs) `pop()` from `dead`
 *    and the far end of the live wall (`wall[0]`) is moved into `dead` to keep
 *    it at 14 while the live wall lasts. The hand is an exhaustive draw when a
 *    player must draw and the live wall is empty. The last live tile is
 *    therefore the "last tile" (win on last tile / last discard +1 faan).
 *    No kong may be declared while the live wall is empty.
 *  - startHand deals 13 tiles each (bonus tiles replaced immediately); the
 *    dealer's 14th tile comes from the first 'draw' step (`advance`).
 *  - Tile conservation: wall + dead + hands + meld tiles + discards + bonus is
 *    always exactly the 144 tiles. Claimed discards are removed from the river
 *    when claimed. A won discard stays in the river (the win tile is recorded
 *    on the result, winner's hand is not modified).
 *  - Randomness: `rng = { seed, counter }`, a counter-based mulberry32 stream,
 *    so saves resume deterministically.
 *
 * Payouts (half-spicy, see PAYOUT_TABLE in mahjong-scoring): `points` is the
 * table value for the final faan (0 faan = 1, 3 = 8, 4 = 16, 5 = 24, 6 = 32,
 * 7 = 48, 8 = 64, 9 = 96, 10 = 128, 11 = 192, 12 = 256, 13 = 384).
 *  - Win on a discard: the discarder alone pays `points`.
 *  - Self-draw: each of the other three pays ceil(points / 2).
 *  The dealer does not pay or receive extra. (Self-drawn already counts +1 faan.)
 */

import { fullSet, type TileCode } from './mahjong-tiles'
import {
  DEFAULT_CAP,
  compareCodes,
  isBonusCode,
  scoreHand,
  tileIndex,
  type Meld,
  type ScoreResult,
} from './mahjong-scoring'

export type { Meld, ScoreResult, ScoreInput, ScoreItem } from './mahjong-scoring'
export {
  PAYOUT_TABLE,
  faanToPoints,
  scoreHand,
  shanten,
  shantenCounts,
  waitingTiles,
  isWinningHand,
  decompositions,
  toCounts,
  tileIndex,
  indexToCode,
} from './mahjong-scoring'

// ---------------------------------------------------------------------------
// Types

export type Phase = 'draw' | 'discard' | 'claim' | 'handOver' | 'matchOver'
export type RoundsMode = 'east' | 'full'

export interface MatchOptions {
  seed: number
  /** Minimum faan to declare a win (0 = casual). Default 3. */
  minFaan: number
  /** Faan cap / limit. Default 10. */
  cap: number
  rounds: RoundsMode
  /** Dealer keeps the deal after an exhaustive draw. Default true. */
  dealerKeepsOnDraw: boolean
}

export interface SeatState {
  /** Concealed tiles, sorted. Includes the just-drawn tile (see GameState.drawn). */
  hand: TileCode[]
  melds: Meld[]
  /** Flowers and seasons, in order revealed. */
  bonus: TileCode[]
  /** The river: this seat's discards still on the table (claimed ones removed). */
  discards: TileCode[]
  /** Everything this seat ever discarded this hand (incl. claimed) - for defence. */
  discardHistory: TileCode[]
  score: number
}

export type ClaimOption =
  | { type: 'ron' }
  | { type: 'pung' }
  | { type: 'kong' }
  /** `tiles` = the two tiles from your hand that complete the chow. */
  | { type: 'chow'; tiles: [TileCode, TileCode] }

export type ClaimDecision = ClaimOption | { type: 'pass' }

export interface ClaimState {
  /** 'discard' = claims on a discard; 'robKong' = only ron against an add-kong. */
  kind: 'discard' | 'robKong'
  tile: TileCode
  /** Discarder / kong declarer. */
  from: number
  /** options[seat] = what that seat may claim (empty = not involved). */
  options: ClaimOption[][]
  /** decisions[seat] = null while that seat still has to decide. */
  decisions: (ClaimDecision | null)[]
}

export type Action =
  | { type: 'discard'; tile: TileCode }
  | { type: 'tsumo' }
  | { type: 'concealedKong'; tile: TileCode }
  | { type: 'addKong'; tile: TileCode }
  | { type: 'chow'; tiles: [TileCode, TileCode] }
  | { type: 'pung' }
  | { type: 'kong' }
  | { type: 'ron' }
  | { type: 'pass' }

export type HandResult =
  | { kind: 'draw'; payments: number[]; dealerRetains: boolean }
  | {
      kind: 'win'
      winner: number
      /** Discarder (or kong declarer when robbing); null for self-draw. */
      from: number | null
      selfDrawn: boolean
      winTile: TileCode
      score: ScoreResult
      /** Score delta per seat (sums to zero). */
      payments: number[]
      dealerRetains: boolean
    }

export interface LastAction {
  seat: number
  type: 'draw' | 'discard' | 'chow' | 'pung' | 'kong' | 'concealedKong' | 'addKong' | 'bonus' | 'tsumo' | 'ron'
  tile?: TileCode
}

export interface GameState {
  version: 1
  opts: MatchOptions
  names: string[]
  rng: { seed: number; counter: number }
  phase: Phase
  /** Prevailing wind 1=East..4=North. */
  prevailing: number
  dealer: number
  /** Times the deal has passed; match ends at 4 (east) or 16 (full). */
  rotations: number
  /** Consecutive dealer retentions this rotation. */
  dealerStreak: number
  /** 1-based hand counter. */
  handNo: number
  seats: SeatState[]
  /** Live wall (draw from the end). */
  wall: TileCode[]
  /** Dead wall (replacement tiles). */
  dead: TileCode[]
  /** Seat to draw / discard (claimer while claiming resolves). */
  turn: number
  /** Tile just drawn by `turn` (also in their hand); null after a chow/pung claim. */
  drawn: TileCode | null
  /** 'kong' when `drawn` is a kong replacement tile. */
  drawnFrom: 'wall' | 'kong' | null
  lastDiscard: { tile: TileCode; from: number } | null
  claim: ClaimState | null
  result: HandResult | null
  lastAction: LastAction | null
}

export const DEFAULT_NAMES = ['You', 'Kai', 'Mei', 'Lin']
const TOTAL_TILES = 144
const DEAD_SIZE = 14
const nextSeat = (s: number) => (s + 1) % 4

// ---------------------------------------------------------------------------
// RNG (counter based, so state is the whole generator)

function rngAt(seed: number, n: number): number {
  let t = ((seed >>> 0) + Math.imul(n + 1, 0x6d2b79f5)) >>> 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Deterministic pseudo-random float in [0,1) derived from the state and a salt. Does not advance the RNG. */
export function peekRandom(state: GameState, salt: number): number {
  const mix = state.wall.length * 977 + state.dead.length * 131 + state.turn * 17 + salt * 7919
  return rngAt(state.rng.seed ^ 0x9e3779b9, state.rng.counter * 1009 + mix)
}

function nextRandom(s: GameState): number {
  return rngAt(s.rng.seed, s.rng.counter++)
}

// ---------------------------------------------------------------------------
// Helpers

function clone(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState
}

export function seatWind(state: Pick<GameState, 'dealer'>, seat: number): number {
  return ((seat - state.dealer + 4) % 4) + 1
}

function sortHand(h: TileCode[]): void {
  h.sort(compareCodes)
}

function removeOne(arr: TileCode[], tile: TileCode): boolean {
  const i = arr.indexOf(tile)
  if (i < 0) return false
  arr.splice(i, 1)
  return true
}

function countOf(arr: readonly TileCode[], tile: TileCode): number {
  let n = 0
  for (const t of arr) if (t === tile) n++
  return n
}

function hasMelds(s: GameState): boolean {
  return s.seats.some((x) => x.melds.length > 0)
}

// ---------------------------------------------------------------------------
// Construction

export interface NewMatchOptions {
  seed: number
  minFaan?: number
  cap?: number
  rounds?: RoundsMode
  names?: string[]
  dealerKeepsOnDraw?: boolean
}

/** Create a match and deal its first hand (phase 'draw', dealer = seat 0 = East). */
export function newMatch(opts: NewMatchOptions): GameState {
  const names = DEFAULT_NAMES.map((d, i) => {
    const n = opts.names?.[i]
    return typeof n === 'string' && n.trim() ? n.trim().slice(0, 24) : d
  })
  const minFaan = clampInt(opts.minFaan ?? 3, 0, 13)
  const state: GameState = {
    version: 1,
    opts: {
      seed: Math.floor(opts.seed) >>> 0,
      minFaan,
      cap: clampInt(opts.cap ?? DEFAULT_CAP, Math.max(minFaan, 1), 13),
      rounds: opts.rounds === 'full' ? 'full' : 'east',
      dealerKeepsOnDraw: opts.dealerKeepsOnDraw ?? true,
    },
    names,
    rng: { seed: Math.floor(opts.seed) >>> 0, counter: 0 },
    phase: 'handOver',
    prevailing: 1,
    dealer: 0,
    rotations: 0,
    dealerStreak: 0,
    handNo: 0,
    seats: [0, 1, 2, 3].map(() => ({ hand: [], melds: [], bonus: [], discards: [], discardHistory: [], score: 0 })),
    wall: [],
    dead: [],
    turn: 0,
    drawn: null,
    drawnFrom: null,
    lastDiscard: null,
    claim: null,
    result: null,
    lastAction: null,
  }
  deal(state)
  return state
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.floor(Number.isFinite(v) ? v : lo)
  return Math.max(lo, Math.min(hi, n))
}

function totalRotations(opts: MatchOptions): number {
  return opts.rounds === 'full' ? 16 : 4
}

/**
 * From phase 'handOver': rotate the deal if the dealer lost, then deal the next
 * hand, or move to 'matchOver' when the match is complete. Any other phase
 * returns the state unchanged.
 */
export function startHand(state: GameState): GameState {
  if (state.phase !== 'handOver' || !state.result) return state
  const s = clone(state)
  if (s.result!.dealerRetains) {
    s.dealerStreak++
  } else {
    s.dealer = nextSeat(s.dealer)
    s.rotations++
    s.dealerStreak = 0
  }
  if (s.rotations >= totalRotations(s.opts)) {
    s.phase = 'matchOver'
    return s
  }
  s.prevailing = Math.min(4, Math.floor(s.rotations / 4) + 1)
  deal(s)
  return s
}

function deal(s: GameState): void {
  const tiles = fullSet(true)
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1))
    ;[tiles[i], tiles[j]] = [tiles[j], tiles[i]]
  }
  s.dead = tiles.splice(0, DEAD_SIZE)
  s.wall = tiles
  for (const seat of s.seats) {
    seat.hand = []
    seat.melds = []
    seat.bonus = []
    seat.discards = []
    seat.discardHistory = []
  }
  for (let round = 0; round < 13; round++) {
    for (let k = 0; k < 4; k++) {
      const seat = (s.dealer + k) % 4
      s.seats[seat].hand.push(s.wall.pop()!)
    }
  }
  for (let k = 0; k < 4; k++) {
    const seat = s.seats[(s.dealer + k) % 4]
    for (;;) {
      const b = seat.hand.findIndex(isBonusCode)
      if (b < 0) break
      seat.bonus.push(seat.hand.splice(b, 1)[0])
      seat.hand.push(takeReplacement(s))
    }
    sortHand(seat.hand)
  }
  s.handNo++
  s.phase = 'draw'
  s.turn = s.dealer
  s.drawn = null
  s.drawnFrom = null
  s.lastDiscard = null
  s.claim = null
  s.result = null
  s.lastAction = null
}

/** Take a replacement tile from the dead wall end, refilling it from the live wall. */
function takeReplacement(s: GameState): TileCode {
  let t = s.dead.pop()
  if (t === undefined) t = s.wall.pop() // unreachable in practice (<= 12 replacements per hand)
  if (t === undefined) throw new Error('mahjong: no tiles left for replacement')
  if (s.wall.length > 0) s.dead.unshift(s.wall.shift()!)
  return t
}

// ---------------------------------------------------------------------------
// Drawing

/** Draw for `turn`, revealing and replacing bonus tiles. Returns false if no tile is available. */
function drawTile(s: GameState, source: 'wall' | 'kong'): boolean {
  const seat = s.seats[s.turn]
  let t: TileCode | undefined
  if (source === 'wall') {
    t = s.wall.pop()
  } else {
    if (s.dead.length === 0 && s.wall.length === 0) return false
    t = takeReplacement(s)
  }
  if (t === undefined) return false
  while (isBonusCode(t)) {
    seat.bonus.push(t)
    s.lastAction = { seat: s.turn, type: 'bonus', tile: t }
    if (s.dead.length === 0 && s.wall.length === 0) return false
    t = takeReplacement(s)
  }
  seat.hand.push(t)
  sortHand(seat.hand)
  s.drawn = t
  s.drawnFrom = source
  s.phase = 'discard'
  s.lastAction = { seat: s.turn, type: 'draw', tile: t }
  return true
}

/**
 * Perform the automatic step for phase 'draw': the turn player draws (bonus
 * tiles are revealed and replaced) and the phase becomes 'discard', or the hand
 * ends in an exhaustive draw. Other phases return the state unchanged.
 */
export function advance(state: GameState): GameState {
  if (state.phase !== 'draw') return state
  const s = clone(state)
  if (s.wall.length === 0 || !drawTile(s, 'wall')) {
    finishDraw(s)
  }
  return s
}

function finishDraw(s: GameState): void {
  s.phase = 'handOver'
  s.claim = null
  s.drawn = null
  s.drawnFrom = null
  s.result = {
    kind: 'draw',
    payments: [0, 0, 0, 0],
    dealerRetains: s.opts.dealerKeepsOnDraw,
  }
}

// ---------------------------------------------------------------------------
// Winning

function winContext(s: GameState, seat: number, tile: TileCode, selfDrawn: boolean, robbing: boolean) {
  const me = s.seats[seat]
  const noMelds = !hasMelds(s)
  const untouched = me.discardHistory.length === 0 && noMelds
  const isDealer = seat === s.dealer
  return {
    lastTile: s.wall.length === 0 && !robbing && (selfDrawn ? s.drawnFrom === 'wall' : true),
    kongReplacement: selfDrawn && s.drawnFrom === 'kong',
    robbingKong: robbing,
    heavenly: isDealer && selfDrawn && untouched && s.drawnFrom === 'wall' && s.seats.every((x) => x.discardHistory.length === 0),
    earthly: !isDealer && untouched && (selfDrawn ? s.drawnFrom === 'wall' : true),
    tile,
  }
}

function scoreFor(
  s: GameState,
  seat: number,
  concealed: TileCode[],
  tile: TileCode,
  selfDrawn: boolean,
  robbing: boolean,
): ScoreResult | null {
  const me = s.seats[seat]
  const ctx = winContext(s, seat, tile, selfDrawn, robbing)
  return scoreHand({
    concealed,
    melds: me.melds,
    bonus: me.bonus,
    winTile: tile,
    selfDrawn,
    seatWind: seatWind(s, seat),
    prevailingWind: s.prevailing,
    lastTile: ctx.lastTile,
    kongReplacement: ctx.kongReplacement,
    robbingKong: ctx.robbingKong,
    heavenly: ctx.heavenly,
    earthly: ctx.earthly,
    cap: s.opts.cap,
  })
}

function sortedWith(hand: readonly TileCode[], tile: TileCode): TileCode[] {
  const h = hand.slice()
  h.push(tile)
  sortHand(h)
  return h
}

function canWinOn(s: GameState, seat: number, tile: TileCode, robbing: boolean): ScoreResult | null {
  const me = s.seats[seat]
  const sc = scoreFor(s, seat, sortedWith(me.hand, tile), tile, false, robbing)
  return sc && sc.faan >= s.opts.minFaan ? sc : null
}

function settleWin(s: GameState, winner: number, from: number | null, tile: TileCode, score: ScoreResult): void {
  const payments = [0, 0, 0, 0]
  if (from === null) {
    const each = Math.ceil(score.points / 2)
    for (let i = 0; i < 4; i++) if (i !== winner) payments[i] = -each
    payments[winner] = each * 3
  } else {
    payments[from] = -score.points
    payments[winner] = score.points
  }
  for (let i = 0; i < 4; i++) s.seats[i].score += payments[i]
  s.phase = 'handOver'
  s.claim = null
  s.result = {
    kind: 'win',
    winner,
    from,
    selfDrawn: from === null,
    winTile: tile,
    score,
    payments,
    dealerRetains: winner === s.dealer,
  }
}

// ---------------------------------------------------------------------------
// Legal actions

function chowOptions(hand: readonly TileCode[], tile: TileCode): [TileCode, TileCode][] {
  const i = tileIndex(tile)
  if (i < 0 || i >= 27) return []
  const r = i % 9
  const base = i - r
  const has = (rank: number) => rank >= 0 && rank <= 8 && hand.includes(indexToCodeLocal(base + rank))
  const out: [TileCode, TileCode][] = []
  const pairs: [number, number][] = [
    [r - 2, r - 1],
    [r - 1, r + 1],
    [r + 1, r + 2],
  ]
  for (const [a, b] of pairs) if (has(a) && has(b)) out.push([indexToCodeLocal(base + a), indexToCodeLocal(base + b)])
  return out
}

function indexToCodeLocal(i: number): TileCode {
  return `${'dbc'[Math.floor(i / 9)]}${(i % 9) + 1}`
}

function computeClaimOptions(s: GameState, from: number, tile: TileCode, kind: 'discard' | 'robKong'): ClaimOption[][] {
  const out: ClaimOption[][] = [[], [], [], []]
  for (let seat = 0; seat < 4; seat++) {
    if (seat === from) continue
    const me = s.seats[seat]
    const opts = out[seat]
    if (canWinOn(s, seat, tile, kind === 'robKong')) opts.push({ type: 'ron' })
    if (kind === 'discard') {
      const n = countOf(me.hand, tile)
      if (n >= 2) opts.push({ type: 'pung' })
      if (n >= 3 && s.wall.length > 0) opts.push({ type: 'kong' })
      if (seat === nextSeat(from)) for (const t of chowOptions(me.hand, tile)) opts.push({ type: 'chow', tiles: t })
    }
  }
  return out
}

function sameAction(a: ClaimDecision | Action, b: ClaimDecision | Action): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'chow' && b.type === 'chow') return a.tiles[0] === b.tiles[0] && a.tiles[1] === b.tiles[1]
  if ('tile' in a && 'tile' in b) return a.tile === b.tile
  return true
}

/** Seats that still have to act (human or bot) in the current phase. */
export function pendingSeats(state: GameState): number[] {
  if (state.phase === 'discard') return [state.turn]
  if (state.phase === 'claim' && state.claim) {
    const out: number[] = []
    for (let i = 0; i < 4; i++) if (state.claim.decisions[i] === null) out.push(i)
    return out
  }
  return []
}

/** Does `seat` have a decision to make right now? */
export function pendingFor(state: GameState, seat: number): boolean {
  return pendingSeats(state).includes(seat)
}

/** Convenience for the UI: is the human (default seat 0) being waited on? */
export function isHumanTurn(state: GameState, humanSeat = 0): boolean {
  return pendingFor(state, humanSeat)
}

/** All actions `seat` may take right now ([] when not pending). */
export function legalActions(state: GameState, seat: number): Action[] {
  if (!pendingFor(state, seat)) return []
  if (state.phase === 'claim') {
    const opts = state.claim!.options[seat]
    return [...opts.map((o) => ({ ...o }) as Action), { type: 'pass' }]
  }
  // discard phase
  const me = state.seats[seat]
  const out: Action[] = []
  const seen = new Set<TileCode>()
  if (state.drawn !== null) {
    const sc = scoreFor(state, seat, me.hand, state.drawn, true, false)
    if (sc && sc.faan >= state.opts.minFaan) out.push({ type: 'tsumo' })
  }
  if (state.wall.length > 0) {
    for (const t of me.hand) {
      if (seen.has(t)) continue
      seen.add(t)
      if (countOf(me.hand, t) === 4) out.push({ type: 'concealedKong', tile: t })
      else if (me.melds.some((m) => m.kind === 'pung' && m.tiles[0] === t)) out.push({ type: 'addKong', tile: t })
    }
  }
  seen.clear()
  for (const t of me.hand) {
    if (seen.has(t)) continue
    seen.add(t)
    out.push({ type: 'discard', tile: t })
  }
  return out
}

// ---------------------------------------------------------------------------
// Applying actions

/**
 * Apply one decision. Illegal / out-of-turn actions return `state` unchanged
 * (same reference). During 'claim' the decision is recorded and, once every
 * involved seat has decided, the claim resolves in the same call (see
 * resolveClaims). Phase 'draw' still needs `advance`.
 */
export function applyAction(state: GameState, seat: number, action: Action): GameState {
  if (!legalActions(state, seat).some((a) => sameAction(a, action))) return state
  const s = clone(state)
  if (s.phase === 'claim') {
    s.claim!.decisions[seat] = action as ClaimDecision
    return s.claim!.decisions.every((d) => d !== null) ? resolveClaims(s) : s
  }
  const me = s.seats[seat]
  switch (action.type) {
    case 'discard':
      doDiscard(s, seat, action.tile)
      break
    case 'tsumo': {
      const sc = scoreFor(s, seat, me.hand, s.drawn!, true, false)!
      s.lastAction = { seat, type: 'tsumo', tile: s.drawn! }
      settleWin(s, seat, null, s.drawn!, sc)
      break
    }
    case 'concealedKong': {
      for (let i = 0; i < 4; i++) removeOne(me.hand, action.tile)
      me.melds.push({ kind: 'kong', tiles: [action.tile, action.tile, action.tile, action.tile], concealed: true })
      s.lastAction = { seat, type: 'concealedKong', tile: action.tile }
      kongReplacement(s)
      break
    }
    case 'addKong': {
      const options = computeClaimOptions(s, seat, action.tile, 'robKong')
      if (options.some((o) => o.length > 0)) {
        s.phase = 'claim'
        s.claim = {
          kind: 'robKong',
          tile: action.tile,
          from: seat,
          options,
          decisions: options.map((o) => (o.length ? null : { type: 'pass' })) as (ClaimDecision | null)[],
        }
      } else {
        completeAddKong(s, seat, action.tile)
      }
      break
    }
    default:
      return state
  }
  return s
}

function doDiscard(s: GameState, seat: number, tile: TileCode): void {
  const me = s.seats[seat]
  removeOne(me.hand, tile)
  me.discards.push(tile)
  me.discardHistory.push(tile)
  s.lastDiscard = { tile, from: seat }
  s.drawn = null
  s.drawnFrom = null
  s.lastAction = { seat, type: 'discard', tile }
  const options = computeClaimOptions(s, seat, tile, 'discard')
  if (options.some((o) => o.length > 0)) {
    s.phase = 'claim'
    s.claim = {
      kind: 'discard',
      tile,
      from: seat,
      options,
      decisions: options.map((o) => (o.length ? null : { type: 'pass' })) as (ClaimDecision | null)[],
    }
  } else {
    passTurn(s)
  }
}

function passTurn(s: GameState): void {
  s.turn = nextSeat(s.lastDiscard ? s.lastDiscard.from : s.turn)
  s.phase = 'draw'
  s.claim = null
}

function kongReplacement(s: GameState): void {
  if (!drawTile(s, 'kong')) finishDraw(s)
}

function completeAddKong(s: GameState, seat: number, tile: TileCode): void {
  const me = s.seats[seat]
  removeOne(me.hand, tile)
  const meld = me.melds.find((m) => m.kind === 'pung' && m.tiles[0] === tile)!
  meld.kind = 'kong'
  meld.tiles = [tile, tile, tile, tile]
  s.turn = seat
  s.claim = null
  s.lastAction = { seat, type: 'addKong', tile }
  kongReplacement(s)
}

const claimRank = (d: ClaimDecision | null): number =>
  !d ? 0 : d.type === 'ron' ? 3 : d.type === 'pung' || d.type === 'kong' ? 2 : d.type === 'chow' ? 1 : 0

/**
 * Resolve a fully decided claim round. Priority: ron > pung/kong > chow > all
 * pass. Among equal priorities the seat nearest after the discarder wins (head
 * bump: only one ron is honoured). Called automatically by applyAction; exported
 * for tests/tools. State is not changed unless every decision is in.
 */
export function resolveClaims(state: GameState): GameState {
  if (state.phase !== 'claim' || !state.claim || state.claim.decisions.some((d) => d === null)) return state
  const s = clone(state)
  const c = s.claim!
  let winner = -1
  let bestRank = 0
  for (let k = 1; k <= 3; k++) {
    const seat = (c.from + k) % 4
    const r = claimRank(c.decisions[seat])
    if (r > bestRank) {
      bestRank = r
      winner = seat
    }
  }
  if (winner < 0) {
    if (c.kind === 'robKong') completeAddKong(s, c.from, c.tile)
    else passTurn(s)
    return s
  }
  const d = c.decisions[winner]!
  const me = s.seats[winner]
  if (d.type === 'ron') {
    const sc = scoreFor(s, winner, sortedWith(me.hand, c.tile), c.tile, false, c.kind === 'robKong')!
    s.lastAction = { seat: winner, type: 'ron', tile: c.tile }
    settleWin(s, winner, c.from, c.tile, sc)
    return s
  }
  // Pung / kong / chow of a discard
  const river = s.seats[c.from].discards
  river.pop() // the claimed tile is always the last discard
  s.lastDiscard = null
  s.turn = winner
  s.claim = null
  s.drawn = null
  s.drawnFrom = null
  if (d.type === 'pung') {
    removeOne(me.hand, c.tile)
    removeOne(me.hand, c.tile)
    me.melds.push({ kind: 'pung', tiles: [c.tile, c.tile, c.tile], from: c.from, claimed: c.tile })
    s.lastAction = { seat: winner, type: 'pung', tile: c.tile }
    s.phase = 'discard'
  } else if (d.type === 'kong') {
    for (let i = 0; i < 3; i++) removeOne(me.hand, c.tile)
    me.melds.push({ kind: 'kong', tiles: [c.tile, c.tile, c.tile, c.tile], from: c.from, claimed: c.tile })
    s.lastAction = { seat: winner, type: 'kong', tile: c.tile }
    kongReplacement(s)
  } else if (d.type === 'chow') {
    removeOne(me.hand, d.tiles[0])
    removeOne(me.hand, d.tiles[1])
    const tiles = [d.tiles[0], d.tiles[1], c.tile]
    tiles.sort(compareCodes)
    me.melds.push({ kind: 'chow', tiles, from: c.from, claimed: c.tile })
    s.lastAction = { seat: winner, type: 'chow', tile: c.tile }
    s.phase = 'discard'
  }
  return s
}

// ---------------------------------------------------------------------------
// Save validation (input is hostile)

const TILE_RE = /^(?:[dbc][1-9]|w[1-4]|r[1-3]|[fs][1-4])$/
const isTile = (v: unknown): v is TileCode => typeof v === 'string' && TILE_RE.test(v)
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
const isSeat = (v: unknown): v is number => isInt(v, 0, 3)
const tileList = (v: unknown, max: number): v is TileCode[] => Array.isArray(v) && v.length <= max && v.every(isTile)

function validMeld(m: unknown): Meld | null {
  if (!isObj(m)) return null
  const kind = m.kind
  if (kind !== 'chow' && kind !== 'pung' && kind !== 'kong') return null
  if (!tileList(m.tiles, 4)) return null
  const tiles = m.tiles
  if (tiles.length !== (kind === 'kong' ? 4 : 3)) return null
  if (tiles.some(isBonusCode)) return null
  if (kind === 'chow') {
    const idx = tiles.map(tileIndex)
    if (idx.some((i) => i < 0 || i >= 27)) return null
    if (idx[1] !== idx[0] + 1 || idx[2] !== idx[0] + 2 || Math.floor(idx[0] / 9) !== Math.floor(idx[2] / 9)) return null
  } else if (!tiles.every((t) => t === tiles[0])) return null
  if (m.concealed !== undefined && (m.concealed !== true || kind !== 'kong')) return null
  if (m.from !== undefined && !isSeat(m.from)) return null
  if (m.claimed !== undefined && (!isTile(m.claimed) || !tiles.includes(m.claimed))) return null
  const out: Meld = { kind, tiles: tiles.slice() }
  if (m.concealed === true) out.concealed = true
  if (m.from !== undefined) out.from = m.from as number
  if (m.claimed !== undefined) out.claimed = m.claimed as TileCode
  return out
}

function validScore(v: unknown): ScoreResult | null {
  if (!isObj(v)) return null
  if (!isInt(v.faan, 0, 13) || !isInt(v.rawFaan, 0, 1000) || typeof v.limit !== 'boolean') return null
  if (!isInt(v.points, 1, 1000)) return null
  if (v.pattern !== 'standard' && v.pattern !== 'sevenPairs' && v.pattern !== 'thirteenOrphans') return null
  if (!Array.isArray(v.breakdown) || v.breakdown.length > 40) return null
  const breakdown = []
  for (const b of v.breakdown) {
    if (!isObj(b) || typeof b.name !== 'string' || b.name.length > 60 || !isInt(b.faan, 0, 100)) return null
    breakdown.push({ name: b.name, faan: b.faan })
  }
  return { faan: v.faan, rawFaan: v.rawFaan, limit: v.limit, breakdown, points: v.points, pattern: v.pattern }
}

function validPayments(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== 4 || !v.every((n) => isInt(n, -100000, 100000))) return null
  return v.slice() as number[]
}

function validResult(v: unknown): HandResult | null {
  if (!isObj(v) || typeof v.dealerRetains !== 'boolean') return null
  const payments = validPayments(v.payments)
  if (!payments) return null
  if (v.kind === 'draw') return { kind: 'draw', payments, dealerRetains: v.dealerRetains }
  if (v.kind !== 'win') return null
  const score = validScore(v.score)
  if (!score || !isSeat(v.winner) || !isTile(v.winTile) || typeof v.selfDrawn !== 'boolean') return null
  if (!(v.from === null || isSeat(v.from))) return null
  if (v.selfDrawn !== (v.from === null)) return null
  return {
    kind: 'win',
    winner: v.winner,
    from: v.from as number | null,
    selfDrawn: v.selfDrawn,
    winTile: v.winTile,
    score,
    payments,
    dealerRetains: v.dealerRetains,
  }
}

const ACTION_TYPES = ['draw', 'discard', 'chow', 'pung', 'kong', 'concealedKong', 'addKong', 'bonus', 'tsumo', 'ron']

/**
 * Strictly validate an untrusted value (e.g. parsed localStorage) and return a
 * rebuilt GameState, or null. Checks structure, ranges, that all 144 tiles are
 * accounted for exactly once, hand sizes for the phase, and recomputes claim
 * options so a forged save cannot grant illegal claims. Never throws.
 */
export function validateSave(input: unknown): GameState | null {
  try {
    return validateSaveInner(input)
  } catch {
    return null
  }
}

function validateSaveInner(v: unknown): GameState | null {
  if (!isObj(v) || v.version !== 1) return null
  const o = v.opts
  if (!isObj(o) || !isInt(o.seed, 0, 4294967295) || !isInt(o.minFaan, 0, 13) || !isInt(o.cap, 1, 13)) return null
  if (o.rounds !== 'east' && o.rounds !== 'full') return null
  if (typeof o.dealerKeepsOnDraw !== 'boolean' || o.cap < o.minFaan) return null
  const opts: MatchOptions = {
    seed: o.seed,
    minFaan: o.minFaan,
    cap: o.cap,
    rounds: o.rounds,
    dealerKeepsOnDraw: o.dealerKeepsOnDraw,
  }
  if (!Array.isArray(v.names) || v.names.length !== 4 || !v.names.every((n) => typeof n === 'string' && n.length <= 24)) return null
  const names = v.names.slice() as string[]
  const rng = v.rng
  if (!isObj(rng) || !isInt(rng.seed, 0, 4294967295) || !isInt(rng.counter, 0, 1e9)) return null
  const phases: Phase[] = ['draw', 'discard', 'claim', 'handOver', 'matchOver']
  if (typeof v.phase !== 'string' || !phases.includes(v.phase as Phase)) return null
  const phase = v.phase as Phase
  if (!isInt(v.prevailing, 1, 4) || !isSeat(v.dealer) || !isInt(v.rotations, 0, 16)) return null
  if (!isInt(v.dealerStreak, 0, 10000) || !isInt(v.handNo, 1, 100000) || !isSeat(v.turn)) return null
  if (!Array.isArray(v.seats) || v.seats.length !== 4) return null
  const seats: SeatState[] = []
  for (const raw of v.seats) {
    if (!isObj(raw)) return null
    if (!tileList(raw.hand, 14) || !tileList(raw.bonus, 8) || !tileList(raw.discards, 144) || !tileList(raw.discardHistory, 144))
      return null
    if (!isInt(raw.score, -10000000, 10000000)) return null
    if (raw.hand.some(isBonusCode) || raw.discards.some(isBonusCode) || raw.discardHistory.some(isBonusCode)) return null
    if (!raw.bonus.every(isBonusCode)) return null
    if (!Array.isArray(raw.melds) || raw.melds.length > 4) return null
    const melds: Meld[] = []
    for (const m of raw.melds) {
      const mm = validMeld(m)
      if (!mm) return null
      melds.push(mm)
    }
    seats.push({
      hand: raw.hand.slice(),
      melds,
      bonus: raw.bonus.slice(),
      discards: raw.discards.slice(),
      discardHistory: raw.discardHistory.slice(),
      score: raw.score,
    })
  }
  if (!tileList(v.wall, 144) || !tileList(v.dead, DEAD_SIZE)) return null
  const wall = v.wall.slice()
  const dead = v.dead.slice()
  // Tile conservation: exactly the 144-tile set.
  const tally = new Map<TileCode, number>()
  const add = (t: TileCode) => tally.set(t, (tally.get(t) ?? 0) + 1)
  wall.forEach(add)
  dead.forEach(add)
  for (const st of seats) {
    st.hand.forEach(add)
    st.bonus.forEach(add)
    st.discards.forEach(add)
    for (const m of st.melds) m.tiles.forEach(add)
  }
  const expected = new Map<TileCode, number>()
  for (const t of fullSet(true)) expected.set(t, (expected.get(t) ?? 0) + 1)
  let total = 0
  for (const n of tally.values()) total += n
  if (total !== TOTAL_TILES || tally.size !== expected.size) return null
  for (const [t, n] of expected) if (tally.get(t) !== n) return null
  // Discard history must contain the river.
  for (const st of seats) {
    const rest = st.discardHistory.slice()
    for (const t of st.discards) if (!removeOne(rest, t)) return null
  }
  // Optional bits
  let drawn: TileCode | null = null
  if (v.drawn !== null) {
    if (!isTile(v.drawn)) return null
    drawn = v.drawn
  }
  if (!(v.drawnFrom === null || v.drawnFrom === 'wall' || v.drawnFrom === 'kong')) return null
  if ((drawn === null) !== (v.drawnFrom === null)) return null
  let lastDiscard: GameState['lastDiscard'] = null
  if (v.lastDiscard !== null) {
    const ld = v.lastDiscard
    if (!isObj(ld) || !isTile(ld.tile) || !isSeat(ld.from)) return null
    lastDiscard = { tile: ld.tile, from: ld.from }
    const river = seats[ld.from].discards
    if (river[river.length - 1] !== ld.tile) return null
  }
  let lastAction: LastAction | null = null
  if (v.lastAction !== null) {
    const la = v.lastAction
    if (!isObj(la) || !isSeat(la.seat) || typeof la.type !== 'string' || !ACTION_TYPES.includes(la.type)) return null
    if (la.tile !== undefined && !isTile(la.tile)) return null
    lastAction = { seat: la.seat, type: la.type as LastAction['type'] }
    if (la.tile !== undefined) lastAction.tile = la.tile as TileCode
  }
  let result: HandResult | null = null
  if (v.result !== null) {
    result = validResult(v.result)
    if (!result) return null
  }
  // Hand sizes (concealed tiles + 3 per meld).
  const equiv = (i: number) => seats[i].hand.length + 3 * seats[i].melds.length
  const playing = phase === 'draw' || phase === 'discard' || phase === 'claim'
  if (playing) {
    if (result !== null) return null
    for (let i = 0; i < 4; i++) {
      const want = (phase === 'discard' && i === v.turn) || (phase === 'claim' && i === (v.claim as { from?: number } | null)?.from && (v.claim as { kind?: string }).kind === 'robKong') ? 14 : 13
      if (equiv(i) !== want) return null
    }
    if (phase === 'discard') {
      if (drawn !== null && !seats[v.turn as number].hand.includes(drawn)) return null
    } else if (drawn !== null && !(phase === 'claim' && (v.claim as { kind?: string } | null)?.kind === 'robKong')) return null
  } else {
    if (result === null) return null
  }
  if (phase === 'matchOver' && v.claim !== null) return null
  const state: GameState = {
    version: 1,
    opts,
    names,
    rng: { seed: rng.seed, counter: rng.counter },
    phase,
    prevailing: v.prevailing,
    dealer: v.dealer,
    rotations: v.rotations,
    dealerStreak: v.dealerStreak,
    handNo: v.handNo,
    seats,
    wall,
    dead,
    turn: v.turn,
    drawn,
    drawnFrom: v.drawnFrom as GameState['drawnFrom'],
    lastDiscard,
    claim: null,
    result,
    lastAction,
  }
  if (phase === 'claim') {
    const c = v.claim
    if (!isObj(c) || (c.kind !== 'discard' && c.kind !== 'robKong') || !isTile(c.tile) || !isSeat(c.from)) return null
    if (c.kind === 'discard') {
      if (!lastDiscard || lastDiscard.tile !== c.tile || lastDiscard.from !== c.from) return null
    } else if (!seats[c.from].hand.includes(c.tile) || !seats[c.from].melds.some((m) => m.kind === 'pung' && m.tiles[0] === c.tile))
      return null
    if (state.wall.length === 0 && c.kind === 'robKong') return null
    const options = computeClaimOptions(state, c.from, c.tile, c.kind)
    if (!options.some((x) => x.length > 0)) return null
    if (JSON.stringify(c.options) !== JSON.stringify(options)) return null
    if (!Array.isArray(c.decisions) || c.decisions.length !== 4) return null
    const decisions: (ClaimDecision | null)[] = []
    for (let i = 0; i < 4; i++) {
      const d = c.decisions[i]
      if (d === null) {
        if (options[i].length === 0) return null
        decisions.push(null)
        continue
      }
      if (!isObj(d) || typeof d.type !== 'string') return null
      const dec = (d.type === 'chow' ? { type: 'chow', tiles: d.tiles } : { type: d.type }) as ClaimDecision
      const ok = d.type === 'pass' || options[i].some((x) => sameAction(x, dec))
      if (!ok) return null
      decisions.push(dec)
    }
    state.claim = {
      kind: c.kind,
      tile: c.tile,
      from: c.from,
      options,
      decisions: decisions.map((d, i) => (options[i].length === 0 ? { type: 'pass' } : d)) as (ClaimDecision | null)[],
    }
    if (state.claim.decisions.every((d) => d !== null)) return null // would already have resolved
  } else if (v.claim !== null) return null
  return state
}

/** Count tiles for diagnostics/tests: every tile in the game, by location. */
export function allTiles(state: GameState): TileCode[] {
  const out: TileCode[] = [...state.wall, ...state.dead]
  for (const s of state.seats) {
    out.push(...s.hand, ...s.bonus, ...s.discards)
    for (const m of s.melds) out.push(...m.tiles)
  }
  return out
}
