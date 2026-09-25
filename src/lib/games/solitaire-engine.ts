// src/lib/games/solitaire-engine.ts
/**
 * Pure Klondike solitaire logic. No DOM, no React. Every function returns a
 * new state; an illegal action returns null. Randomness is only in `deal`
 * through the injected rng (shuffle from cards.ts).
 */
import { createDeck, isRed, shuffle, type Card } from './cards'

export type DrawCount = 1 | 3

export interface TableauPile {
  /** Face-down cards, bottom first. */
  down: Card[]
  /** Face-up cards, bottom first (a descending, alternating-colour run). */
  up: Card[]
}

export interface SolitaireState {
  /** Top of the stock is the last element. */
  stock: Card[]
  /** Top of the waste is the last element. */
  waste: Card[]
  /** Four piles; each builds Ace to King in a single suit. */
  foundations: Card[][]
  /** Seven piles; pile i is dealt i face-down cards and one face-up card. */
  tableau: TableauPile[]
  drawCount: DrawCount
  score: number
  moves: number
  recycles: number
  won: boolean
}

/** A source (and foundation/tableau destination) location. */
export type Loc =
  | { pile: 'waste' }
  | { pile: 'foundation'; index: number }
  | { pile: 'tableau'; index: number; card: number }

const FOUNDATION_COUNT = 4
const TABLEAU_COUNT = 7
const RECYCLE_PENALTY: Record<DrawCount, number> = { 1: 100, 3: 20 }

const cloneState = (s: SolitaireState): SolitaireState => ({
  ...s,
  stock: s.stock.slice(),
  waste: s.waste.slice(),
  foundations: s.foundations.map((p) => p.slice()),
  tableau: s.tableau.map((p) => ({ down: p.down.slice(), up: p.up.slice() })),
})

const topOf = (pile: Card[]): Card | undefined => pile[pile.length - 1]

/** Standard Klondike deal: 28 cards to the tableau, 24 to the stock. */
export function deal(rng: () => number, drawCount: DrawCount): SolitaireState {
  const deck = shuffle(createDeck(), rng)
  const tableau: TableauPile[] = []
  let i = 0
  for (let p = 0; p < TABLEAU_COUNT; p++) {
    const down = deck.slice(i, i + p)
    i += p
    const up = deck.slice(i, i + 1)
    i += 1
    tableau.push({ down, up })
  }
  return {
    stock: deck.slice(i),
    waste: [],
    foundations: [[], [], [], []],
    tableau,
    drawCount,
    score: 0,
    moves: 0,
    recycles: 0,
    won: false,
  }
}

/**
 * Turns drawCount cards from the stock onto the waste (fewer if the stock is
 * short). With an empty stock and a non-empty waste, recycles the waste back
 * into the stock face down so the next pass deals the same sequence, applying
 * the draw-mode recycle penalty. Returns null when both are empty.
 */
export function draw(s: SolitaireState): SolitaireState | null {
  if (s.won) return null
  if (s.stock.length > 0) {
    const next = cloneState(s)
    const take = Math.min(s.drawCount, next.stock.length)
    next.waste.push(...next.stock.splice(next.stock.length - take, take))
    next.moves += 1
    return next
  }
  if (s.waste.length > 0) {
    const next = cloneState(s)
    // Reversing the waste restores the original stock sequence for the next pass.
    next.stock = next.waste.reverse()
    next.waste = []
    next.recycles += 1
    next.moves += 1
    next.score = Math.max(0, next.score - RECYCLE_PENALTY[s.drawCount])
    return next
  }
  return null
}

const runFrom = (s: SolitaireState, from: Loc): Card[] => {
  if (from.pile === 'waste') return s.waste.length > 0 ? [s.waste[s.waste.length - 1]] : []
  if (from.pile === 'foundation') {
    const pile = s.foundations[from.index]
    return pile && pile.length > 0 ? [pile[pile.length - 1]] : []
  }
  const pile = s.tableau[from.index]
  if (!pile || from.card < 0 || from.card >= pile.up.length) return []
  const run = pile.up.slice(from.card)
  // A movable run must itself be a legal descending, alternating-colour sequence.
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1]
    const b = run[i]
    if (a.rank !== b.rank + 1 || isRed(a.suit) === isRed(b.suit)) return []
  }
  return run
}

const canMoveToFoundation = (card: Card, pile: Card[]): boolean => {
  const top = topOf(pile)
  if (!top) return card.rank === 1
  return top.suit === card.suit && top.rank + 1 === card.rank
}

const canMoveToTableau = (cards: Card[], pile: TableauPile): boolean => {
  const bottom = cards[0]
  const top = topOf(pile.up)
  if (!top) return bottom.rank === 13
  return bottom.rank + 1 === top.rank && isRed(bottom.suit) !== isRed(top.suit)
}

export function canMove(s: SolitaireState, from: Loc, to: Loc): boolean {
  if (s.won) return false
  if (from.pile === 'foundation' && to.pile === 'foundation') return false
  if (from.pile === 'tableau' && to.pile === 'tableau' && from.index === to.index) return false
  const cards = runFrom(s, from)
  if (cards.length === 0) return false
  if (to.pile === 'foundation') {
    const pile = s.foundations[to.index]
    return pile !== undefined && cards.length === 1 && canMoveToFoundation(cards[0], pile)
  }
  if (to.pile === 'tableau') {
    const pile = s.tableau[to.index]
    return pile !== undefined && canMoveToTableau(cards, pile)
  }
  return false
}

/** Applies a legal move, scores it, flips any exposed card and checks for a win. */
export function move(s: SolitaireState, from: Loc, to: Loc): SolitaireState | null {
  if (!canMove(s, from, to)) return null
  const next = cloneState(s)

  let moved: Card[]
  if (from.pile === 'waste') moved = next.waste.splice(next.waste.length - 1, 1)
  else if (from.pile === 'foundation') moved = next.foundations[from.index].splice(next.foundations[from.index].length - 1, 1)
  else moved = next.tableau[from.index].up.splice(from.card, next.tableau[from.index].up.length - from.card)

  if (to.pile === 'foundation') next.foundations[to.index].push(...moved)
  else if (to.pile === 'tableau') next.tableau[to.index].up.push(...moved)

  if (from.pile === 'waste' && to.pile === 'foundation') next.score += 10
  else if (from.pile === 'waste' && to.pile === 'tableau') next.score += 5
  else if (from.pile === 'tableau' && to.pile === 'foundation') next.score += 10
  else if (from.pile === 'foundation' && to.pile === 'tableau') next.score = Math.max(0, next.score - 15)

  if (from.pile === 'tableau') {
    const pile = next.tableau[from.index]
    if (pile.up.length === 0 && pile.down.length > 0) {
      const flipped = pile.down.pop()
      if (flipped) pile.up.push(flipped)
      next.score += 5
    }
  }

  next.moves += 1
  next.won = next.foundations.every((p) => p.length === 13)
  return next
}

/** Best double-click destination: a foundation if legal, else the first legal tableau pile (non-empty first). */
export function autoTarget(s: SolitaireState, from: Loc): Loc | null {
  for (let i = 0; i < FOUNDATION_COUNT; i++) {
    const to: Loc = { pile: 'foundation', index: i }
    if (canMove(s, from, to)) return to
  }
  for (let i = 0; i < TABLEAU_COUNT; i++) {
    if (s.tableau[i].up.length > 0) {
      const to: Loc = { pile: 'tableau', index: i, card: 0 }
      if (canMove(s, from, to)) return to
    }
  }
  for (let i = 0; i < TABLEAU_COUNT; i++) {
    if (s.tableau[i].up.length === 0) {
      const to: Loc = { pile: 'tableau', index: i, card: 0 }
      if (canMove(s, from, to)) return to
    }
  }
  return null
}

/** True when only foundation moves remain: no stock, no waste, no face-down cards. */
export function canAutoFinish(s: SolitaireState): boolean {
  return s.stock.length === 0 && s.waste.length === 0 && s.tableau.every((p) => p.down.length === 0)
}

/** Moves the lowest-ranked card that can go to a foundation (one card per call). */
export function autoFinishStep(s: SolitaireState): SolitaireState | null {
  if (s.won) return null
  const candidates: { from: Loc; card: Card }[] = []
  const wasteTop = topOf(s.waste)
  if (wasteTop) candidates.push({ from: { pile: 'waste' }, card: wasteTop })
  for (let i = 0; i < TABLEAU_COUNT; i++) {
    const up = s.tableau[i].up
    if (up.length > 0) {
      const card = topOf(up)
      if (card) candidates.push({ from: { pile: 'tableau', index: i, card: up.length - 1 }, card })
    }
  }
  candidates.sort((a, b) => a.card.rank - b.card.rank)
  for (const { from } of candidates) {
    for (let i = 0; i < FOUNDATION_COUNT; i++) {
      const to: Loc = { pile: 'foundation', index: i }
      if (canMove(s, from, to)) return move(s, from, to)
    }
  }
  return null
}

/** Applies the Windows time bonus to a won state: 700000 / seconds, from 30 s up. */
export function finish(s: SolitaireState, seconds: number): SolitaireState {
  const bonus = seconds >= 30 ? Math.round(700000 / seconds) : 0
  return { ...s, score: s.score + bonus, won: true }
}
