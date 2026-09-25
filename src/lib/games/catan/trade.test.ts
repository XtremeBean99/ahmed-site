import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_OFFERS_PER_TURN } from './constants'
import { applyAction, playersToAct, validateAction } from './engine'
import { totalCards } from './helpers'
import { give, makeTestState, res, resourceTotals } from './test-fixtures'
import type { Action, GameState, TradeOffer } from './types'

function proposer(state: GameState): GameState {
  give(state, 0, res({ brick: 2 }))
  return state
}

function propose(state: GameState, to: number[] = [1, 2]): { next: GameState; offer: TradeOffer } {
  const action: Action = { type: 'proposeTrade', to, give: res({ brick: 1 }), get: res({ wool: 1 }) }
  assert.equal(validateAction(state, action), null)
  const next = applyAction(state, action)
  assert.equal(next.phase.kind, 'trade')
  if (next.phase.kind !== 'trade') throw new Error('unreachable')
  return { next, offer: next.phase.offer }
}

function offerOf(state: GameState): TradeOffer {
  assert.equal(state.phase.kind, 'trade')
  if (state.phase.kind !== 'trade') throw new Error('unreachable')
  return state.phase.offer
}

test('proposeTrade is rejected outside the main phase', () => {
  const state = makeTestState({ phase: { kind: 'preRoll' }, current: 0 })
  give(state, 0, res({ brick: 1 }))
  const action: Action = { type: 'proposeTrade', to: [1], give: res({ brick: 1 }), get: res({ wool: 1 }) }
  assert.equal(validateAction(state, action), 'Trade offers can only be proposed in the main phase')
})

test('proposeTrade requires a non-empty, duplicate-free partner list', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  assert.equal(
    validateAction(state, { type: 'proposeTrade', to: [], give: res({ brick: 1 }), get: res({ wool: 1 }) }),
    'Choose at least one partner',
  )
  assert.equal(
    validateAction(state, { type: 'proposeTrade', to: [1, 1], give: res({ brick: 1 }), get: res({ wool: 1 }) }),
    'Duplicate partners',
  )
  assert.equal(
    validateAction(state, { type: 'proposeTrade', to: [99], give: res({ brick: 1 }), get: res({ wool: 1 }) }),
    'Invalid partner',
  )
  assert.equal(
    validateAction(state, { type: 'proposeTrade', to: [0], give: res({ brick: 1 }), get: res({ wool: 1 }) }),
    'Cannot trade with yourself',
  )
})

test('proposeTrade validates the resource counts shape', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  const bad = { brick: -1, lumber: 0, wool: 0, grain: 0, ore: 0 }
  assert.equal(validateAction(state, { type: 'proposeTrade', to: [1], give: bad, get: res({ wool: 1 }) }), 'Invalid trade counts')
  assert.equal(
    validateAction(state, { type: 'proposeTrade', to: [1], give: res({}), get: res({ wool: 1 }) }),
    'Both sides must give at least one card',
  )
  assert.equal(
    validateAction(state, { type: 'proposeTrade', to: [1], give: res({ brick: 1 }), get: res({ brick: 1 }) }),
    'No resource may appear on both sides',
  )
  assert.equal(
    validateAction(state, { type: 'proposeTrade', to: [1], give: res({ ore: 1 }), get: res({ wool: 1 }) }),
    'You do not have the cards to give',
  )
})

test('proposeTrade never checks the recipients hands', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  // Partner 1 has no wool at all, yet the proposal is legal.
  assert.equal(totalCards(state.players[1].resources), 0)
  const { next } = propose(state, [1])
  assert.equal(next.phase.kind, 'trade')
})

test('proposeTrade sorts partners ascending and initialises replies and counters', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  const before = resourceTotals(state)
  const { next, offer } = propose(state, [3, 1])
  assert.deepEqual(offer.to, [1, 3])
  assert.equal(offer.from, 0)
  assert.equal(offer.id, next.tradeSeq)
  assert.equal(next.offersThisTurn, 1)
  assert.deepEqual(offer.replies, ['decline', 'pending', 'decline', 'pending'])
  assert.deepEqual(offer.counters, [null, null, null, null])
  assert.deepEqual(resourceTotals(next), before)
  assert.equal(next.events.at(-1)?.type, 'tradeProposed')
})

test('respondTrade is rejected outside trade, for non-recipients, and for duplicate replies', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  assert.equal(validateAction(state, { type: 'respondTrade', player: 1, reply: 'decline' }), 'No trade offer to answer')

  const { next } = propose(state, [1])
  assert.equal(validateAction(next, { type: 'respondTrade', player: 2, reply: 'decline' }), 'You are not part of this offer')
  assert.equal(validateAction(next, { type: 'respondTrade', player: 1, reply: 'accept' }), 'You do not have the cards to give')

  const afterDecline = applyAction(next, { type: 'respondTrade', player: 1, reply: 'decline' })
  assert.equal(
    validateAction(afterDecline, { type: 'respondTrade', player: 1, reply: 'accept' }),
    'You already answered this offer',
  )
})

test('respondTrade accept requires the responder to hold the offer get side', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  const { next } = propose(state, [1])
  assert.equal(validateAction(next, { type: 'respondTrade', player: 1, reply: 'accept' }), 'You do not have the cards to give')
  give(next, 1, res({ wool: 1 }))
  assert.equal(validateAction(next, { type: 'respondTrade', player: 1, reply: 'accept' }), null)
})

test('respondTrade decline is always valid and records the reply', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  const { next } = propose(state, [1, 2])
  const after = applyAction(next, { type: 'respondTrade', player: 2, reply: 'decline' })
  assert.equal(offerOf(after).replies[2], 'decline')
  const event = after.events.at(-1)
  assert.ok(event && event.type === 'tradeReplied')
  if (event?.type === 'tradeReplied') {
    assert.equal(event.player, 2)
    assert.equal(event.reply, 'decline')
    assert.equal(event.counter, null)
  }
})

test('respondTrade counter requires valid terms and both sides to hold their cards', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  give(state, 1, res({ wool: 2, grain: 1 }))
  give(state, 0, res({ grain: 1 }))
  const { next } = propose(state, [1])
  assert.equal(
    validateAction(next, { type: 'respondTrade', player: 1, reply: 'counter' }),
    'A counter needs terms',
  )
  assert.equal(
    validateAction(next, {
      type: 'respondTrade',
      player: 1,
      reply: 'counter',
      counter: { give: res({}), get: res({ wool: 1 }) },
    }),
    'Both sides must give at least one card',
  )
  assert.equal(
    validateAction(next, {
      type: 'respondTrade',
      player: 1,
      reply: 'counter',
      counter: { give: res({ wool: 1 }), get: res({ wool: 1 }) },
    }),
    'No resource may appear on both sides',
  )
  assert.equal(
    validateAction(next, {
      type: 'respondTrade',
      player: 1,
      reply: 'counter',
      counter: { give: res({ ore: 1 }), get: res({ wool: 1 }) },
    }),
    'Partner does not have the cards to give',
  )
  assert.equal(
    validateAction(next, {
      type: 'respondTrade',
      player: 1,
      reply: 'counter',
      counter: { give: res({ wool: 1 }), get: res({ brick: 1 }) },
    }),
    'You do not have the cards to give',
  )
  assert.equal(
    validateAction(next, {
      type: 'respondTrade',
      player: 1,
      reply: 'counter',
      counter: { give: res({ grain: 1 }), get: res({ wool: 1 }) },
    }),
    null,
  )
})

test('confirmTrade validates partner, proposer, reply, and current hands', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  give(state, 1, res({ wool: 1 }))
  const { next } = propose(state, [1, 2])
  assert.equal(validateAction(next, { type: 'confirmTrade', partner: 1 }), 'That player has not accepted')

  const accepted = applyAction(next, { type: 'respondTrade', player: 1, reply: 'accept' })
  assert.equal(validateAction(accepted, { type: 'confirmTrade', partner: 2 }), 'That player has not accepted')
  assert.equal(validateAction(accepted, { type: 'confirmTrade', partner: 99 }), 'Invalid partner')

  // The proposer no longer holds the give side.
  const withoutGive = structuredClone(accepted)
  withoutGive.players[0].resources.brick = 0
  assert.equal(validateAction(withoutGive, { type: 'confirmTrade', partner: 1 }), 'You do not have the cards to give')
})

test('cancelTrade is only legal for the proposer in trade', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  assert.equal(validateAction(state, { type: 'cancelTrade' }), 'No trade offer to cancel')
  const { next } = propose(state, [1])
  assert.equal(validateAction(next, { type: 'cancelTrade' }), null)
})

test('endTurn, builds, dev cards and maritime trades are rejected during trade', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  give(state, 0, res({ lumber: 1, grain: 1, ore: 1 }))
  const { next } = propose(state, [1])
  for (const action of [
    { type: 'endTurn' },
    { type: 'buyDevCard' },
    { type: 'maritimeTrade', give: 'brick', get: 'lumber' },
    { type: 'buildRoad', edge: 0 },
    { type: 'buildSettlement', vertex: 0 },
    { type: 'buildCity', vertex: 0 },
    { type: 'playKnight' },
    { type: 'playRoadBuilding' },
    { type: 'playYearOfPlenty', resources: ['brick', 'brick'] },
    { type: 'playMonopoly', resource: 'brick' },
  ] as Action[]) {
    assert.notEqual(validateAction(next, action), null, `${action.type} should be rejected during trade`)
  }
})

test('a full accept flow moves the exact cards and emits the events', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  give(state, 1, res({ wool: 1 }))
  const before = resourceTotals(state)

  const { next, offer } = propose(state, [1, 2])
  assert.deepEqual(playersToAct(next), [1, 2])

  const afterAccept = applyAction(next, { type: 'respondTrade', player: 1, reply: 'accept' })
  assert.deepEqual(playersToAct(afterAccept), [2])
  const afterDecline = applyAction(afterAccept, { type: 'respondTrade', player: 2, reply: 'decline' })
  assert.deepEqual(playersToAct(afterDecline), [0])

  const afterConfirm = applyAction(afterDecline, { type: 'confirmTrade', partner: 1 })
  assert.equal(afterConfirm.phase.kind, 'main')
  assert.deepEqual(resourceTotals(afterConfirm), before)
  assert.equal(afterConfirm.players[0].resources.brick, 1)
  assert.equal(afterConfirm.players[0].resources.wool, 1)
  assert.equal(afterConfirm.players[1].resources.brick, 1)
  assert.equal(afterConfirm.players[1].resources.wool, 0)

  const types = afterConfirm.events.slice(-3).map((e) => e.type)
  assert.deepEqual(types, ['tradeReplied', 'tradeReplied', 'domesticTrade'])
  const tradeEvent = afterConfirm.events.at(-1)
  assert.ok(tradeEvent && tradeEvent.type === 'domesticTrade')
  if (tradeEvent?.type === 'domesticTrade') {
    assert.equal(tradeEvent.player, 0)
    assert.equal(tradeEvent.partner, 1)
    assert.deepEqual(tradeEvent.give, offer.give)
    assert.deepEqual(tradeEvent.get, offer.get)
  }
})

test('a counter flow trades on the counter terms', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  give(state, 0, res({ ore: 1 }))
  give(state, 1, res({ wool: 1 }))
  const before = resourceTotals(state)

  const { next } = propose(state, [1])
  const counter = { give: res({ ore: 1 }), get: res({ wool: 1 }) }
  const afterCounter = applyAction(next, { type: 'respondTrade', player: 1, reply: 'counter', counter })
  const event = afterCounter.events.at(-1)
  assert.ok(event && event.type === 'tradeReplied')
  if (event?.type === 'tradeReplied') {
    assert.equal(event.reply, 'counter')
    assert.deepEqual(event.counter, counter)
  }

  const afterConfirm = applyAction(afterCounter, { type: 'confirmTrade', partner: 1 })
  assert.equal(afterConfirm.phase.kind, 'main')
  assert.deepEqual(resourceTotals(afterConfirm), before)
  assert.equal(afterConfirm.players[0].resources.ore, 0)
  assert.equal(afterConfirm.players[0].resources.wool, 1)
  assert.equal(afterConfirm.players[1].resources.ore, 1)
  assert.equal(afterConfirm.players[1].resources.wool, 0)
})

test('the proposer may confirm while another reply is still pending', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  give(state, 1, res({ wool: 1 }))
  const before = resourceTotals(state)

  const { next } = propose(state, [1, 2])
  const afterAccept = applyAction(next, { type: 'respondTrade', player: 1, reply: 'accept' })
  assert.deepEqual(playersToAct(afterAccept), [2])

  const afterConfirm = applyAction(afterAccept, { type: 'confirmTrade', partner: 1 })
  assert.equal(afterConfirm.phase.kind, 'main')
  assert.deepEqual(resourceTotals(afterConfirm), before)
  assert.equal(afterConfirm.players[0].resources.wool, 1)
  assert.equal(afterConfirm.players[1].resources.brick, 1)
})

test('cancelTrade returns to main and emits tradeCancelled', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  const { next, offer } = propose(state, [1, 2])
  const after = applyAction(next, { type: 'cancelTrade' })
  assert.equal(after.phase.kind, 'main')
  const event = after.events.at(-1)
  assert.ok(event && event.type === 'tradeCancelled')
  if (event?.type === 'tradeCancelled') assert.equal(event.offerId, offer.id)
})

test('the per-turn offer cap is enforced and endTurn resets it', () => {
  const state = proposer(makeTestState({ phase: { kind: 'main' }, current: 0 }))
  give(state, 0, res({ brick: MAX_OFFERS_PER_TURN + 1 }))

  let current = state
  for (let i = 0; i < MAX_OFFERS_PER_TURN; i++) {
    const { next } = propose(current, [1])
    current = applyAction(next, { type: 'cancelTrade' })
    assert.equal(current.offersThisTurn, i + 1)
  }
  assert.equal(
    validateAction(current, { type: 'proposeTrade', to: [1], give: res({ brick: 1 }), get: res({ wool: 1 }) }),
    'No more trade offers this turn',
  )

  const nextTurn = applyAction(current, { type: 'endTurn' })
  assert.equal(nextTurn.offersThisTurn, 0)
})
