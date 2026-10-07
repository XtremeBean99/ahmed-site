// src/lib/games/mahjong-bot.ts
/**
 * CPU players for the 4-player mahjong engine. Pure and deterministic given the
 * state: no Math.random, no clock, no hidden information (a bot only reads its
 * own hand plus what is face up: melds, rivers, discard histories, bonus tiles).
 * `easy` variety comes from a read-only hash of the state (`peekRandom`).
 */

import {
  advance,
  applyAction,
  legalActions,
  pendingSeats,
  peekRandom,
  seatWind,
  type Action,
  type GameState,
  type Meld,
} from './mahjong-engine'
import {
  indexToCode,
  scoreHand,
  shantenCounts,
  tileIndex,
  toCounts,
  waitingTiles,
} from './mahjong-scoring'
import type { TileCode } from './mahjong-tiles'

export type BotLevel = 'easy' | 'normal' | 'hard'

// ---------------------------------------------------------------------------
// Public information

/** Tiles of each kind that this seat can see (own hand, all melds but others' concealed kongs, all rivers). */
function visibleCounts(state: GameState, seat: number): number[] {
  const v = toCounts(state.seats[seat].hand)
  state.seats.forEach((st, i) => {
    for (const m of st.melds) {
      if (m.concealed && i !== seat) continue
      for (const t of m.tiles) {
        const k = tileIndex(t)
        if (k >= 0) v[k]++
      }
    }
    for (const t of st.discards) {
      const k = tileIndex(t)
      if (k >= 0) v[k]++
    }
  })
  return v
}

function exposedMelds(melds: readonly Meld[]): number {
  return melds.filter((m) => !m.concealed).length
}

/** Number-suit (0..2) an opponent seems to be collecting, or -1. */
function flushSuspect(state: GameState, seat: number): number {
  const st = state.seats[seat]
  const hist = st.discardHistory
  const suitCount = [0, 0, 0]
  for (const t of hist) {
    const k = tileIndex(t)
    if (k >= 0 && k < 27) suitCount[Math.floor(k / 9)]++
  }
  const meldSuits = new Set<number>()
  for (const m of st.melds) {
    const k = tileIndex(m.tiles[0])
    if (k >= 0 && k < 27) meldSuits.add(Math.floor(k / 9))
  }
  if (meldSuits.size > 1) return -1
  const candidates: number[] = []
  for (let s = 0; s < 3; s++) {
    const others = suitCount[(s + 1) % 3] + suitCount[(s + 2) % 3]
    if (meldSuits.size === 1 && !meldSuits.has(s)) continue
    if (suitCount[s] === 0 && (others >= 5 || (meldSuits.size === 1 && hist.length >= 3))) candidates.push(s)
  }
  return candidates.length === 1 ? candidates[0] : -1
}

interface Threat {
  seat: number
  flush: number
}

function threats(state: GameState, seat: number): Threat[] {
  const out: Threat[] = []
  for (let i = 0; i < 4; i++) {
    if (i === seat) continue
    const st = state.seats[i]
    const fl = flushSuspect(state, i)
    if (exposedMelds(st.melds) >= 3 || fl >= 0) out.push({ seat: i, flush: fl })
  }
  return out
}

/** Rough danger of discarding tile index k against the given threats (0 = safe). */
function danger(state: GameState, k: number, th: Threat[], vis: number[]): number {
  const code = indexToCode(k)
  let d = 0
  for (const t of th) {
    if (state.seats[t.seat].discardHistory.includes(code)) continue
    if (k >= 27) {
      d += vis[k] >= 3 ? 0.3 : t.flush >= 0 ? 2.5 : 1.5
    } else {
      const r = k % 9
      const base = r === 0 || r === 8 ? 1.2 : r === 1 || r === 7 ? 1.8 : 2.5
      d += t.flush >= 0 ? (Math.floor(k / 9) === t.flush ? 3.2 : 0.3) : base
    }
  }
  return d
}

// ---------------------------------------------------------------------------
// Hand value estimate

/** Rough faan potential: value pungs, flush lean, all-pungs lean, matching flowers. */
function estimateFaan(state: GameState, seat: number, hand: readonly TileCode[], melds: readonly Meld[]): number {
  const st = state.seats[seat]
  const c = toCounts(hand)
  for (const m of melds) for (const t of m.tiles) c[tileIndex(t)]++
  const sw = seatWind(state, seat)
  let f = 0
  const valueKinds = [31, 32, 33, 26 + sw, 26 + state.prevailing]
  const seen = new Set<number>()
  for (const k of valueKinds) {
    if (c[k] >= 3) f += 1 * (k === 26 + sw && k === 26 + state.prevailing ? 2 : 1)
    seen.add(k)
  }
  const suits = [0, 0, 0]
  let honors = 0
  for (let k = 0; k < 34; k++) {
    if (k < 27) suits[Math.floor(k / 9)] += c[k]
    else honors += c[k]
  }
  const used = suits.filter((n) => n > 0).length
  if (used === 1) f += honors > 0 ? 3 : 6
  let trips = melds.filter((m) => m.kind !== 'chow').length
  let pairs = 0
  for (let k = 0; k < 34; k++) {
    const inMeld = melds.some((m) => m.kind !== 'chow' && tileIndex(m.tiles[0]) === k)
    if (inMeld) continue
    const n = hand.filter((t) => tileIndex(t) === k).length
    if (n >= 3) trips++
    else if (n === 2) pairs++
  }
  if (melds.every((m) => m.kind !== 'chow') && trips + pairs >= 4 && trips >= 2) f += 3
  for (const b of st.bonus) if (b.charCodeAt(1) - 48 === sw) f += 1
  if (st.bonus.length === 0) f += 1
  return f
}

// ---------------------------------------------------------------------------
// Discard choice

function dominantSuit(c: readonly number[]): number {
  const suits = [0, 0, 0]
  for (let k = 0; k < 27; k++) suits[Math.floor(k / 9)] += c[k]
  let best = 0
  for (let s = 1; s < 3; s++) if (suits[s] > suits[best]) best = s
  return suits[best] >= 9 ? best : -1
}

function chooseDiscard(state: GameState, seat: number, level: BotLevel): TileCode {
  const me = state.seats[seat]
  const meldCount = me.melds.length
  const c = toCounts(me.hand)
  const vis = visibleCounts(state, seat)
  const sw = seatWind(state, seat)
  const kinds: number[] = []
  for (let k = 0; k < 34; k++) if (c[k] > 0) kinds.push(k)

  const isValue = (k: number) => k >= 31 || k === 26 + sw || k === 26 + state.prevailing
  const flushSuit = dominantSuit(c)

  // Easy: discard the loosest tile with some noise.
  if (level === 'easy') {
    const scored = kinds.map((k) => {
      const n = c[k]
      let keep = 0
      if (n >= 2) keep += 6 * n
      if (k < 27) {
        const r = k % 9
        if (r > 0 && c[k - 1] > 0) keep += 3
        if (r < 8 && c[k + 1] > 0) keep += 3
        if (r > 1 && c[k - 2] > 0) keep += 1.5
        if (r < 7 && c[k + 2] > 0) keep += 1.5
        if (r === 0 || r === 8) keep -= 1
      } else if (isValue(k) && n >= 2) keep += 8
      keep += peekRandom(state, k + 31) * 5
      return { k, keep }
    })
    scored.sort((a, b) => a.keep - b.keep || a.k - b.k)
    return indexToCode(scored[0].k)
  }

  // Normal / hard: minimise shanten, then maximise acceptance.
  const shAfter = new Map<number, number>()
  let bestSh = 99
  for (const k of kinds) {
    c[k]--
    const sh = shantenCounts(c, meldCount)
    c[k]++
    shAfter.set(k, sh)
    if (sh < bestSh) bestSh = sh
  }

  const th = level === 'hard' ? threats(state, seat) : []
  const fold = th.length > 0 && bestSh >= 2

  let best = kinds[0]
  let bestScore = -Infinity
  for (const k of kinds) {
    const sh = shAfter.get(k)!
    const dg = th.length ? danger(state, k, th, vis) : 0
    if (!fold && sh > bestSh) continue
    c[k]--
    let accept = 0
    if (!fold) {
      if (sh === 0) {
        // Tenpai: weight waits by whether they can actually win at the minimum faan.
        const rest: TileCode[] = []
        for (let j = 0; j < 34; j++) for (let n = 0; n < c[j]; n++) rest.push(indexToCode(j))
        for (const w of waitingTiles(rest, meldCount)) {
          const wk = tileIndex(w)
          const left = Math.max(0, 4 - vis[wk])
          if (left === 0) continue
          accept += left * waitWeight(state, seat, rest, w)
        }
      } else {
        // Ukeire: tiles near ours that lower shanten.
        for (let j = 0; j < 34; j++) {
          if (!near(c, j)) continue
          if (vis[j] >= 4 || c[j] >= 4) continue
          c[j]++
          if (shantenCounts(c, meldCount) < sh) accept += Math.max(0, 4 - vis[j])
          c[j]--
        }
      }
    }
    c[k]++
    let keep = 0
    if (isValue(k)) keep += c[k] >= 2 ? 250 : 30
    if (flushSuit >= 0) {
      if (k >= 27) keep += 5
      else keep += Math.floor(k / 9) === flushSuit ? 120 : -80
    }
    // Loose tiles first: honours, then terminals.
    if (k >= 27 && !isValue(k)) keep -= 15
    else if (k < 27 && (k % 9 === 0 || k % 9 === 8)) keep -= 5
    let score: number
    if (fold) score = -dg * 1000 - keep * 0.1 - sh * 10
    else score = accept * 100 - keep - (level === 'hard' ? dg * (bestSh === 0 ? 40 : 90) : 0)
    if (score > bestScore) {
      bestScore = score
      best = k
    }
  }
  return indexToCode(best)
}

function near(c: readonly number[], j: number): boolean {
  if (c[j] > 0) return true
  if (j >= 27) return false
  const r = j % 9
  return (
    (r > 0 && c[j - 1] > 0) || (r < 8 && c[j + 1] > 0) || (r > 1 && c[j - 2] > 0) || (r < 7 && c[j + 2] > 0)
  )
}

/** 1 if the wait wins on a discard at the minimum faan, 0.5 if only on self-draw, else 0.1. */
function waitWeight(state: GameState, seat: number, rest: TileCode[], w: TileCode): number {
  const me = state.seats[seat]
  const concealed = [...rest, w]
  const base = {
    concealed,
    melds: me.melds,
    bonus: me.bonus,
    winTile: w,
    seatWind: seatWind(state, seat),
    prevailingWind: state.prevailing,
    cap: state.opts.cap,
  }
  const ron = scoreHand({ ...base, selfDrawn: false })
  if (ron && ron.faan >= state.opts.minFaan) return 1
  const tsumo = scoreHand({ ...base, selfDrawn: true })
  if (tsumo && tsumo.faan >= state.opts.minFaan) return 0.5
  return 0.1
}

// ---------------------------------------------------------------------------
// Claims

function decideClaim(state: GameState, seat: number, level: BotLevel, legal: Action[]): Action {
  const pass: Action = { type: 'pass' }
  const ron = legal.find((a) => a.type === 'ron')
  if (ron) return ron
  const me = state.seats[seat]
  const tile = state.claim!.tile
  const k = tileIndex(tile)
  const sw = seatWind(state, seat)
  const valueTile = k >= 31 || k === 26 + sw || k === 26 + state.prevailing
  const meldCount = me.melds.length
  const before = shantenCounts(toCounts(me.hand), meldCount)
  const th = level === 'hard' ? threats(state, seat) : []

  const without = (tiles: TileCode[]) => {
    const h = me.hand.slice()
    for (const t of tiles) h.splice(h.indexOf(t), 1)
    return h
  }
  const pathOk = (hand: TileCode[], meld: Meld) =>
    state.opts.minFaan <= 1 || estimateFaan(state, seat, hand, [...me.melds, meld]) >= state.opts.minFaan - 1

  const pungOpt = legal.find((a) => a.type === 'pung')
  const kongOpt = legal.find((a) => a.type === 'kong')
  if (pungOpt || kongOpt) {
    const hand = without([tile, tile])
    const meld: Meld = { kind: 'pung', tiles: [tile, tile, tile] }
    const after = shantenCounts(toCounts(hand), meldCount + 1)
    if (level === 'easy') {
      if ((valueTile || after < before) && peekRandom(state, 5 + seat) < 0.6) return pungOpt ?? pass
      return pass
    }
    if (th.length > 0 && after > 0 && !valueTile) return pass
    const improves = after < before || (valueTile && after <= before)
    if (improves && pathOk(hand, meld)) {
      if (kongOpt && valueTile && after <= before) return kongOpt
      return pungOpt ?? pass
    }
  }

  let bestChow: Action | null = null
  let bestAfter = before
  for (const a of legal) {
    if (a.type !== 'chow') continue
    const hand = without(a.tiles)
    const meld: Meld = { kind: 'chow', tiles: [...a.tiles, tile] }
    const after = shantenCounts(toCounts(hand), meldCount + 1)
    if (after >= bestAfter) continue
    if (level === 'easy') {
      if (peekRandom(state, 9 + seat) < 0.3) {
        bestChow = a
        bestAfter = after
      }
      continue
    }
    if (th.length > 0 && after > 0) continue
    if (!pathOk(hand, meld)) continue
    // A chow opens the hand: demand a real faan source unless the minimum is trivial.
    bestChow = a
    bestAfter = after
  }
  return bestChow ?? pass
}

// ---------------------------------------------------------------------------
// Entry point

/**
 * Choose an action for `seat`, or null when that seat has nothing to decide.
 * The result is always one of `legalActions(state, seat)`.
 */
export function botAction(state: GameState, seat: number, level: BotLevel = 'normal'): Action | null {
  const legal = legalActions(state, seat)
  if (legal.length === 0) return null
  if (state.phase === 'claim') return decideClaim(state, seat, level, legal)

  const tsumo = legal.find((a) => a.type === 'tsumo')
  if (tsumo) return tsumo

  const me = state.seats[seat]
  const meldCount = me.melds.length
  const c = toCounts(me.hand)
  const th = level === 'hard' ? threats(state, seat) : []
  const curSh = shantenCounts(c, meldCount)

  for (const a of legal) {
    if (a.type === 'concealedKong') {
      const k = tileIndex(a.tile)
      if (level === 'easy') {
        if (peekRandom(state, 11) < 0.5) return a
        continue
      }
      if (th.length > 0 && curSh > 0) continue
      c[k] -= 4
      const sh = shantenCounts(c, meldCount + 1)
      c[k] += 4
      if (sh <= curSh) return a
    } else if (a.type === 'addKong') {
      if (level === 'easy' && peekRandom(state, 13) < 0.5) continue
      if (th.length > 0 && curSh > 0) continue
      return a
    }
  }
  return { type: 'discard', tile: chooseDiscard(state, seat, level) }
}

// ---------------------------------------------------------------------------
// Driving bots

/**
 * Advance the game until a human seat has to act, the hand ends, or `maxSteps`
 * is hit. `levels` is one level for every bot or a per-seat array (entries for
 * human seats are ignored). Always terminates: every step discards, draws, or
 * records a claim decision, and the wall is finite.
 */
export function playBots(
  state: GameState,
  humanSeats: readonly number[] = [0],
  levels: BotLevel | readonly BotLevel[] = 'normal',
  maxSteps = 2000,
): GameState {
  let s = state
  for (let step = 0; step < maxSteps; step++) {
    if (s.phase === 'handOver' || s.phase === 'matchOver') return s
    if (s.phase === 'draw') {
      s = advance(s)
      continue
    }
    const seats = pendingSeats(s)
    const bot = seats.find((x) => !humanSeats.includes(x))
    if (bot === undefined) return s
    const level = typeof levels === 'string' ? levels : (levels[bot] ?? 'normal')
    let action = botAction(s, bot, level)
    if (!action) action = legalActions(s, bot)[0]
    let next = applyAction(s, bot, action)
    if (next === s) {
      // Defensive: never loop on a rejected action.
      const fallback = legalActions(s, bot)
      const pass = fallback.find((a) => a.type === 'pass') ?? fallback[fallback.length - 1]
      next = applyAction(s, bot, pass)
      if (next === s) return s
    }
    s = next
  }
  return s
}
