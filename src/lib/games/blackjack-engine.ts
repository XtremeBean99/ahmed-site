// src/lib/games/blackjack-engine.ts
/**
 * Pure Blackjack logic for the desk arcade. No DOM, no React, no Math.random:
 * every function takes the state and an injected rng, and returns a new state.
 * The shoe is a 6-deck shoe reshuffled before a deal once fewer than 25 %
 * remain (75 % penetration). The dealer peeks on an Ace or ten-value up card,
 * and stands on all 17s including soft 17.
 */
import { createDeck, shuffle, type Card } from './cards'

export const SHOE_DECKS = 6
export const SHOE_SIZE = SHOE_DECKS * 52
export const CHIP_VALUES = [5, 25, 100, 500] as const
export const MIN_BET = 5
export const MAX_BET = 500
/** Reshuffle once fewer than this fraction of the shoe remains. */
export const RESHUFFLE_AT = 0.25

export type Phase = 'betting' | 'insurance' | 'player' | 'dealer' | 'settled'
export type HandOutcome = 'blackjack' | 'win' | 'push' | 'lose' | 'bust'

export interface Hand {
  cards: Card[]
  bet: number
  doubled: boolean
  fromSplit: boolean
  splitAces: boolean
  done: boolean
  outcome?: HandOutcome
  payout?: number
}

export interface BlackjackState {
  phase: Phase
  /** Remaining cards; the end of the array is the next card dealt. */
  shoe: Card[]
  shoeSize: number
  /** Cards used since the last shuffle, so the UI can grow the discard tray. */
  discards: number
  bankroll: number
  /** The pending bet while betting; kept after settle so Rebet can repeat it. */
  bet: number
  hands: Hand[]
  active: number
  dealer: Card[]
  holeRevealed: boolean
  /** Insurance stake in play (0 when none). */
  insurance: number
  /** Amount deducted from the bankroll for insurance (0 when none). */
  insurancePaid: number
  /** True on the deal that reshuffled the shoe. */
  shuffled: boolean
  rebuys: number
  handsPlayed: number
}

const valueOf = (card: Card) => Math.min(card.rank, 10)

const cardsBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21

/** Total and whether an Ace counts as 11. Aces count high only while 21 holds. */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += valueOf(card)
    if (card.rank === 1) aces++
  }
  const soft = aces > 0 && total + 10 <= 21
  if (soft) total += 10
  return { total, soft }
}

/** A two-card natural 21. A 21 made after a split counts as 21, not blackjack. */
export function isBlackjack(hand: Hand): boolean {
  return !hand.fromSplit && cardsBlackjack(hand.cards)
}

/** Insurance costs half the bet, rounded down to a whole chip. */
export const insuranceCost = (bet: number) => Math.floor(bet / 2)

export function canInsure(s: BlackjackState): boolean {
  return s.phase === 'insurance' && s.bankroll >= insuranceCost(s.bet)
}

export function canDouble(s: BlackjackState): boolean {
  if (s.phase !== 'player') return false
  const hand = s.hands[s.active]
  return Boolean(hand && !hand.done && hand.cards.length === 2 && s.bankroll >= hand.bet)
}

export function canSplit(s: BlackjackState): boolean {
  if (s.phase !== 'player' || s.hands.length >= 4) return false
  const hand = s.hands[s.active]
  return Boolean(hand && !hand.done && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank)
}

export function dealerShouldHit(cards: Card[]): boolean {
  return handValue(cards).total < 17
}

export function createTable(rng: () => number, bankroll = 1000): BlackjackState {
  return {
    phase: 'betting',
    shoe: shuffle(createDeck(SHOE_DECKS), rng),
    shoeSize: SHOE_SIZE,
    discards: 0,
    bankroll,
    bet: 0,
    hands: [],
    active: 0,
    dealer: [],
    holeRevealed: false,
    insurance: 0,
    insurancePaid: 0,
    shuffled: false,
    rebuys: 0,
    handsPlayed: 0,
  }
}

function drawOne(s: BlackjackState, rng: () => number): { card: Card; shoe: Card[]; discards: number } {
  // Unreachable in normal play: the shoe is reshuffled before every deal.
  if (s.shoe.length === 0) {
    const shoe = shuffle(createDeck(SHOE_DECKS), rng)
    return { card: shoe[shoe.length - 1], shoe: shoe.slice(0, -1), discards: 1 }
  }
  return { card: s.shoe[s.shoe.length - 1], shoe: s.shoe.slice(0, -1), discards: s.discards + 1 }
}

export function addChip(s: BlackjackState, value: number): BlackjackState {
  if (s.phase !== 'betting' || !(CHIP_VALUES as readonly number[]).includes(value)) return s
  const bet = Math.min(MAX_BET, s.bankroll, s.bet + value)
  return bet === s.bet ? s : { ...s, bet }
}

export function clearBet(s: BlackjackState): BlackjackState {
  if (s.phase !== 'betting' || s.bet === 0) return s
  return { ...s, bet: 0 }
}

/**
 * Deals a round and resolves everything the player would learn instantly:
 * the stake leaves the bankroll, the dealer peeks on an Ace or ten, a dealer
 * blackjack settles the round, and a player blackjack pays 3:2 at once.
 * The UI paces the card reveals itself.
 */
export function deal(s: BlackjackState, rng: () => number): BlackjackState {
  if (s.phase !== 'betting' || s.bet < MIN_BET || s.bet > s.bankroll) return s
  let shoe = s.shoe
  let discards = s.discards
  let shuffled = false
  if (shoe.length / s.shoeSize < RESHUFFLE_AT) {
    shoe = shuffle(createDeck(SHOE_DECKS), rng)
    discards = 0
    shuffled = true
  }
  const next = (): Card => {
    if (shoe.length === 0) {
      shoe = shuffle(createDeck(SHOE_DECKS), rng)
      discards = 0
    }
    const card = shoe[shoe.length - 1]
    shoe = shoe.slice(0, -1)
    discards += 1
    return card
  }
  const p1 = next()
  const up = next()
  const p2 = next()
  const hole = next()
  const hand: Hand = {
    cards: [p1, p2],
    bet: s.bet,
    doubled: false,
    fromSplit: false,
    splitAces: false,
    done: false,
  }
  const base: BlackjackState = {
    ...s,
    phase: 'player',
    shoe,
    discards,
    shuffled,
    bankroll: s.bankroll - s.bet,
    hands: [hand],
    active: 0,
    dealer: [up, hole],
    holeRevealed: false,
    insurance: 0,
    insurancePaid: 0,
  }
  // An Ace up offers insurance first, then peeks. Otherwise peek right away.
  if (handValue([up]).total === 11 && base.bankroll >= insuranceCost(s.bet)) {
    return { ...base, phase: 'insurance' }
  }
  if (cardsBlackjack(base.dealer)) return settleRound({ ...base, holeRevealed: true })
  if (isBlackjack(hand)) return settleRound(base)
  return base
}

export function insure(s: BlackjackState, take: boolean): BlackjackState {
  if (s.phase !== 'insurance') return s
  const stake = take ? insuranceCost(s.bet) : 0
  if (take && s.bankroll < stake) return s
  let next: BlackjackState = {
    ...s,
    phase: 'player',
    bankroll: s.bankroll - stake,
    insurance: stake,
    insurancePaid: stake,
  }
  if (cardsBlackjack(next.dealer)) {
    // Stake returned plus 2:1 winnings.
    next = { ...next, holeRevealed: true, bankroll: next.bankroll + stake * 3 }
    return settleRound(next)
  }
  if (isBlackjack(next.hands[0])) return settleRound(next)
  return next
}

export function hit(s: BlackjackState, rng: () => number): BlackjackState {
  if (s.phase !== 'player') return s
  const hand = s.hands[s.active]
  if (!hand || hand.done || hand.splitAces) return s
  const draw = drawOne(s, rng)
  const cards = [...hand.cards, draw.card]
  const value = handValue(cards)
  let nextHand: Hand
  if (value.total > 21) {
    nextHand = { ...hand, cards, done: true, outcome: 'bust', payout: 0 }
  } else {
    // A hand at 21 cannot improve, so it stands itself.
    nextHand = { ...hand, cards, done: value.total === 21 }
  }
  const hands = s.hands.map((h, i) => (i === s.active ? nextHand : h))
  const next = { ...s, shoe: draw.shoe, discards: draw.discards, hands }
  return nextHand.done ? advanceAfterHand(next) : next
}

export function stand(s: BlackjackState): BlackjackState {
  if (s.phase !== 'player') return s
  const hand = s.hands[s.active]
  if (!hand || hand.done) return s
  const hands = s.hands.map((h, i) => (i === s.active ? { ...h, done: true } : h))
  return advanceAfterHand({ ...s, hands })
}

export function double(s: BlackjackState, rng: () => number): BlackjackState {
  if (!canDouble(s)) return s
  const hand = s.hands[s.active]
  const draw = drawOne(s, rng)
  const cards = [...hand.cards, draw.card]
  const value = handValue(cards)
  const doubled: Hand = {
    ...hand,
    cards,
    bet: hand.bet * 2,
    doubled: true,
    done: true,
    outcome: value.total > 21 ? 'bust' : undefined,
    payout: value.total > 21 ? 0 : undefined,
  }
  const hands = s.hands.map((h, i) => (i === s.active ? doubled : h))
  return advanceAfterHand({ ...s, bankroll: s.bankroll - hand.bet, shoe: draw.shoe, discards: draw.discards, hands })
}

export function split(s: BlackjackState, rng: () => number): BlackjackState {
  if (!canSplit(s)) return s
  const hand = s.hands[s.active]
  const aces = hand.cards[0].rank === 1
  const firstDraw = drawOne(s, rng)
  const secondDraw = drawOne({ ...s, shoe: firstDraw.shoe, discards: firstDraw.discards }, rng)
  const first: Hand = {
    ...hand,
    cards: [hand.cards[0], firstDraw.card],
    fromSplit: true,
    splitAces: aces,
    done: aces,
  }
  const second: Hand = {
    cards: [hand.cards[1], secondDraw.card],
    bet: hand.bet,
    doubled: false,
    fromSplit: true,
    splitAces: aces,
    done: aces,
  }
  const hands = [...s.hands.slice(0, s.active), first, second, ...s.hands.slice(s.active + 1)]
  let next: BlackjackState = {
    ...s,
    bankroll: s.bankroll - hand.bet,
    shoe: secondDraw.shoe,
    discards: secondDraw.discards,
    hands,
    active: s.active,
  }
  // Split Aces get exactly one card each and stand.
  if (aces) next = advanceAfterHand(next)
  return next
}

/**
 * One visible dealer change per call: reveal the hole card, draw one card, or
 * finish the round, so the UI can pace the dealer with timed calls.
 */
export function dealerStep(s: BlackjackState, rng: () => number): BlackjackState {
  if (s.phase !== 'dealer') return s
  if (!s.holeRevealed) return { ...s, holeRevealed: true }
  if (s.hands.every((h) => h.done && h.outcome === 'bust')) return settleRound(s)
  if (dealerShouldHit(s.dealer)) {
    const draw = drawOne(s, rng)
    return { ...s, shoe: draw.shoe, discards: draw.discards, dealer: [...s.dealer, draw.card] }
  }
  return settleRound(s)
}

export function settle(s: BlackjackState): BlackjackState {
  if (s.phase !== 'dealer') return s
  return settleRound(s)
}

/** Pays every unsettled hand against the dealer and closes the round. */
function settleRound(s: BlackjackState): BlackjackState {
  const dealerBj = cardsBlackjack(s.dealer)
  const dealerTotal = handValue(s.dealer).total
  let bankroll = s.bankroll
  const hands: Hand[] = s.hands.map((hand): Hand => {
    if (hand.outcome) return hand
    if (dealerBj) {
      if (isBlackjack(hand)) {
        bankroll += hand.bet
        return { ...hand, outcome: 'push', payout: 0 }
      }
      return { ...hand, outcome: 'lose', payout: 0 }
    }
    if (isBlackjack(hand)) {
      const payout = hand.bet * 1.5
      bankroll += hand.bet + payout
      return { ...hand, outcome: 'blackjack', payout }
    }
    const total = handValue(hand.cards).total
    let outcome: HandOutcome
    let payout = 0
    if (dealerTotal > 21) {
      outcome = 'win'
      payout = hand.bet
    } else if (total > dealerTotal) {
      outcome = 'win'
      payout = hand.bet
    } else if (total === dealerTotal) {
      outcome = 'push'
    } else {
      outcome = 'lose'
    }
    if (outcome === 'win') bankroll += hand.bet + payout
    else if (outcome === 'push') bankroll += hand.bet
    return { ...hand, outcome, payout }
  })
  return { ...s, phase: 'settled', hands, bankroll, handsPlayed: s.handsPlayed + 1 }
}

/** Re-deal the same bet after a settled round. */
export function rebet(s: BlackjackState, rng: () => number): BlackjackState {
  if (s.phase !== 'settled' || s.bet < MIN_BET || s.bet > s.bankroll) return s
  return deal({ ...s, phase: 'betting' }, rng)
}

/** Clear the table and go back to betting with no pending bet. */
export function newBet(s: BlackjackState): BlackjackState {
  if (s.phase !== 'settled') return s
  return {
    ...s,
    phase: 'betting',
    bet: 0,
    hands: [],
    active: 0,
    dealer: [],
    holeRevealed: false,
    insurance: 0,
    insurancePaid: 0,
    shuffled: false,
  }
}

export function rebuy(s: BlackjackState): BlackjackState {
  if (s.bankroll >= MIN_BET) return s
  if (s.phase !== 'betting' && s.phase !== 'settled') return s
  return { ...s, bankroll: 1000, rebuys: s.rebuys + 1 }
}

function advanceAfterHand(s: BlackjackState): BlackjackState {
  for (let i = s.active + 1; i < s.hands.length; i++) {
    if (!s.hands[i].done) return { ...s, active: i }
  }
  return { ...s, phase: 'dealer' }
}

/**
 * Table geometry for one screen. Landscape is the original 536x308 desk table,
 * pixel for pixel; portrait is a 320-wide phone felt under the strip and the
 * app toolbar (44 + 44 logical px).
 */
export interface BlackjackLayout {
  portrait: boolean
  /** Felt width in logical px. */
  playW: number
  /** Felt height under the strip (and, in portrait, the toolbar row). */
  feltH: number
  cardW: number
  cardH: number
  dealerY: number
  /** Base (inactive) top of a hand in the first row. */
  handY: number
  handYActive: number
  badgeAbove: number
  midY: number
  midH: number
  stakeY: number
  circle: { x: number; y: number; r: number }
  shoe: { x: number; y: number }
  shoeOrigin: { x: number; y: number }
  fan: number
  handGap: number
  edge: number
  /** The width hands may occupy: playW minus both edges. */
  maxRowW: number
  /** Vertical step between stacked hand rows in portrait. */
  rowH: number
  /** Portrait: tighten the fan at most this far before stacking rows. */
  minStep: number
  /** Portrait: the 38px action row's top. */
  actionTop: number
  chipRowTop: number
  chipRowH: number
  actionH: number
  /** Portrait: stake circle centre when the chip row is / is not shown. */
  betYBetting: number
  betYPlay: number
  /** Portrait: vertical band the hand block is centred in. */
  handAreaTop: number
  handAreaBottom: number
}

const LANDSCAPE_STRIP_H = 28
const PORTRAIT_STRIP_H = 88

export function blackjackLayout(w: number, h: number, portrait: boolean, cardW: number, cardH: number): BlackjackLayout {
  if (!portrait) {
    const feltH = h - LANDSCAPE_STRIP_H
    return {
      portrait: false,
      playW: w,
      feltH,
      cardW,
      cardH,
      dealerY: 10,
      handY: 138,
      handYActive: 134,
      badgeAbove: 19,
      midY: 10 + cardH,
      midH: 134 - 19 - (10 + cardH),
      stakeY: 210,
      circle: { x: 268, y: 222, r: 14 },
      shoe: { x: 470, y: 8 },
      shoeOrigin: { x: 493, y: 21 },
      fan: 14,
      handGap: 24,
      edge: 12,
      maxRowW: w - 2 * 12,
      rowH: 0,
      minStep: 0,
      actionTop: feltH - 40,
      chipRowTop: 0,
      chipRowH: 0,
      actionH: 40,
      betYBetting: 222,
      betYPlay: 222,
      handAreaTop: 0,
      handAreaBottom: 0,
    }
  }
  const feltH = h - PORTRAIT_STRIP_H
  const dealerY = 6
  const midY = dealerY + cardH + 4
  const midH = 26
  const actionH = 38
  const chipRowH = 44
  const actionTop = feltH - 4 - actionH
  const chipRowTop = actionTop - 6 - chipRowH
  const betYBetting = chipRowTop - 6 - 14
  const betYPlay = actionTop - 6 - 14
  return {
    portrait: true,
    playW: w,
    feltH,
    cardW,
    cardH,
    dealerY,
    handY: 0,
    handYActive: 0,
    badgeAbove: 19,
    midY,
    midH,
    stakeY: 0,
    circle: { x: Math.round(w / 2), y: betYPlay, r: 14 },
    shoe: { x: w - 52, y: 4 },
    shoeOrigin: { x: w - 26, y: 20 },
    fan: 14,
    handGap: 24,
    edge: 10,
    maxRowW: w - 2 * 10,
    rowH: 88,
    minStep: 8,
    actionTop,
    chipRowTop,
    chipRowH,
    actionH,
    betYBetting,
    betYPlay,
    handAreaTop: midY + midH + 2,
    handAreaBottom: betYPlay - 14 - 2,
  }
}

export interface BlackjackHandLayout {
  index: number
  left: number
  step: number
  top: number
  centerX: number
  width: number
}

function rowGeometry(row: readonly Hand[], ly: BlackjackLayout): { step: number; widths: number[]; lefts: number[]; totalW: number } {
  const overlaps = row.reduce((n, h) => n + h.cards.length - 1, 0)
  const fixed = ly.cardW * row.length + ly.handGap * (row.length - 1)
  const step = overlaps > 0 ? Math.min(ly.fan, Math.floor((ly.maxRowW - fixed) / overlaps)) : ly.fan
  const widths = row.map((h) => ly.cardW + step * (h.cards.length - 1))
  const totalW = widths.reduce((a, b) => a + b, 0) + ly.handGap * (row.length - 1)
  let left = Math.round((ly.playW - totalW) / 2)
  const lefts = widths.map((w) => {
    const l = left
    left += w + ly.handGap
    return l
  })
  return { step, widths, lefts, totalW }
}

/**
 * Card slots for every hand, in felt x/y. Landscape keeps the original
 * single-row formula; portrait keeps hands in one centred row while they fit,
 * otherwise stacks two rows and centres the block between the banner and the
 * bet area.
 */
export function layoutBlackjackHands(
  hands: readonly Hand[],
  active: number,
  phase: Phase,
  ly: BlackjackLayout,
): BlackjackHandLayout[] {
  if (hands.length === 0) return []
  const activeIdx = phase === 'player' ? active : -1
  let rows: readonly (readonly Hand[])[]
  if (ly.portrait) {
    const single = rowGeometry(hands, ly)
    if (single.totalW <= ly.maxRowW && single.step >= ly.minStep) rows = [hands]
    else {
      const cut = Math.ceil(hands.length / 2)
      rows = [hands.slice(0, cut), hands.slice(cut)]
    }
  } else {
    rows = [hands]
  }
  let baseY = ly.handY
  if (ly.portrait) {
    const blockH = 23 + (rows.length - 1) * ly.rowH + ly.cardH + 8
    const slack = Math.max(0, Math.floor((ly.handAreaBottom - ly.handAreaTop - blockH) / 2))
    baseY = ly.handAreaTop + 23 + slack
  }
  const out: BlackjackHandLayout[] = []
  let index = 0
  rows.forEach((row, rowIndex) => {
    const geo = rowGeometry(row, ly)
    row.forEach((_, i) => {
      const handIndex = index + i
      out.push({
        index: handIndex,
        left: geo.lefts[i],
        step: geo.step,
        top: baseY + rowIndex * ly.rowH + (handIndex === activeIdx ? -4 : 0),
        centerX: Math.round(geo.lefts[i] + geo.widths[i] / 2),
        width: geo.widths[i],
      })
    })
    index += row.length
  })
  return out
}
