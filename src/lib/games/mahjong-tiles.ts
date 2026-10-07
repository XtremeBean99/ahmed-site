// src/lib/games/mahjong-tiles.ts
/**
 * Shared Mahjong tile model (used by the solitaire and 4-player engines).
 * Pure data + helpers, no DOM, no React. Tiles are plain strings ("codes") so
 * they are trivially JSON-serialisable and comparable.
 *
 * Codes: d1-d9 dots, b1-b9 bamboo, c1-c9 characters, w1-w4 winds
 * (1=East 2=South 3=West 4=North), r1-r3 dragons (1=Red 2=Green 3=White),
 * f1-f4 flowers, s1-s4 seasons.
 */

export type Suit = 'dots' | 'bamboo' | 'characters' | 'winds' | 'dragons' | 'flowers' | 'seasons'
export interface TileKind { suit: Suit; rank: number }
export type TileCode = string
/** Helpers below accept either the compact code or the decoded kind. */
export type TileLike = TileCode | TileKind

const SUIT_PREFIX: Record<Suit, string> = {
  dots: 'd',
  bamboo: 'b',
  characters: 'c',
  winds: 'w',
  dragons: 'r',
  flowers: 'f',
  seasons: 's',
}
const PREFIX_SUIT: Record<string, Suit> = Object.fromEntries(
  (Object.keys(SUIT_PREFIX) as Suit[]).map((s) => [SUIT_PREFIX[s], s]),
)
/** Canonical suit order (also the sort order). */
const SUIT_ORDER: Suit[] = ['dots', 'bamboo', 'characters', 'winds', 'dragons', 'flowers', 'seasons']
const SUIT_SIZE: Record<Suit, number> = {
  dots: 9,
  bamboo: 9,
  characters: 9,
  winds: 4,
  dragons: 3,
  flowers: 4,
  seasons: 4,
}

export function tileCode(kind: TileKind): TileCode {
  return `${SUIT_PREFIX[kind.suit]}${kind.rank}`
}

/** Decode a tile code; returns null for anything that is not a valid code. */
export function parseTile(code: TileCode): TileKind | null {
  if (typeof code !== 'string' || code.length !== 2) return null
  const suit = PREFIX_SUIT[code[0]]
  if (!suit || !Object.prototype.hasOwnProperty.call(PREFIX_SUIT, code[0])) return null
  const rank = code.charCodeAt(1) - 48
  if (!(rank >= 1 && rank <= SUIT_SIZE[suit])) return null
  return { suit, rank }
}

function kindOf(t: TileLike): TileKind | null {
  return typeof t === 'string' ? parseTile(t) : t
}

function kindsOf(suits: Suit[]): TileKind[] {
  const out: TileKind[] = []
  for (const suit of suits) for (let rank = 1; rank <= SUIT_SIZE[suit]; rank++) out.push({ suit, rank })
  return out
}

/** The 34 standard kinds in canonical sort order. */
export const ALL_KINDS: readonly TileKind[] = kindsOf(['dots', 'bamboo', 'characters', 'winds', 'dragons'])
/** The 8 bonus kinds (4 flowers then 4 seasons). */
export const BONUS_KINDS: readonly TileKind[] = kindsOf(['flowers', 'seasons'])

export function isBonus(t: TileLike): boolean {
  const k = kindOf(t)
  return !!k && (k.suit === 'flowers' || k.suit === 'seasons')
}
export function isHonor(t: TileLike): boolean {
  const k = kindOf(t)
  return !!k && (k.suit === 'winds' || k.suit === 'dragons')
}
/** Terminals are the 1s and 9s of the three numbered suits. */
export function isTerminal(t: TileLike): boolean {
  const k = kindOf(t)
  return !!k && (k.suit === 'dots' || k.suit === 'bamboo' || k.suit === 'characters') && (k.rank === 1 || k.rank === 9)
}

/** Sort comparator for hands: canonical suit order, then rank. Invalid codes sort last. */
export function compareTiles(a: TileLike, b: TileLike): number {
  const ka = kindOf(a)
  const kb = kindOf(b)
  if (!ka || !kb) return ka ? -1 : kb ? 1 : 0
  const s = SUIT_ORDER.indexOf(ka.suit) - SUIT_ORDER.indexOf(kb.suit)
  return s !== 0 ? s : ka.rank - kb.rank
}

const WIND_NAMES = ['East', 'South', 'West', 'North']
const DRAGON_NAMES = ['Red', 'Green', 'White']
const FLOWER_NAMES = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo']
const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter']
const SUIT_TITLE: Record<'dots' | 'bamboo' | 'characters', string> = {
  dots: 'Dots',
  bamboo: 'Bamboo',
  characters: 'Characters',
}

/** Human readable name: '5 of Bamboo', 'Red Dragon', 'East Wind', 'Plum (Flower 1)'. */
export function tileName(t: TileLike): string {
  const k = kindOf(t)
  if (!k) return 'Unknown tile'
  switch (k.suit) {
    case 'winds': return `${WIND_NAMES[k.rank - 1]} Wind`
    case 'dragons': return `${DRAGON_NAMES[k.rank - 1]} Dragon`
    case 'flowers': return `${FLOWER_NAMES[k.rank - 1]} (Flower ${k.rank})`
    case 'seasons': return `${SEASON_NAMES[k.rank - 1]} (Season ${k.rank})`
    default: return `${k.rank} of ${SUIT_TITLE[k.suit]}`
  }
}

/** 136 codes (4 of each standard kind) or 144 with one of each bonus tile. Canonical order. */
export function fullSet(includeBonus: boolean): TileCode[] {
  const out: TileCode[] = []
  for (const k of ALL_KINDS) for (let i = 0; i < 4; i++) out.push(tileCode(k))
  if (includeBonus) for (const k of BONUS_KINDS) out.push(tileCode(k))
  return out
}

/** Small, fast seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher-Yates; pure (returns a new array). */
export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
