// src/lib/games/cards.ts
/**
 * Playing cards shared by the desk card games. Pure: no DOM, no React.
 * Shuffling takes an rng so games and tests can replay a deal from a seed.
 */

export type Suit = 'S' | 'H' | 'D' | 'C'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export interface Card { rank: Rank; suit: Suit }

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]

const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

export const isRed = (suit: Suit) => suit === 'H' || suit === 'D'
export const rankLabel = (rank: Rank) => RANK_LABELS[rank]
/** Stable id, e.g. 'AS', '10H', 'QD'. Unique within one deck, not within a multi-deck shoe. */
export const cardId = (c: Card) => `${RANK_LABELS[c.rank]}${c.suit}`

export interface CardNameLabels {
  /** Thirteen entries, Ace first. */
  ranks: string[]
  suits: Record<Suit, string>
  /** Template with {rank} and {suit}. */
  card: string
  faceDown: string
}

/** Accessible name, e.g. "Queen of hearts". */
export function cardName(c: Card, labels: CardNameLabels): string {
  return labels.card.replace('{rank}', labels.ranks[c.rank - 1]).replace('{suit}', labels.suits[c.suit])
}

/** `decks` standard 52-card decks in suit-then-rank order. */
export function createDeck(decks = 1): Card[] {
  const out: Card[] = []
  for (let d = 0; d < decks; d++) for (const suit of SUITS) for (const rank of RANKS) out.push({ rank, suit })
  return out
}

/** Fisher-Yates into a new array; `rng` returns [0, 1). */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Small seeded rng for replayable deals and tests. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
