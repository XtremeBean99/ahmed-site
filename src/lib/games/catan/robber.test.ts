import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEXES } from './geometry'
import { legalRobberHexes, robberVictims } from './helpers'
import { makeTestState, give, putSettlement, res, resourceTotals } from './test-fixtures'
import { robberHandlers, startSevenResolution } from './robber'
import type { ActionOf, Resource } from './types'

function discardAction(player: number, resources: unknown): ActionOf<'discard'> {
  return { type: 'discard', player, resources } as ActionOf<'discard'>
}

test('startSevenResolution: exactly 7 cards means no discard', () => {
  const state = makeTestState()
  give(state, 0, res({ brick: 4, lumber: 3 }))
  startSevenResolution(state)
  assert.deepEqual(state.phase, { kind: 'moveRobber', returnTo: 'main' })
})

test('startSevenResolution: 8 and 9 cards both discard 4', () => {
  const eight = makeTestState()
  give(eight, 0, res({ brick: 8 }))
  startSevenResolution(eight)
  assert.deepEqual(eight.phase, { kind: 'discard', discards: [4, 0, 0, 0] })

  const nine = makeTestState()
  give(nine, 0, res({ lumber: 9 }))
  startSevenResolution(nine)
  assert.deepEqual(nine.phase, { kind: 'discard', discards: [4, 0, 0, 0] })
})

test('several players discard in any order, moving to moveRobber only after the last', () => {
  const state = makeTestState()
  give(state, 0, res({ brick: 8 }))
  give(state, 1, res({ lumber: 9 }))
  startSevenResolution(state)
  assert.deepEqual(state.phase, { kind: 'discard', discards: [4, 4, 0, 0] })

  const nonCurrent = robberHandlers.discard.validate(state, discardAction(1, res({ lumber: 4 })))
  assert.equal(nonCurrent, null)
  robberHandlers.discard.apply(state, discardAction(1, res({ lumber: 4 })))
  assert.equal(state.players[1].resources.lumber, 5)
  assert.deepEqual(state.phase, { kind: 'discard', discards: [4, 0, 0, 0] })

  const roller = robberHandlers.discard.validate(state, discardAction(0, res({ brick: 4 })))
  assert.equal(roller, null)
  robberHandlers.discard.apply(state, discardAction(0, res({ brick: 4 })))
  assert.equal(state.players[0].resources.brick, 4)
  assert.deepEqual(state.phase, { kind: 'moveRobber', returnTo: 'main' })
})

test('discard rejects wrong totals, cards not held, and players who owe nothing', () => {
  const state = makeTestState({ phase: { kind: 'discard', discards: [4, 0, 0, 0] } })
  give(state, 0, res({ brick: 8 }))

  assert.equal(robberHandlers.discard.validate(state, discardAction(0, res({ brick: 3 }))), 'Must discard exactly 4 cards')
  assert.equal(robberHandlers.discard.validate(state, discardAction(0, res({ ore: 4 }))), 'Cannot discard cards you do not have')
  assert.equal(robberHandlers.discard.validate(state, discardAction(1, res({}))), 'No cards to discard')
  assert.equal(robberHandlers.discard.validate(state, discardAction(0, 'bad')), 'Invalid resources')
  assert.equal(robberHandlers.discard.validate(state, discardAction(99, res({ brick: 4 }))), 'Invalid player')
})

test('discard only works in the discard phase', () => {
  const state = makeTestState()
  assert.equal(robberHandlers.discard.validate(state, discardAction(0, res({}))), 'No discard is pending')
})

test('moveRobber requires a different valid hex, and the desert is allowed', () => {
  const state = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' } })
  assert.equal(robberHandlers.moveRobber.validate(state, { type: 'moveRobber', hex: state.robber }), 'The robber cannot move there')
  assert.equal(robberHandlers.moveRobber.validate(state, { type: 'moveRobber', hex: 19 }), 'Invalid hex')
  assert.equal(robberHandlers.moveRobber.validate(state, { type: 'moveRobber', hex: 1.5 }), 'Invalid hex')

  state.robber = 0
  assert.equal(robberHandlers.moveRobber.validate(state, { type: 'moveRobber', hex: 9 }), null)
})

test('moveRobber only works in the moveRobber phase', () => {
  const state = makeTestState()
  assert.equal(robberHandlers.moveRobber.validate(state, { type: 'moveRobber', hex: 0 }), 'No robber move is pending')
})

test('moveRobber with no victims returns to returnTo without stealing', () => {
  const state = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' } })
  robberHandlers.moveRobber.apply(state, { type: 'moveRobber', hex: 0 })
  assert.equal(state.robber, 0)
  assert.deepEqual(state.phase, { kind: 'main' })
  assert.equal(state.events.at(-1)?.type, 'robberMoved')
})

test('moveRobber victims exclude self, empty hands, and players not on the hex', () => {
  const state = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' } })
  putSettlement(state, 0, 0)
  putSettlement(state, 1, 4)
  putSettlement(state, 2, 8)
  give(state, 0, res({ ore: 5 }))
  give(state, 1, res({ brick: 3 }))
  give(state, 3, res({ wool: 3 }))

  robberHandlers.moveRobber.apply(state, { type: 'moveRobber', hex: 0 })

  assert.deepEqual(state.phase, { kind: 'main' })
  assert.equal(state.players[1].resources.brick, 2)
  assert.equal(state.players[0].resources.brick, 1)
  assert.equal(state.players[3].resources.wool, 3)
  assert.equal(state.players[0].resources.ore, 5)
})

test('moveRobber with several victims enters the steal phase with sorted candidates', () => {
  const state = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' } })
  putSettlement(state, 1, 4)
  putSettlement(state, 3, 8)
  give(state, 1, res({ brick: 2 }))
  give(state, 3, res({ wool: 2 }))

  robberHandlers.moveRobber.apply(state, { type: 'moveRobber', hex: 0 })

  assert.deepEqual(state.phase, { kind: 'steal', candidates: [1, 3], returnTo: 'main' })
  assert.equal(state.players[1].resources.brick, 2)
  assert.equal(state.players[3].resources.wool, 2)
})

test('steal validates the phase and candidate list, then transfers exactly one card', () => {
  const state = makeTestState({ phase: { kind: 'steal', candidates: [1, 3], returnTo: 'main' } })
  give(state, 3, res({ wool: 2 }))

  assert.equal(robberHandlers.steal.validate(state, { type: 'steal', victim: 0 }), 'Invalid victim')
  assert.equal(robberHandlers.steal.validate(state, { type: 'steal', victim: 2 }), 'Invalid victim')

  robberHandlers.steal.apply(state, { type: 'steal', victim: 3 })
  assert.deepEqual(state.phase, { kind: 'main' })
  assert.equal(state.players[3].resources.wool, 1)
  assert.equal(state.players[0].resources.wool, 1)
  const event = state.events.at(-1)
  assert.ok(event && event.type === 'stole')
})

test('steal only works in the steal phase', () => {
  const state = makeTestState()
  assert.equal(robberHandlers.steal.validate(state, { type: 'steal', victim: 0 }), 'No steal is pending')
})

test('steal conserves cards and both resource types are reachable across seeds', () => {
  const seen = new Set<Resource>()
  for (let seed = 0; seed < 200; seed++) {
    const state = makeTestState({ phase: { kind: 'steal', candidates: [1], returnTo: 'main' } })
    state.rng = seed
    give(state, 1, res({ brick: 1, lumber: 1 }))
    const before = resourceTotals(state)

    assert.equal(robberHandlers.steal.validate(state, { type: 'steal', victim: 1 }), null)
    robberHandlers.steal.apply(state, { type: 'steal', victim: 1 })

    assert.deepEqual(resourceTotals(state), before)
    assert.deepEqual(state.phase, { kind: 'main' })
    const event = state.events.at(-1)
    assert.ok(event && event.type === 'stole')
    if (event?.type === 'stole') {
      assert.ok(event.resource !== null)
      if (event.resource !== null) seen.add(event.resource)
    }
  }
  assert.deepEqual(seen, new Set(['brick', 'lumber']))
})

test('steal from a victim with no cards records a null resource', () => {
  const state = makeTestState({ phase: { kind: 'steal', candidates: [1], returnTo: 'main' } })
  robberHandlers.steal.apply(state, { type: 'steal', victim: 1 })
  assert.deepEqual(state.phase, { kind: 'main' })
  const event = state.events.at(-1)
  assert.ok(event && event.type === 'stole')
  if (event?.type === 'stole') assert.equal(event.resource, null)
})

test('robber validate never mutates state', () => {
  const state = makeTestState({ phase: { kind: 'discard', discards: [4, 0, 0, 0] } })
  give(state, 0, res({ brick: 8 }))
  const before = structuredClone(state)

  robberHandlers.discard.validate(state, discardAction(0, res({ brick: 3 })))
  robberHandlers.moveRobber.validate(state, { type: 'moveRobber', hex: 1.5 })
  robberHandlers.steal.validate(state, { type: 'steal', victim: 0 })

  assert.deepEqual(state, before)
})

test('friendly robber falls back to every non-robber hex when no free hex exists', () => {
  const state = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' }, current: 0 })
  state.settings.friendlyRobber = true
  // Six protected settlements (two per opponent) cover every non-robber hex.
  const cover = [8, 14, 22, 31, 39, 45]
  const owners = [1, 1, 2, 2, 3, 3]
  cover.forEach((vertex, i) => {
    state.buildings[vertex] = { owner: owners[i], kind: 'settlement' }
  })

  const legal = legalRobberHexes(state)
  assert.deepEqual(legal, HEXES.filter((hex) => hex.id !== state.robber).map((hex) => hex.id))
  assert.equal(legal.length, 18)
})

test('friendly robber keeps the single free hex and rejects the others', () => {
  const state = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' }, current: 0 })
  state.settings.friendlyRobber = true
  // Six protected settlements cover every non-robber hex except hex 4.
  const cover = [4, 14, 22, 31, 39, 45]
  const owners = [1, 1, 2, 2, 3, 3]
  cover.forEach((vertex, i) => {
    state.buildings[vertex] = { owner: owners[i], kind: 'settlement' }
  })

  assert.deepEqual(legalRobberHexes(state), [4])
  assert.equal(robberHandlers.moveRobber.validate(state, { type: 'moveRobber', hex: 4 }), null)
  assert.equal(
    robberHandlers.moveRobber.validate(state, { type: 'moveRobber', hex: 0 }),
    'The robber cannot move there',
  )
})

test('friendly robber only robs the unprotected opponent on a shared hex', () => {
  const state = makeTestState({ phase: { kind: 'moveRobber', returnTo: 'main' }, current: 0 })
  state.settings.friendlyRobber = true
  const hex = HEXES[0]
  const protectedOpponent = 1
  const leader = 2
  state.buildings[hex.vertices[0]] = { owner: protectedOpponent, kind: 'settlement' }
  state.buildings[hex.vertices[1]] = { owner: leader, kind: 'settlement' }
  for (const vertex of [30, 33]) state.buildings[vertex] = { owner: leader, kind: 'settlement' }
  give(state, protectedOpponent, res({ brick: 1 }))
  give(state, leader, res({ wool: 1 }))

  assert.deepEqual(robberVictims(state, hex.id, 0), [leader])
})
