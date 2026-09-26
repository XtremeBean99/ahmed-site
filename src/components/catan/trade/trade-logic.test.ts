import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_OFFERS_PER_TURN, RESOURCES } from '@/lib/games/catan/constants'
import { applyAction } from '@/lib/games/catan/engine'
import { EDGES, PORT_EDGES } from '@/lib/games/catan/geometry'
import { give, makeTestState, putSettlement, res } from '@/lib/games/catan/test-fixtures'
import type { Action, GameState } from '@/lib/games/catan/types'
import {
  canOffer,
  maritimeOptions,
  offerBlockReason,
  offerFromMySide,
  replyRows,
  stepTradeTerms,
} from './trade-logic'

function mainState(): GameState {
  const state = makeTestState({ phase: { kind: 'main' }, current: 0 })
  give(state, 0, res({ brick: 4, wool: 3, lumber: 1 }))
  return state
}

function optionsFor(state: GameState, give: 'brick' | 'lumber' | 'wool' | 'grain' | 'ore') {
  return maritimeOptions(state, 0).filter((o) => o.give === give)
}

test('maritimeOptions gives the base 4:1 rate without harbours', () => {
  const state = mainState()
  const brick = optionsFor(state, 'brick')
  assert.equal(brick.length, 4)
  assert.deepEqual(
    brick.map((o) => o.get),
    ['lumber', 'wool', 'grain', 'ore'],
  )
  for (const o of brick) {
    assert.equal(o.rate, 4)
    assert.equal(o.harbour, null)
  }
})

test('maritimeOptions skips resources the player cannot afford and the resource being sold', () => {
  const state = mainState()
  const wool = optionsFor(state, 'wool')
  assert.ok(wool.every((o) => o.get !== 'wool'))
  assert.ok(!wool.some((o) => o.get === 'wool'))
  const ore = optionsFor(state, 'ore')
  assert.equal(ore.length, 0)
})

test('maritimeOptions skips resources the bank has run out of', () => {
  const state = mainState()
  state.bank.ore = 0
  const brick = optionsFor(state, 'brick')
  assert.ok(!brick.some((o) => o.get === 'ore'))
})

test('maritimeOptions applies a 3:1 harbour and a 2:1 resource harbour', () => {
  const state = mainState()
  putSettlement(state, 0, EDGES[PORT_EDGES[0]].vertices[0])
  putSettlement(state, 0, EDGES[PORT_EDGES[6]].vertices[1])

  const brick = optionsFor(state, 'brick')
  for (const o of brick) {
    assert.equal(o.rate, 3)
    assert.equal(o.harbour, 'any')
  }

  const wool = optionsFor(state, 'wool')
  for (const o of wool) {
    assert.equal(o.rate, 2)
    assert.equal(o.harbour, 'wool')
  }
})

test('offerBlockReason reports roll first, no offers, no cards, and non-main phases', () => {
  const preRoll = makeTestState({ phase: { kind: 'preRoll' }, current: 0 })
  assert.equal(offerBlockReason(preRoll, 0), 'rollFirst')

  const noCards = makeTestState({ phase: { kind: 'main' }, current: 0 })
  assert.equal(offerBlockReason(noCards, 0), 'noCards')

  const capped = mainState()
  capped.offersThisTurn = MAX_OFFERS_PER_TURN
  assert.equal(offerBlockReason(capped, 0), 'noOffers')

  const discarding = makeTestState({ phase: { kind: 'discard', discards: [0, 0, 0, 0] }, current: 0 })
  assert.equal(offerBlockReason(discarding, 0), 'notMain')
})

test('canOffer accepts a legal offer and rejects every rule break', () => {
  const state = mainState()
  assert.equal(canOffer(state, 0, res({ brick: 2 }), res({ ore: 1 }), [1, 2]), true)

  const preRoll = makeTestState({ phase: { kind: 'preRoll' }, current: 0 })
  give(preRoll, 0, res({ brick: 2 }))
  assert.equal(canOffer(preRoll, 0, res({ brick: 2 }), res({ ore: 1 }), [1]), false)

  assert.equal(canOffer(state, 0, res({}), res({ ore: 1 }), [1]), false)
  assert.equal(canOffer(state, 0, res({ brick: 1 }), res({}), [1]), false)
  assert.equal(canOffer(state, 0, res({ brick: 1 }), res({ brick: 1 }), [1]), false)
  assert.equal(canOffer(state, 0, res({ brick: 99 }), res({ ore: 1 }), [1]), false)
  assert.equal(canOffer(state, 0, res({ brick: 1 }), res({ ore: 1 }), []), false)
  assert.equal(canOffer(state, 0, res({ brick: 1 }), res({ ore: 1 }), [1, 1]), false)
  assert.equal(canOffer(state, 0, res({ brick: 1 }), res({ ore: 1 }), [0]), false)
  assert.equal(canOffer(state, 0, res({ brick: 1 }), res({ ore: 1 }), [99]), false)
})

test('offerFromMySide flips terms for a recipient and keeps them for the proposer', () => {
  const state = mainState()
  const action: Action = { type: 'proposeTrade', to: [1, 2], give: res({ brick: 2 }), get: res({ ore: 1 }) }
  const next = applyAction(state, action)
  assert.equal(next.phase.kind, 'trade')
  if (next.phase.kind !== 'trade') throw new Error('unreachable')
  const { offer } = next.phase

  assert.deepEqual(offerFromMySide(offer, 0), { give: res({ brick: 2 }), get: res({ ore: 1 }) })
  assert.deepEqual(offerFromMySide(offer, 1), { give: res({ ore: 1 }), get: res({ brick: 2 }) })
})

test('offerFromMySide flips counter terms shown to a recipient', () => {
  const state = mainState()
  give(state, 0, res({ grain: 2 }))
  give(state, 1, res({ ore: 1 }))
  const action: Action = { type: 'proposeTrade', to: [1], give: res({ brick: 2 }), get: res({ ore: 1 }) }
  const next = applyAction(state, action)
  const counter = { give: res({ grain: 2 }), get: res({ ore: 1 }) }
  const countered = applyAction(next, { type: 'respondTrade', player: 1, reply: 'counter', counter })
  assert.equal(countered.phase.kind, 'trade')
  if (countered.phase.kind !== 'trade') throw new Error('unreachable')

  // Wrap the counter terms as an offer so offerFromMySide can flip them for any viewer.
  const counterOffer = { ...countered.phase.offer, give: counter.give, get: counter.get }
  // From the recipient's side the counter asks them to give 1 ore for 2 grain.
  assert.deepEqual(offerFromMySide(counterOffer, 1), { give: res({ ore: 1 }), get: res({ grain: 2 }) })
  // From the proposer's side the counter keeps the stored terms.
  assert.deepEqual(offerFromMySide(counterOffer, 0), { give: res({ grain: 2 }), get: res({ ore: 1 }) })
})

test('replyRows lists every recipient with their reply and counter', () => {
  const state = mainState()
  const action: Action = { type: 'proposeTrade', to: [2, 1], give: res({ brick: 2 }), get: res({ ore: 1 }) }
  const next = applyAction(state, action)
  assert.equal(next.phase.kind, 'trade')
  if (next.phase.kind !== 'trade') throw new Error('unreachable')

  const rows = replyRows(next, next.phase.offer)
  assert.deepEqual(
    rows.map((r) => r.player),
    [1, 2],
  )
  for (const row of rows) {
    assert.equal(row.name, next.players[row.player].name)
    assert.equal(row.color, next.players[row.player].color)
    assert.equal(row.reply, 'pending')
    assert.equal(row.counter, null)
  }

  const counter = { give: res({ brick: 2 }), get: res({ lumber: 1 }) }
  give(next, 1, res({ lumber: 1 }))
  const countered = applyAction(next, { type: 'respondTrade', player: 1, reply: 'counter', counter })
  if (countered.phase.kind !== 'trade') throw new Error('unreachable')
  const after = replyRows(countered, countered.phase.offer)
  assert.equal(after[0].reply, 'counter')
  assert.deepEqual(after[0].counter, counter)
  assert.equal(after[1].reply, 'pending')
})

test('stepTradeTerms adds with exclusivity, removes without it, and clamps to the cap', () => {
  const empty = { give: res({}), get: res({}) }

  const addedGive = stepTradeTerms(empty, 'give', 'wool', 1, 4)
  assert.deepEqual(addedGive, { give: res({ wool: 1 }), get: res({}) })

  const withGet = { give: res({ wool: 1 }), get: res({ wool: 2 }) }
  const cleared = stepTradeTerms(withGet, 'give', 'wool', 1, 4)
  assert.deepEqual(cleared, { give: res({ wool: 2 }), get: res({}) })

  const addedGet = stepTradeTerms(withGet, 'get', 'wool', 1, 19)
  assert.deepEqual(addedGet, { give: res({}), get: res({ wool: 3 }) })

  const removed = stepTradeTerms(withGet, 'give', 'wool', -1, 4)
  assert.deepEqual(removed, { give: res({}), get: res({ wool: 2 }) })

  const capped = stepTradeTerms(empty, 'give', 'brick', 1, 2)
  assert.deepEqual(capped.give, res({ brick: 1 }))
  assert.equal(RESOURCES.every((r) => capped.give[r] >= 0), true)
})
