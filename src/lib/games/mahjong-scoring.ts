// src/lib/games/mahjong-scoring.ts
/**
 * Pure Hong Kong (old style) mahjong hand maths: winning-hand decomposition,
 * faan scoring, shanten and waiting tiles. No DOM, no React, no state machine.
 *
 * Hands are handled internally as 34-slot count arrays. Slot layout (fixed here,
 * independent of mahjong-tiles ordering): 0-8 dots, 9-17 bamboo, 18-26
 * characters, 27-30 winds (E S W N), 31-33 dragons (Red Green White).
 */

import type { TileCode } from './mahjong-tiles'

// ---------------------------------------------------------------------------
// Tile index helpers

const SUIT_LETTERS = 'dbc'

/** 0..33 for a standard tile code, -1 for bonus tiles or anything invalid. */
export function tileIndex(code: TileCode): number {
  if (typeof code !== 'string' || code.length !== 2) return -1
  const n = code.charCodeAt(1) - 48
  const p = code[0]
  const s = SUIT_LETTERS.indexOf(p)
  if (s >= 0) return n >= 1 && n <= 9 ? s * 9 + n - 1 : -1
  if (p === 'w') return n >= 1 && n <= 4 ? 26 + n : -1
  if (p === 'r') return n >= 1 && n <= 3 ? 30 + n : -1
  return -1
}

export function indexToCode(i: number): TileCode {
  if (i < 27) return `${SUIT_LETTERS[Math.floor(i / 9)]}${(i % 9) + 1}`
  if (i < 31) return `w${i - 26}`
  return `r${i - 30}`
}

export const isBonusCode = (code: TileCode): boolean =>
  typeof code === 'string' && code.length === 2 && (code[0] === 'f' || code[0] === 's') && code[1] >= '1' && code[1] <= '4'

const isNumberIdx = (i: number) => i < 27
const isHonorIdx = (i: number) => i >= 27
const isTerminalIdx = (i: number) => i < 27 && (i % 9 === 0 || i % 9 === 8)
const isDragonIdx = (i: number) => i >= 31
const isWindIdx = (i: number) => i >= 27 && i <= 30

export function toCounts(tiles: readonly TileCode[]): number[] {
  const c = new Array<number>(34).fill(0)
  for (const t of tiles) {
    const i = tileIndex(t)
    if (i >= 0) c[i]++
  }
  return c
}

/** Sort comparator in this module's slot order (== canonical order). */
export function compareCodes(a: TileCode, b: TileCode): number {
  return tileIndex(a) - tileIndex(b)
}

// ---------------------------------------------------------------------------
// Types

export type MeldKind = 'chow' | 'pung' | 'kong'

export interface Meld {
  kind: MeldKind
  /** Sorted tile codes (3, or 4 for a kong). */
  tiles: TileCode[]
  /** True only for a concealed kong. */
  concealed?: boolean
  /** Seat the claimed tile came from (undefined for concealed kongs). */
  from?: number
  /** The tile that was claimed from a discard (chow/pung/kong). */
  claimed?: TileCode
}

export interface ScoreInput {
  /** All concealed tiles INCLUDING the winning tile (3n+2 tiles for 4-n melds). */
  concealed: TileCode[]
  melds: Meld[]
  bonus: TileCode[]
  winTile: TileCode
  selfDrawn: boolean
  /** 1=East .. 4=North */
  seatWind: number
  prevailingWind: number
  lastTile?: boolean
  kongReplacement?: boolean
  robbingKong?: boolean
  heavenly?: boolean
  earthly?: boolean
  /** Faan cap / limit (default 10). */
  cap?: number
}

export interface ScoreItem {
  name: string
  faan: number
}

export interface ScoreResult {
  /** Total faan after capping. */
  faan: number
  /** Uncapped sum. */
  rawFaan: number
  /** True when a limit hand (or the cap) applies. */
  limit: boolean
  breakdown: ScoreItem[]
  /** Base points from the payout table for `faan`. */
  points: number
  pattern: 'standard' | 'sevenPairs' | 'thirteenOrphans'
}

export const DEFAULT_CAP = 10

/**
 * Half-spicy (bàn là) payout table indexed by faan (0..13):
 * 0:1 1:2 2:4 3:8 4:16 5:24 6:32 7:48 8:64 9:96 10:128 11:192 12:256 13:384.
 */
export const PAYOUT_TABLE: readonly number[] = [1, 2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384]

export function faanToPoints(faan: number): number {
  const f = Math.max(0, Math.min(PAYOUT_TABLE.length - 1, Math.floor(faan)))
  return PAYOUT_TABLE[f]
}

// ---------------------------------------------------------------------------
// Decomposition

export interface SetDecomp {
  kind: 'chow' | 'pung'
  /** Slot of the lowest tile. */
  index: number
}
export interface Decomposition {
  pair: number
  sets: SetDecomp[]
}

/**
 * Every way to split the (concealed) counts into `setsNeeded` sets plus a pair.
 * Each multiset decomposition appears exactly once.
 */
export function decompositions(counts: readonly number[], setsNeeded: number): Decomposition[] {
  const out: Decomposition[] = []
  const c = counts.slice()
  let total = 0
  for (let i = 0; i < 34; i++) total += c[i]
  if (total !== setsNeeded * 3 + 2) return out
  const acc: SetDecomp[] = []
  const extract = (start: number, pair: number) => {
    let j = start
    while (j < 34 && c[j] === 0) j++
    if (j >= 34) {
      if (acc.length === setsNeeded) out.push({ pair, sets: acc.slice() })
      return
    }
    if (acc.length >= setsNeeded) return
    if (c[j] >= 3) {
      c[j] -= 3
      acc.push({ kind: 'pung', index: j })
      extract(j, pair)
      acc.pop()
      c[j] += 3
    }
    if (isNumberIdx(j) && j % 9 <= 6 && c[j + 1] > 0 && c[j + 2] > 0) {
      c[j]--
      c[j + 1]--
      c[j + 2]--
      acc.push({ kind: 'chow', index: j })
      extract(j, pair)
      acc.pop()
      c[j]++
      c[j + 1]++
      c[j + 2]++
    }
  }
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) {
      c[p] -= 2
      extract(0, p)
      c[p] += 2
    }
  }
  return out
}

/** Fast boolean: do the counts form `setsNeeded` sets + a pair? */
function standardComplete(c: number[], setsNeeded: number): boolean {
  const sets = (start: number, left: number): boolean => {
    let j = start
    while (j < 34 && c[j] === 0) j++
    if (j >= 34) return left === 0
    if (left === 0) return false
    if (c[j] >= 3) {
      c[j] -= 3
      const ok = sets(j, left - 1)
      c[j] += 3
      if (ok) return true
    }
    if (isNumberIdx(j) && j % 9 <= 6 && c[j + 1] > 0 && c[j + 2] > 0) {
      c[j]--
      c[j + 1]--
      c[j + 2]--
      const ok = sets(j, left - 1)
      c[j]++
      c[j + 1]++
      c[j + 2]++
      if (ok) return true
    }
    return false
  }
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) {
      c[p] -= 2
      const ok = sets(0, setsNeeded)
      c[p] += 2
      if (ok) return true
    }
  }
  return false
}

const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33]

function isSevenPairs(c: readonly number[]): boolean {
  let pairs = 0
  let total = 0
  for (let i = 0; i < 34; i++) {
    total += c[i]
    if (c[i] === 2) pairs++
    else if (c[i] !== 0) return false
  }
  return total === 14 && pairs === 7
}

function isThirteenOrphans(c: readonly number[]): boolean {
  let total = 0
  for (let i = 0; i < 34; i++) total += c[i]
  if (total !== 14) return false
  let pair = false
  for (const i of ORPHANS) {
    if (c[i] === 0) return false
    if (c[i] === 2) pair = true
    else if (c[i] !== 1) return false
  }
  return pair
}

/** Is this concealed tile set (plus `meldCount` declared melds) a winning shape? */
export function isWinningShape(counts: number[], meldCount: number): boolean {
  let total = 0
  for (let i = 0; i < 34; i++) total += counts[i]
  if (total !== (4 - meldCount) * 3 + 2) return false
  if (meldCount === 0 && (isSevenPairs(counts) || isThirteenOrphans(counts))) return true
  return standardComplete(counts, 4 - meldCount)
}

export function isWinningHand(concealed: readonly TileCode[], meldCount = 0): boolean {
  return isWinningShape(toCounts(concealed), meldCount)
}

/**
 * Tiles that would complete a hand of 3n+1 concealed tiles (n = 4 - melds).
 * Tiles already held four times are excluded. Returns codes in slot order.
 */
export function waitingTiles(concealed: readonly TileCode[], melds: readonly Meld[] | number = 0): TileCode[] {
  const meldCount = typeof melds === 'number' ? melds : melds.length
  const c = toCounts(concealed)
  let total = 0
  for (let i = 0; i < 34; i++) total += c[i]
  if (total !== (4 - meldCount) * 3 + 1) return []
  const out: TileCode[] = []
  for (let i = 0; i < 34; i++) {
    if (c[i] >= 4) continue
    c[i]++
    if (isWinningShape(c, meldCount)) out.push(indexToCode(i))
    c[i]--
  }
  return out
}

// ---------------------------------------------------------------------------
// Shanten

/**
 * Shanten of count array `c` with `meldCount` declared melds: -1 = complete,
 * 0 = tenpai (ready), etc. Works for 3n+1 and 3n+2 tile hands (for the latter
 * it is the shanten after the best discard). Considers seven pairs and thirteen
 * orphans when there are no melds.
 */
export function shantenCounts(c: number[], meldCount = 0): number {
  let best = standardShanten(c, meldCount)
  if (meldCount === 0 && best > 0) {
    let pairs = 0
    let kinds = 0
    for (let i = 0; i < 34; i++) {
      if (c[i] >= 1) kinds++
      if (c[i] >= 2) pairs++
    }
    best = Math.min(best, 6 - pairs + Math.max(0, 7 - kinds))
    let k = 0
    let hasPair = false
    for (const i of ORPHANS) {
      if (c[i] >= 1) k++
      if (c[i] >= 2) hasPair = true
    }
    best = Math.min(best, 13 - k - (hasPair ? 1 : 0))
  }
  return best
}

function standardShanten(c: number[], meldCount: number): number {
  let best = 8
  const dfs = (start: number, m: number, t: number, p: number) => {
    let i = start
    while (i < 34 && c[i] === 0) i++
    if (i >= 34) {
      const tt = Math.min(t, 4 - m)
      const s = 8 - 2 * m - tt - p
      if (s < best) best = s
      return
    }
    if (c[i] >= 3) {
      c[i] -= 3
      dfs(i, m + 1, t, p)
      c[i] += 3
    }
    if (c[i] >= 2) {
      c[i] -= 2
      if (p === 0) dfs(i, m, t, 1)
      dfs(i, m, t + 1, p)
      c[i] += 2
    }
    if (isNumberIdx(i)) {
      const r = i % 9
      if (r <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--
        c[i + 1]--
        c[i + 2]--
        dfs(i, m + 1, t, p)
        c[i]++
        c[i + 1]++
        c[i + 2]++
      }
      if (r <= 7 && c[i + 1] > 0) {
        c[i]--
        c[i + 1]--
        dfs(i, m, t + 1, p)
        c[i]++
        c[i + 1]++
      }
      if (r <= 6 && c[i + 2] > 0) {
        c[i]--
        c[i + 2]--
        dfs(i, m, t + 1, p)
        c[i]++
        c[i + 2]++
      }
    }
    // Treat one copy as isolated.
    c[i]--
    dfs(i, m, t, p)
    c[i]++
  }
  dfs(0, meldCount, 0, 0)
  return best
}

/** Shanten of a tile list (bonus tiles ignored). `meldCount` = declared melds. */
export function shanten(hand: readonly TileCode[], meldCount = 0): number {
  return shantenCounts(toCounts(hand), meldCount)
}

// ---------------------------------------------------------------------------
// Scoring

interface FlatSet {
  kind: 'chow' | 'pung' | 'kong'
  index: number
}

const WIND_NAMES = ['East', 'South', 'West', 'North']
const DRAGON_NAMES = ['Red', 'Green', 'White']

/**
 * Score a winning hand. Returns null when the tiles are not a winning hand.
 * Every decomposition is scored and the best one wins.
 *
 * Faan table (additive unless noted; limit hands are worth `cap`):
 *  Self-drawn 1; Concealed hand (no exposed melds) 1; Common hand (all chows,
 *  non-value pair) 1; All pungs 3; Mixed one suit 3; Pure one suit 6; each
 *  dragon pung 1; seat-wind pung 1; prevailing-wind pung 1; Small three dragons
 *  5 (on top of its two dragon pungs); Great three dragons 8; Mixed terminals
 *  (all tiles terminals/honours, mixed) 4; Seven pairs 4; win on last tile 1;
 *  win on kong replacement 1; robbing the kong 1; own-seat flower 1 and season 1;
 *  no bonus tiles 1; complete flower set +2, complete season set +2.
 *  Limit: thirteen orphans, nine gates, all kongs, small/great four winds, all
 *  honours, all terminals, heavenly, earthly, all eight bonus tiles.
 */
export function scoreHand(input: ScoreInput): ScoreResult | null {
  const cap = input.cap ?? DEFAULT_CAP
  const concealed = toCounts(input.concealed)
  const meldCount = input.melds.length
  let total = 0
  for (let i = 0; i < 34; i++) total += concealed[i]
  if (total !== (4 - meldCount) * 3 + 2 || total !== input.concealed.length) return null

  const all = concealed.slice()
  const meldSets: FlatSet[] = []
  for (const m of input.melds) {
    for (const t of m.tiles) {
      const i = tileIndex(t)
      if (i < 0) return null
      all[i]++
    }
    const lo = Math.min(...m.tiles.map(tileIndex))
    meldSets.push({ kind: m.kind, index: m.kind === 'chow' ? lo : tileIndex(m.tiles[0]) })
  }
  const exposed = input.melds.some((m) => !m.concealed)

  let best: ScoreResult | null = null
  const consider = (r: ScoreResult) => {
    if (!best || r.faan > best.faan || (r.faan === best.faan && r.breakdown.length > best.breakdown.length)) best = r
  }

  const common = (limits: ScoreItem[], items: ScoreItem[]) => {
    // Items shared by every pattern: situational, flowers, concealment, flush.
    if (input.heavenly) limits.push({ name: 'Heavenly hand', faan: cap })
    if (input.earthly) limits.push({ name: 'Earthly hand', faan: cap })
    if (input.selfDrawn) items.push({ name: 'Self-drawn', faan: 1 })
    if (!exposed) items.push({ name: 'Concealed hand', faan: 1 })
    if (input.lastTile) items.push({ name: input.selfDrawn ? 'Win on last tile' : 'Win on last discard', faan: 1 })
    if (input.kongReplacement) items.push({ name: 'Win on kong replacement', faan: 1 })
    if (input.robbingKong) items.push({ name: 'Robbing the kong', faan: 1 })
    // Bonus tiles
    const own = input.seatWind
    let flowers = 0
    let seasons = 0
    for (const b of input.bonus) {
      if (b[0] === 'f') flowers++
      else if (b[0] === 's') seasons++
      const n = b.charCodeAt(1) - 48
      if (n === own) items.push({ name: b[0] === 'f' ? 'Own seat flower' : 'Own seat season', faan: 1 })
    }
    if (input.bonus.length === 0) items.push({ name: 'No flowers', faan: 1 })
    if (flowers === 4 && seasons === 4) limits.push({ name: 'All eight bonus tiles', faan: cap })
    else {
      if (flowers === 4) items.push({ name: 'Complete flower set', faan: 2 })
      if (seasons === 4) items.push({ name: 'Complete season set', faan: 2 })
    }
    // Suit composition
    let numberSuits = 0
    let honors = 0
    let allTerminal = true
    let allTermHonor = true
    let anyHonor = false
    let anyTerminal = false
    for (let s = 0; s < 3; s++) {
      let has = false
      for (let r = 0; r < 9; r++) if (all[s * 9 + r] > 0) has = true
      if (has) numberSuits++
    }
    for (let i = 0; i < 34; i++) {
      if (all[i] === 0) continue
      if (isHonorIdx(i)) {
        honors++
        anyHonor = true
        allTerminal = false
      } else if (isTerminalIdx(i)) {
        anyTerminal = true
      } else {
        allTerminal = false
        allTermHonor = false
      }
    }
    if (numberSuits === 0 && anyHonor) limits.push({ name: 'All honours', faan: cap })
    else if (allTerminal && anyTerminal && !anyHonor) limits.push({ name: 'All terminals', faan: cap })
    else if (allTermHonor && anyHonor && anyTerminal) items.push({ name: 'Terminals and honours', faan: 4 })
    if (numberSuits === 1 && honors === 0) items.push({ name: 'Pure one suit', faan: 6 })
    else if (numberSuits === 1 && honors > 0) items.push({ name: 'Mixed one suit', faan: 3 })
  }

  const finish = (pattern: ScoreResult['pattern'], limits: ScoreItem[], items: ScoreItem[]) => {
    let r: ScoreResult
    if (limits.length > 0) {
      r = { faan: cap, rawFaan: cap, limit: true, breakdown: limits, points: faanToPoints(cap), pattern }
    } else {
      let raw = 0
      for (const it of items) raw += it.faan
      if (items.length === 0 || raw === 0) items = [{ name: 'Chicken hand', faan: 0 }]
      const f = Math.min(raw, cap)
      r = { faan: f, rawFaan: raw, limit: raw >= cap, breakdown: items, points: faanToPoints(f), pattern }
    }
    consider(r)
  }

  // --- thirteen orphans / seven pairs / nine gates (special shapes)
  if (meldCount === 0) {
    if (isThirteenOrphans(concealed)) {
      const limits: ScoreItem[] = [{ name: 'Thirteen orphans', faan: cap }]
      const items: ScoreItem[] = []
      common(limits, items)
      finish('thirteenOrphans', limits, items)
    }
    if (isSevenPairs(concealed)) {
      const limits: ScoreItem[] = []
      const items: ScoreItem[] = [{ name: 'Seven pairs', faan: 4 }]
      common(limits, items)
      finish('sevenPairs', limits, items)
    }
  }

  // --- standard decompositions
  for (const d of decompositions(concealed, 4 - meldCount)) {
    const sets: FlatSet[] = [...meldSets, ...d.sets]
    const limits: ScoreItem[] = []
    const items: ScoreItem[] = []
    common(limits, items)
    const pungs = sets.filter((s) => s.kind !== 'chow')
    const kongs = sets.filter((s) => s.kind === 'kong')
    const pairIdx = d.pair
    const pairValue = isDragonIdx(pairIdx) || pairIdx === 26 + input.seatWind || pairIdx === 26 + input.prevailingWind
    if (sets.every((s) => s.kind === 'chow') && !pairValue) items.push({ name: 'Common hand', faan: 1 })
    if (pungs.length === 4) items.push({ name: 'All pungs', faan: 3 })
    if (kongs.length === 4) limits.push({ name: 'All kongs', faan: cap })
    // Dragons
    const dragonPungs = pungs.filter((s) => isDragonIdx(s.index))
    for (const s of dragonPungs) items.push({ name: `${DRAGON_NAMES[s.index - 31]} dragon pung`, faan: 1 })
    if (dragonPungs.length === 3) items.push({ name: 'Great three dragons', faan: 8 })
    else if (dragonPungs.length === 2 && isDragonIdx(pairIdx)) items.push({ name: 'Small three dragons', faan: 5 })
    // Winds
    const windPungs = pungs.filter((s) => isWindIdx(s.index))
    for (const s of windPungs) {
      const w = s.index - 26
      if (w === input.seatWind) items.push({ name: `Seat wind pung (${WIND_NAMES[w - 1]})`, faan: 1 })
      if (w === input.prevailingWind) items.push({ name: `Prevailing wind pung (${WIND_NAMES[w - 1]})`, faan: 1 })
    }
    if (windPungs.length === 4) limits.push({ name: 'Great four winds', faan: cap })
    else if (windPungs.length === 3 && isWindIdx(pairIdx)) limits.push({ name: 'Small four winds', faan: cap })
    // Nine gates
    if (meldCount === 0) {
      for (let s = 0; s < 3; s++) {
        const base = s * 9
        let sum = 0
        for (let r = 0; r < 9; r++) sum += concealed[base + r]
        if (sum !== 14) continue
        let ok = concealed[base] >= 3 && concealed[base + 8] >= 3
        for (let r = 1; r < 8 && ok; r++) if (concealed[base + r] < 1) ok = false
        if (ok) limits.push({ name: 'Nine gates', faan: cap })
      }
    }
    finish('standard', limits, items)
  }

  return best
}
