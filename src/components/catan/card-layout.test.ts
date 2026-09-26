import assert from 'node:assert/strict'
import test from 'node:test'
import type { GameEvent } from '@/lib/games/catan/types'
import { cardStackLayout, eventGainsForPlayer, isOverSeven } from './card-layout'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type EventBody = DistributiveOmit<GameEvent, 'seq' | 'turn'>

function event(body: EventBody): GameEvent {
  return { ...body, seq: 1, turn: 1 } as GameEvent
}

test('cardStackLayout shows up to maxVisible cards and badges the rest', () => {
  assert.deepEqual(cardStackLayout(0), { shown: 0, extra: 0 })
  assert.deepEqual(cardStackLayout(1), { shown: 1, extra: 0 })
  assert.deepEqual(cardStackLayout(4), { shown: 4, extra: 0 })
  assert.deepEqual(cardStackLayout(7), { shown: 4, extra: 3 })
  assert.deepEqual(cardStackLayout(7, 7), { shown: 7, extra: 0 })
  assert.deepEqual(cardStackLayout(9, 7), { shown: 7, extra: 2 })
})

test('isOverSeven is true only above the discard threshold', () => {
  assert.equal(isOverSeven(7), false)
  assert.equal(isOverSeven(8), true)
})

test('eventGainsForPlayer extracts gains from produce and setup resources', () => {
  const produce = event({ type: 'produce', gains: [{ brick: 2, lumber: 0, wool: 0, grain: 1, ore: 0 }], blocked: [{ brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }], shortage: [] })
  assert.deepEqual(eventGainsForPlayer(produce, 0), [
    { resource: 'brick', amount: 2 },
    { resource: 'grain', amount: 1 },
  ])
  assert.deepEqual(eventGainsForPlayer(produce, 1), [])

  const setup = event({
    type: 'setupResources',
    player: 0,
    resources: { brick: 1, lumber: 1, wool: 1, grain: 1, ore: 0 },
  })
  assert.deepEqual(eventGainsForPlayer(setup, 0), [
    { resource: 'brick', amount: 1 },
    { resource: 'lumber', amount: 1 },
    { resource: 'wool', amount: 1 },
    { resource: 'grain', amount: 1 },
  ])
})

test('eventGainsForPlayer extracts steals, monopoly, year of plenty and trades', () => {
  assert.deepEqual(eventGainsForPlayer(event({ type: 'stole', player: 0, victim: 1, resource: 'ore' }), 0), [
    { resource: 'ore', amount: 1 },
  ])
  assert.deepEqual(eventGainsForPlayer(event({ type: 'stole', player: 0, victim: 1, resource: null }), 0), [])
  assert.deepEqual(eventGainsForPlayer(event({ type: 'stole', player: 1, victim: 0, resource: 'ore' }), 0), [])

  assert.deepEqual(eventGainsForPlayer(event({ type: 'monopoly', player: 0, resource: 'wool', taken: 4, takenFrom: [0, 4, 0, 0] }), 0), [
    { resource: 'wool', amount: 4 },
  ])
  assert.deepEqual(eventGainsForPlayer(event({ type: 'yearOfPlenty', player: 0, resources: ['grain', 'grain'] }), 0), [
    { resource: 'grain', amount: 2 },
  ])
  assert.deepEqual(eventGainsForPlayer(event({ type: 'maritimeTrade', player: 0, give: 'brick', giveCount: 4, get: 'ore' }), 0), [
    { resource: 'ore', amount: 1 },
  ])
  assert.deepEqual(
    eventGainsForPlayer(
      event({
        type: 'domesticTrade',
        player: 0,
        partner: 1,
        give: { brick: 2, lumber: 0, wool: 0, grain: 0, ore: 0 },
        get: { brick: 0, lumber: 0, wool: 0, grain: 1, ore: 1 },
      }),
      0,
    ),
    [
      { resource: 'grain', amount: 1 },
      { resource: 'ore', amount: 1 },
    ],
  )
})
