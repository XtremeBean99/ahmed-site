import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Card, Rank, Suit } from './cards'
import {
  addChip,
  canDouble,
  canInsure,
  canSplit,
  createTable,
  deal,
  dealerShouldHit,
  dealerStep,
  double,
  handValue,
  hit,
  insure,
  isBlackjack,
  newBet,
  rebet,
  rebuy,
  split,
  stand,
  type BlackjackState,
  type Hand,
} from './blackjack-engine'

const C = (rank: number, suit: Suit = 'S'): Card => ({ rank: rank as Rank, suit })
const rng = () => 0.5

/** A betting state with a stacked shoe. cards[0] is dealt first (player card 1). */
function tableWith(cards: Card[], bankroll = 1000, bet = 25): BlackjackState {
  return {
    phase: 'betting',
    shoe: [...cards].reverse(),
    shoeSize: cards.length,
    discards: 0,
    bankroll,
    bet,
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

const doneHand = (cards: Card[], over: Partial<Hand> = {}): Hand => ({
  cards,
  bet: 25,
  doubled: false,
  fromSplit: false,
  splitAces: false,
  done: true,
  ...over,
})

test('hand values: hard totals and soft aces', () => {
  assert.deepEqual(handValue([C(10), C(7)]), { total: 17, soft: false })
  assert.deepEqual(handValue([C(1), C(6)]), { total: 17, soft: true })
  assert.deepEqual(handValue([C(1), C(10)]), { total: 21, soft: true })
})

test('hand values: several aces count one as 11, never bust', () => {
  assert.deepEqual(handValue([C(1), C(1), C(1)]), { total: 13, soft: true })
  assert.deepEqual(handValue([C(1), C(1), C(9)]), { total: 21, soft: true })
  assert.deepEqual(handValue([C(1), C(1), C(1), C(1), C(10)]), { total: 14, soft: false })
})

test('blackjack is exactly a two-card 21 on a non-split hand', () => {
  assert.equal(isBlackjack(doneHand([C(1), C(13)], { fromSplit: false })), true)
  assert.equal(isBlackjack(doneHand([C(10), C(10)], { fromSplit: false })), false)
  assert.equal(isBlackjack(doneHand([C(7), C(7), C(7)], { fromSplit: false })), false)
  assert.equal(isBlackjack(doneHand([C(1), C(13)], { fromSplit: true })), false)
})

test('deal order: player, up card, player, hole; stake leaves the bankroll', () => {
  const s = deal(tableWith([C(10), C(6), C(9), C(8)]), rng)
  assert.equal(s.phase, 'player')
  assert.equal(s.holeRevealed, false)
  assert.deepEqual(s.hands[0].cards, [C(10), C(9)])
  assert.deepEqual(s.dealer, [C(6), C(8)])
  assert.equal(s.bankroll, 975)
  assert.equal(s.discards, 4)
})

test('player blackjack with no dealer blackjack pays 3:2 at once', () => {
  const s = deal(tableWith([C(1), C(9), C(13), C(8)]), rng)
  assert.equal(s.phase, 'settled')
  assert.equal(s.hands[0].outcome, 'blackjack')
  assert.equal(s.hands[0].payout, 37.5)
  assert.equal(s.bankroll, 1037.5)
})

test('dealer peeks on a ten and reveals a blackjack', () => {
  const s = deal(tableWith([C(8), C(10), C(9), C(1)]), rng)
  assert.equal(s.phase, 'settled')
  assert.equal(s.holeRevealed, true)
  assert.equal(s.hands[0].outcome, 'lose')
  assert.equal(s.bankroll, 975)
})

test('an Ace up peeks without an insurance offer when it is unaffordable', () => {
  const s = deal(tableWith([C(8), C(1), C(9), C(13)], 600, 500), rng)
  assert.equal(s.phase, 'settled')
  assert.equal(s.holeRevealed, true)
  assert.equal(s.hands[0].outcome, 'lose')
  assert.equal(s.bankroll, 100)
})

test('an affordable Ace up offers insurance before the peek', () => {
  const s = deal(tableWith([C(7), C(1), C(8), C(13)], 1000, 100), rng)
  assert.equal(s.phase, 'insurance')
  assert.equal(s.holeRevealed, false)
  assert.equal(s.bankroll, 900)
  assert.equal(canInsure(s), true)
})

test('taking insurance pays 2:1 and loses only the insurance net of the bet', () => {
  const dealt = deal(tableWith([C(7), C(1), C(8), C(13)], 1000, 100), rng)
  const s = insure(dealt, true)
  assert.equal(s.phase, 'settled')
  assert.equal(s.holeRevealed, true)
  assert.equal(s.insurance, 50)
  assert.equal(s.insurancePaid, 50)
  assert.equal(s.hands[0].outcome, 'lose')
  assert.equal(s.bankroll, 1000)
})

test('declining insurance keeps the hole hidden and plays on', () => {
  const dealt = deal(tableWith([C(7), C(1), C(8), C(9)], 1000, 100), rng)
  const s = insure(dealt, false)
  assert.equal(s.phase, 'player')
  assert.equal(s.holeRevealed, false)
  assert.equal(s.insurance, 0)
  assert.equal(s.bankroll, 900)
})

test('the dealer stands on all 17s including soft 17, and hits 16', () => {
  assert.equal(dealerShouldHit([C(10), C(6)]), true)
  assert.equal(dealerShouldHit([C(1), C(6)]), false)
  assert.equal(dealerShouldHit([C(10), C(7)]), false)
  assert.equal(dealerShouldHit([C(1), C(6), C(10)]), false)
})

test('double takes exactly one card and doubles the stake', () => {
  const dealt = deal(tableWith([C(5), C(6), C(6), C(8), C(10)]), rng)
  const s = double(dealt, rng)
  assert.equal(s.hands[0].doubled, true)
  assert.equal(s.hands[0].bet, 50)
  assert.deepEqual(s.hands[0].cards, [C(5), C(6), C(10)])
  assert.equal(s.hands[0].done, true)
  assert.equal(s.bankroll, 950)
  assert.equal(s.phase, 'dealer')
})

test('a double that busts loses the doubled stake', () => {
  const dealt = deal(tableWith([C(10), C(6), C(6), C(8), C(9)]), rng)
  const s = double(dealt, rng)
  assert.equal(s.hands[0].outcome, 'bust')
  assert.equal(s.hands[0].payout, 0)
  assert.equal(s.bankroll, 950)
})

test('hitting to a bust loses immediately and moves on', () => {
  const dealt = deal(tableWith([C(10), C(6), C(6), C(8), C(9)]), rng)
  const s = hit(dealt, rng)
  assert.equal(s.hands[0].outcome, 'bust')
  assert.equal(s.hands[0].done, true)
  assert.equal(s.phase, 'dealer')
  assert.equal(s.bankroll, 975)
})

test('hitting to 21 completes the hand', () => {
  const dealt = deal(tableWith([C(10), C(6), C(6), C(8), C(5)]), rng)
  const s = hit(dealt, rng)
  assert.equal(handValue(s.hands[0].cards).total, 21)
  assert.equal(s.hands[0].done, true)
  assert.equal(s.hands[0].outcome, undefined)
  assert.equal(s.phase, 'dealer')
})

test('stand marks the hand done and hands over to the dealer', () => {
  const dealt = deal(tableWith([C(10), C(6), C(8), C(9)]), rng)
  const s = stand(dealt)
  assert.equal(s.hands[0].done, true)
  assert.equal(s.phase, 'dealer')
})

test('an equal total pushes and returns the stake', () => {
  const s: BlackjackState = {
    phase: 'dealer',
    shoe: [],
    shoeSize: 312,
    discards: 4,
    bankroll: 975,
    bet: 25,
    hands: [doneHand([C(10), C(7)])],
    active: 0,
    dealer: [C(10), C(7)],
    holeRevealed: true,
    insurance: 0,
    insurancePaid: 0,
    shuffled: false,
    rebuys: 0,
    handsPlayed: 0,
  }
  const settled = dealerStep(s, rng)
  assert.equal(settled.phase, 'settled')
  assert.equal(settled.hands[0].outcome, 'push')
  assert.equal(settled.bankroll, 1000)
})

test('a dealer bust pays every live hand 1:1', () => {
  const s: BlackjackState = {
    phase: 'dealer',
    shoe: [C(9)],
    shoeSize: 312,
    discards: 4,
    bankroll: 975,
    bet: 25,
    hands: [doneHand([C(10), C(8)])],
    active: 0,
    dealer: [C(10), C(6)],
    holeRevealed: true,
    insurance: 0,
    insurancePaid: 0,
    shuffled: false,
    rebuys: 0,
    handsPlayed: 0,
  }
  const drawing = dealerStep(s, rng)
  assert.equal(drawing.phase, 'dealer')
  assert.deepEqual(drawing.dealer, [C(10), C(6), C(9)])
  const settled = dealerStep(drawing, rng)
  assert.equal(settled.phase, 'settled')
  assert.equal(settled.hands[0].outcome, 'win')
  assert.equal(settled.hands[0].payout, 25)
  assert.equal(settled.bankroll, 1025)
})

test('split turns a pair into two hands and stakes the second', () => {
  const dealt = deal(tableWith([C(8), C(6), C(8), C(9), C(10), C(7)]), rng)
  const s = split(dealt, rng)
  assert.equal(s.hands.length, 2)
  assert.deepEqual(s.hands[0].cards, [C(8), C(10)])
  assert.deepEqual(s.hands[1].cards, [C(8), C(7)])
  assert.equal(s.hands[0].fromSplit, true)
  assert.equal(s.hands[1].bet, 25)
  assert.equal(s.bankroll, 950)
  assert.equal(s.phase, 'player')
  assert.equal(s.active, 0)
})

test('split Aces get exactly one card each, stand, and 21 is not blackjack', () => {
  const dealt = deal(tableWith([C(1), C(6), C(1), C(9), C(10), C(13)]), rng)
  const s = split(dealt, rng)
  assert.equal(s.hands.length, 2)
  assert.deepEqual(s.hands[0].cards, [C(1), C(10)])
  assert.deepEqual(s.hands[1].cards, [C(1), C(13)])
  assert.equal(s.hands[0].splitAces, true)
  assert.equal(s.hands[0].done, true)
  assert.equal(s.hands[1].done, true)
  assert.equal(isBlackjack(s.hands[0]), false)
  assert.equal(s.phase, 'dealer')
})

test('split is refused once four hands are on the table', () => {
  const s: BlackjackState = {
    phase: 'player',
    shoe: [],
    shoeSize: 312,
    discards: 0,
    bankroll: 900,
    bet: 25,
    hands: [
      doneHand([C(8), C(8)], { done: false }),
      doneHand([C(8), C(9)], { fromSplit: true, done: false }),
      doneHand([C(8), C(9)], { fromSplit: true, done: false }),
      doneHand([C(8), C(9)], { fromSplit: true, done: false }),
    ],
    active: 0,
    dealer: [C(6)],
    holeRevealed: false,
    insurance: 0,
    insurancePaid: 0,
    shuffled: false,
    rebuys: 0,
    handsPlayed: 0,
  }
  assert.equal(canSplit(s), false)
  assert.equal(split(s, rng), s)
})

test('a two-card hand after a split may double', () => {
  const dealt = deal(tableWith([C(8), C(6), C(8), C(9), C(10), C(7)]), rng)
  const s = split(dealt, rng)
  assert.equal(canDouble(s), true)
  assert.equal(s.hands[0].cards.length, 2)
})

test('the shoe reshuffles before a deal under 25 % penetration, not at 25 %', () => {
  const shoe77 = Array.from({ length: 77 }, (_, i) => C((i % 13) + 1))
  const under = { ...tableWith([], 1000, 25), shoe: shoe77, shoeSize: 312 }
  const reshuffled = deal(under, rng)
  assert.equal(reshuffled.shuffled, true)
  assert.equal(reshuffled.shoe.length, 308)
  assert.equal(reshuffled.discards, 4)

  const shoe78 = Array.from({ length: 78 }, (_, i) => C((i % 13) + 1))
  const at = { ...tableWith([], 1000, 25), shoe: shoe78, shoeSize: 312 }
  assert.equal(deal(at, rng).shuffled, false)
})

test('chips never take the bet past the bankroll or the 500 maximum', () => {
  const broke = createTable(rng, 30)
  assert.equal(addChip(broke, 25).bet, 25)
  assert.equal(addChip(addChip(broke, 25), 25).bet, 30)

  const rich = createTable(rng, 1000)
  assert.equal(addChip(rich, 500).bet, 500)
  assert.equal(addChip(addChip(rich, 500), 500).bet, 500)

  const dealt = deal(tableWith([C(10), C(6), C(9), C(8)]), rng)
  assert.equal(addChip(dealt, 5), dealt)
})

test('bankroll plus stakes out stays constant through a round', () => {
  const staked = (s: BlackjackState) =>
    s.bankroll + s.hands.reduce((sum, h) => sum + h.bet, 0) + s.insurancePaid
  let s = deal(tableWith([C(10), C(6), C(8), C(7), C(9)], 1000, 100), rng)
  assert.equal(staked(s), 1000)
  s = hit(s, rng)
  assert.equal(s.hands[0].outcome, 'bust')
  assert.equal(staked(s), 1000)
})

test('rebuy resets a broke player to 1000 and counts it', () => {
  const broke = { ...createTable(rng), bankroll: 0 }
  const s = rebuy(broke)
  assert.equal(s.bankroll, 1000)
  assert.equal(s.rebuys, 1)

  const rich = createTable(rng, 50)
  assert.equal(rebuy(rich), rich)
  const midHand = { ...broke, phase: 'player' as const }
  assert.equal(rebuy(midHand), midHand)
})

test('deal refuses a bet below 5 or above the bankroll', () => {
  const noBet = createTable(rng)
  assert.equal(deal(noBet, rng), noBet)

  const tooBig = { ...createTable(rng, 10), bet: 25 }
  assert.equal(deal(tooBig, rng), tooBig)
})

test('rebet deals the same bet again; newBet clears the table', () => {
  const settled: BlackjackState = {
    phase: 'settled',
    shoe: [...[C(10), C(6), C(9), C(8)]].reverse(),
    shoeSize: 4,
    discards: 4,
    bankroll: 1000,
    bet: 25,
    hands: [doneHand([C(10), C(9)], { outcome: 'win', payout: 25 })],
    active: 0,
    dealer: [C(6), C(8)],
    holeRevealed: true,
    insurance: 0,
    insurancePaid: 0,
    shuffled: false,
    rebuys: 0,
    handsPlayed: 3,
  }
  const again = rebet(settled, rng)
  assert.equal(again.phase, 'player')
  assert.equal(again.hands[0].bet, 25)
  assert.equal(again.handsPlayed, 3)

  const fresh = newBet(settled)
  assert.equal(fresh.phase, 'betting')
  assert.equal(fresh.bet, 0)
  assert.deepEqual(fresh.hands, [])
  assert.deepEqual(fresh.dealer, [])

  const broke = { ...settled, bankroll: 10 }
  assert.equal(rebet(broke, rng), broke)
})
