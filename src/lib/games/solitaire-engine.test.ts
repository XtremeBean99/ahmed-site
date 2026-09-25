import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  autoFinishStep,
  autoTarget,
  canAutoFinish,
  canMove,
  deal,
  draw,
  finish,
  move,
  type Loc,
  type SolitaireState,
  type TableauPile,
} from './solitaire-engine'
import { cardId, mulberry32, type Card, type Suit } from './cards'

const c = (rank: number, suit: Suit): Card => ({ rank: rank as Card['rank'], suit })
const S = (rank: number): Card => c(rank, 'S')
const H = (rank: number): Card => c(rank, 'H')
const D = (rank: number): Card => c(rank, 'D')
const C = (rank: number): Card => c(rank, 'C')

const emptyTableau = (): TableauPile[] => Array.from({ length: 7 }, () => ({ down: [], up: [] }))

function state(overrides: Partial<SolitaireState> = {}): SolitaireState {
  return {
    stock: [],
    waste: [],
    foundations: [[], [], [], []],
    tableau: emptyTableau(),
    drawCount: 1,
    score: 0,
    moves: 0,
    recycles: 0,
    won: false,
    ...overrides,
  }
}

const waste: Loc = { pile: 'waste' }
const foundation = (index: number): Loc => ({ pile: 'foundation', index })
const tableau = (index: number, card: number): Loc => ({ pile: 'tableau', index, card })

const snapshot = (s: SolitaireState) => JSON.parse(JSON.stringify(s)) as SolitaireState

test('deal lays out 24 stock cards and pile i with i down cards and one up card', () => {
  const s = deal(Math.random, 1)
  assert.equal(s.stock.length, 24)
  assert.equal(s.waste.length, 0)
  assert.equal(s.moves, 0)
  assert.equal(s.score, 0)
  assert.equal(s.recycles, 0)
  assert.equal(s.won, false)
  s.tableau.forEach((pile, i) => {
    assert.equal(pile.down.length, i)
    assert.equal(pile.up.length, 1)
  })
  const tableauCards = s.tableau.reduce((n, p) => n + p.down.length + p.up.length, 0)
  assert.equal(tableauCards, 28)
})

test('deal uses every card of one deck exactly once and replays from a seed', () => {
  const a = deal(mulberry32(42), 1)
  const b = deal(mulberry32(42), 1)
  const c2 = deal(mulberry32(7), 1)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a, c2)
  const ids = [
    ...a.stock,
    ...a.waste,
    ...a.foundations.flat(),
    ...a.tableau.flatMap((p) => [...p.down, ...p.up]),
  ].map(cardId)
  assert.equal(new Set(ids).size, 52)
  assert.equal(ids.length, 52)
})

test('tableau builds down in alternating colours', () => {
  const s = state({ tableau: [{ down: [], up: [C(6)] }, { down: [], up: [H(7)] }, ...emptyTableau().slice(2)] })
  assert.equal(canMove(s, tableau(0, 0), tableau(1, 0)), true, 'red 6 onto black 7')
  assert.equal(canMove(s, tableau(1, 0), tableau(0, 0)), false, 'black 7 onto red 6')
  const sameColour = state({ tableau: [{ down: [], up: [S(6)] }, { down: [], up: [S(7)] }, ...emptyTableau().slice(2)] })
  assert.equal(canMove(sameColour, tableau(0, 0), tableau(1, 0)), false)
})

test('an empty tableau pile takes only a King or a sequence starting with a King', () => {
  const s = state({ tableau: [{ down: [], up: [D(10)] }, { down: [], up: [] }, { down: [], up: [S(13), H(12)] }, ...emptyTableau().slice(3)] })
  assert.equal(canMove(s, tableau(0, 0), tableau(1, 0)), false)
  assert.equal(canMove(s, tableau(2, 0), tableau(1, 0)), true, 'run starting with a King')
  assert.equal(canMove(s, tableau(2, 1), tableau(1, 0)), false, 'run without its King')
})

test('foundations build up by suit from the Ace', () => {
  const s = state({ waste: [H(2)], foundations: [[H(1)], [], [], []] })
  assert.equal(canMove(s, waste, foundation(0)), true)
  assert.equal(canMove(s, { pile: 'waste' }, foundation(1)), false, '2 is not an Ace')
  const wrongSuit = state({ waste: [S(2)], foundations: [[H(1)], [], [], []] })
  assert.equal(canMove(wrongSuit, waste, foundation(0)), false)
  const wrongRank = state({ waste: [H(3)], foundations: [[H(1)], [], [], []] })
  assert.equal(canMove(wrongRank, waste, foundation(0)), false)
})

test('only one card at a time goes to a foundation', () => {
  const s = state({
    foundations: [[H(1), H(2), H(3)], [], [], []],
    tableau: [{ down: [], up: [C(5), H(4)] }, ...emptyTableau().slice(1)],
  })
  assert.equal(canMove(s, tableau(0, 0), foundation(0)), false, 'two-card run')
  assert.equal(canMove(s, tableau(0, 1), foundation(0)), true, 'top card only')
})

test('a face-up sequence moves as a unit and lands on the right target', () => {
  const s = state({
    tableau: [
      { down: [], up: [C(13), H(12), S(11), D(10)] },
      { down: [], up: [S(13)] },
      ...emptyTableau().slice(2),
    ],
  })
  const next = move(s, tableau(0, 1), tableau(1, 0))
  assert.ok(next)
  assert.deepEqual(next!.tableau[0].up.map(cardId), [C(13)].map(cardId))
  assert.deepEqual(next!.tableau[1].up.map(cardId), [S(13), H(12), S(11), D(10)].map(cardId))
})

test('foundation cards may move back to the tableau with the -15 penalty', () => {
  const s = state({ foundations: [[C(1), C(2)], [], [], []], tableau: [{ down: [], up: [H(3)] }, ...emptyTableau().slice(1)], score: 20 })
  assert.equal(canMove(s, foundation(0), tableau(0, 0)), true)
  const next = move(s, foundation(0), tableau(0, 0))
  assert.ok(next)
  assert.equal(next!.score, 5)
  assert.deepEqual(next!.foundations[0].map(cardId), [C(1)].map(cardId))
  const kingToEmpty = state({ foundations: [[C(13)], [], [], []], tableau: [{ down: [], up: [] }, ...emptyTableau().slice(1)] })
  assert.equal(canMove(kingToEmpty, foundation(0), tableau(0, 0)), true)
  const noKing = state({ foundations: [[C(5)], [], [], []], tableau: [{ down: [], up: [] }, ...emptyTableau().slice(1)] })
  assert.equal(canMove(noKing, foundation(0), tableau(0, 0)), false)
})

test('moving the last face-up card flips the next down card and scores +5', () => {
  const s = state({
    foundations: [[S(1), S(2), S(3), S(4), S(5), S(6), S(7)], [], [], []],
    tableau: [{ down: [H(9)], up: [S(8)] }, ...emptyTableau().slice(1)],
  })
  const next = move(s, tableau(0, 0), foundation(0))
  assert.ok(next)
  assert.equal(next!.score, 15, '10 for the move and 5 for the flip')
  assert.equal(next!.tableau[0].down.length, 0)
  assert.deepEqual(next!.tableau[0].up.map(cardId), [H(9)].map(cardId))
})

test('no flip happens when face-up cards remain', () => {
  const s = state({
    foundations: [[H(1), H(2), H(3)], [], [], []],
    tableau: [{ down: [S(9)], up: [C(5), H(4)] }, ...emptyTableau().slice(1)],
  })
  const next = move(s, tableau(0, 1), foundation(0))
  assert.ok(next)
  assert.equal(next!.score, 10)
  assert.equal(next!.tableau[0].down.length, 1)
  assert.equal(next!.tableau[0].up.length, 1)
})

test('draw turns drawCount cards, fewer when the stock is short', () => {
  const one = state({ stock: [S(1), S(2), S(3), S(4)], drawCount: 1 })
  const a = draw(one)
  assert.deepEqual(a!.waste.map(cardId), [S(4)].map(cardId))
  assert.equal(a!.stock.length, 3)

  const three = state({ stock: [S(1), S(2), S(3), S(4), S(5)], drawCount: 3 })
  const b = draw(three)
  assert.deepEqual(b!.waste.map(cardId), [S(3), S(4), S(5)].map(cardId))
  assert.equal(b!.stock.length, 2)
  const short = draw(b!)
  assert.deepEqual(short!.waste.map(cardId), [S(3), S(4), S(5), S(1), S(2)].map(cardId))
  assert.equal(short!.stock.length, 0)
})

test('recycling restores the pass order and applies the draw-mode penalty', () => {
  const one = state({ stock: [S(1), S(2), S(3)], drawCount: 1, score: 40 })
  let s = draw(one)!
  s = draw(s)!
  s = draw(s)!
  assert.equal(s.stock.length, 0)
  const recycled = draw(s)!
  assert.deepEqual(recycled.stock.map(cardId), [S(1), S(2), S(3)].map(cardId))
  assert.equal(recycled.recycles, 1)
  assert.equal(recycled.score, 0, '40 - 100 floors at 0')
  const nextDraw = draw(recycled)!
  assert.deepEqual(nextDraw.waste.map(cardId), [S(3)].map(cardId), 'the next pass deals the same card first')

  const three = state({ stock: [S(1), S(2), S(3), S(4), S(5)], drawCount: 3, score: 60 })
  let t = draw(three)!
  t = draw(t)!
  const recycled3 = draw(t)!
  assert.equal(recycled3.recycles, 1)
  assert.equal(recycled3.score, 40, '60 - 20')
  assert.deepEqual(recycled3.stock.map(cardId), [S(2), S(1), S(5), S(4), S(3)].map(cardId))
  const next3 = draw(recycled3)!
  assert.deepEqual(next3.waste.map(cardId), [S(5), S(4), S(3)].map(cardId), 'the next pass deals the same sequence first')
})

test('draw returns null when the stock and waste are both empty', () => {
  const s = state()
  assert.equal(draw(s), null)
  assert.equal(draw(state({ won: true, stock: [S(1)] })), null, 'no drawing after a win')
})

test('windows scoring: waste to tableau +5, waste to foundation +10, tableau to foundation +10', () => {
  const a = state({ waste: [C(9)], tableau: [{ down: [], up: [H(10)] }, ...emptyTableau().slice(1)] })
  assert.equal(move(a, waste, tableau(0, 0))!.score, 5)

  const b = state({ waste: [C(2)], foundations: [[C(1)], [], [], []] })
  assert.equal(move(b, waste, foundation(0))!.score, 10)

  const d = state({ foundations: [[C(1), C(2), C(3)], [], [], []], tableau: [{ down: [], up: [C(4)] }, ...emptyTableau().slice(1)] })
  assert.equal(move(d, tableau(0, 0), foundation(0))!.score, 10)
})

test('score never drops below 0 on a foundation to tableau move', () => {
  const s = state({ foundations: [[C(1), C(2)], [], [], []], tableau: [{ down: [], up: [H(3)] }, ...emptyTableau().slice(1)], score: 10 })
  assert.equal(move(s, foundation(0), tableau(0, 0))!.score, 0)
})

test('autoTarget prefers a foundation, then a non-empty tableau, then an empty one', () => {
  const s = state({ waste: [C(2)], foundations: [[C(1)], [], [], []], tableau: [{ down: [], up: [] }, { down: [], up: [H(3)] }, ...emptyTableau().slice(2)] })
  assert.deepEqual(autoTarget(s, waste), foundation(0))

  const noFoundation = state({ waste: [C(2)], tableau: [{ down: [], up: [] }, { down: [], up: [H(3)] }, { down: [], up: [] }, { down: [], up: [S(3)] }, ...emptyTableau().slice(4)] })
  assert.deepEqual(autoTarget(noFoundation, waste), tableau(1, 0), 'first legal non-empty pile')

  const onlyEmpty = state({ waste: [S(13)], tableau: emptyTableau() })
  assert.deepEqual(autoTarget(onlyEmpty, waste), tableau(0, 0))

  const stuck = state({ waste: [H(5)], tableau: emptyTableau() })
  assert.equal(autoTarget(stuck, waste), null)
})

test('canAutoFinish needs an empty stock and waste and no face-down cards', () => {
  assert.equal(canAutoFinish(state()), true)
  assert.equal(canAutoFinish(state({ stock: [S(1)] })), false)
  assert.equal(canAutoFinish(state({ waste: [S(1)] })), false)
  assert.equal(canAutoFinish(state({ tableau: [{ down: [S(1)], up: [] }, ...emptyTableau().slice(1)] })), false)
})

test('autoFinishStep moves the lowest-ranked foundation candidate one card per call', () => {
  const s = state({
    foundations: [[H(1), H(2)], [C(1), C(2), C(3), C(4), C(5), C(6)], [], []],
    tableau: [
      { down: [], up: [C(7)] },
      { down: [], up: [H(3)] },
      ...emptyTableau().slice(2),
    ],
  })
  const next = autoFinishStep(s)
  assert.ok(next)
  assert.deepEqual(next!.foundations[0].map(cardId), [H(1), H(2), H(3)].map(cardId), '3 moves before 7')
  assert.deepEqual(next!.tableau[1].up, [])
})

test('autoFinishStep drives a prepared game to a win', () => {
  const foundations = [S, H, D, C].map((suit) => Array.from({ length: 12 }, (_, i) => suit(i + 1)))
  const s = state({
    foundations,
    tableau: [
      { down: [], up: [S(13)] },
      { down: [], up: [H(13)] },
      { down: [], up: [D(13)] },
      { down: [], up: [C(13)] },
      ...emptyTableau().slice(4),
    ],
  })
  assert.equal(canAutoFinish(s), true)
  let cur = s
  for (let i = 0; i < 4; i++) {
    const next = autoFinishStep(cur)
    assert.ok(next, `step ${i + 1}`)
    cur = next!
  }
  assert.equal(cur.won, true)
  assert.equal(autoFinishStep(cur), null)
})

test('finish adds the time bonus only from 30 seconds and marks the game won', () => {
  const s = state({ score: 100 })
  assert.equal(finish(s, 29).score, 100)
  assert.equal(finish(s, 30).score, 100 + 23333)
  assert.equal(finish(s, 100).score, 100 + 7000)
  assert.equal(finish(s, 100).won, true)
})

test('illegal moves return null', () => {
  const s = state({ waste: [C(9)], tableau: [{ down: [], up: [H(10)] }, ...emptyTableau().slice(1)] })
  assert.equal(move(state(), waste, tableau(0, 0)), null, 'empty waste')
  assert.equal(move(s, tableau(0, 0), tableau(0, 0)), null, 'same pile')
  assert.equal(move(s, waste, foundation(0)), null, '9 is not an Ace')
  assert.equal(move(s, tableau(0, 5), tableau(1, 0)), null, 'bad card index')
  assert.equal(move(s, waste, { pile: 'tableau', index: 9, card: 0 }), null, 'bad pile index')
  assert.equal(move({ ...s, won: true }, waste, tableau(0, 0)), null, 'won game')
})

test('every action returns new state and leaves the input untouched', () => {
  const s = state({
    stock: [S(1), S(2), S(3)],
    waste: [C(9)],
    foundations: [[C(1)], [], [], []],
    tableau: [{ down: [H(9)], up: [C(10), H(10)] }, ...emptyTableau().slice(1)],
    score: 12,
  })
  const before = snapshot(s)

  draw(s)
  assert.deepEqual(s, before)

  move(s, waste, { pile: 'tableau', index: 0, card: 0 })
  assert.deepEqual(s, before)

  autoTarget(s, waste)
  autoFinishStep(s)
  canAutoFinish(s)
  assert.deepEqual(s, before)
})

test('moves increment on draw, recycle and card moves', () => {
  const s = state({ stock: [S(1)], waste: [C(9)], tableau: [{ down: [], up: [H(10)] }, ...emptyTableau().slice(1)] })
  assert.equal(draw(s)!.moves, 1)
  const afterDraw = draw(s)!
  assert.equal(draw(afterDraw)!.moves, 2, 'the recycle also counts as a move')
  assert.equal(move(s, waste, tableau(0, 0))!.moves, 1)
})

test('waste to tableau and waste to foundation take only the waste top', () => {
  const s = state({ waste: [C(8), C(9)], tableau: [{ down: [], up: [H(10)] }, ...emptyTableau().slice(1)] })
  const next = move(s, waste, tableau(0, 0))
  assert.ok(next)
  assert.deepEqual(next!.waste.map(cardId), [C(8)].map(cardId))
  assert.deepEqual(next!.tableau[0].up.map(cardId), [H(10), C(9)].map(cardId))
})
