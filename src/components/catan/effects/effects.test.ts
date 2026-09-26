import assert from 'node:assert/strict'
import test from 'node:test'
import { pushEvent } from '@/lib/games/catan/helpers'
import { makeTestState, res } from '@/lib/games/catan/test-fixtures'
import type { GameEventInput, GameState, ResourceCounts } from '@/lib/games/catan/types'
import { effectsFor } from './effects'
import type { Effect, StealEffect } from './effects'

function base(): GameState {
  const state = makeTestState()
  state.eventSeq = 5
  return state
}

function nextWith(prev: GameState, events: GameEventInput[], mutate?: (next: GameState) => void): GameState {
  const next = structuredClone(prev)
  for (const event of events) pushEvent(next, event)
  mutate?.(next)
  return next
}

function zeros(): ResourceCounts {
  return res({})
}

test('roll maps to a dice effect', () => {
  const prev = base()
  const next = nextWith(prev, [{ type: 'roll', player: 1, dice: [3, 5] }])
  const effects = effectsFor(prev, next, 0)
  assert.equal(effects.length, 1)
  assert.deepEqual(effects[0], { kind: 'dice', dice: [3, 5], roller: 1 })
})

test('produce carries the total, producing hexes and the blocked robber hex', () => {
  const prev = base()
  prev.tiles[0] = { terrain: 'grain', number: 6 }
  prev.tiles[1] = { terrain: 'lumber', number: 6 }
  prev.robber = 0
  const next = nextWith(
    prev,
    [
      {
        type: 'produce',
        gains: [res({ grain: 2 }), zeros(), zeros(), zeros()],
        blocked: [zeros(), res({ lumber: 1 }), zeros(), zeros()],
        shortage: [],
      },
    ],
    (state) => {
      state.dice = [2, 4]
    },
  )
  const effects = effectsFor(prev, next, 0)
  assert.equal(effects.length, 1)
  const effect = effects[0]
  assert.equal(effect.kind, 'produce')
  if (effect.kind !== 'produce') return
  assert.equal(effect.total, 6)
  assert.equal(effect.blockedHex, 0)
  assert.ok(effect.hexes.includes(1))
  assert.ok(!effect.hexes.includes(0))
  assert.deepEqual(effect.gains[0], res({ grain: 2 }))
  assert.deepEqual(effect.blocked[1], res({ lumber: 1 }))
})

test('robberMoved maps from the previous robber hex to the new one', () => {
  const prev = base()
  const next = nextWith(prev, [{ type: 'robberMoved', player: 2, hex: 5 }])
  const effects = effectsFor(prev, next, 0)
  assert.deepEqual(effects, [{ kind: 'robber', from: 9, to: 5 }])
})

test('steal reveals the resource only when the human is involved', () => {
  const prev = base()

  const botVsBot = effectsFor(prev, nextWith(prev, [{ type: 'stole', player: 1, victim: 2, resource: 'ore' }]), 0)
  const hidden = botVsBot[0] as StealEffect
  assert.equal(hidden.kind, 'steal')
  assert.equal(hidden.resource, null)
  assert.equal(hidden.hidden, true)

  const fromBot = effectsFor(prev, nextWith(prev, [{ type: 'stole', player: 1, victim: 0, resource: 'wool' }]), 0)
  assert.deepEqual(fromBot[0], { kind: 'steal', thief: 1, victim: 0, resource: 'wool', hidden: false })

  const fromHuman = effectsFor(prev, nextWith(prev, [{ type: 'stole', player: 0, victim: 1, resource: 'brick' }]), 0)
  assert.deepEqual(fromHuman[0], { kind: 'steal', thief: 0, victim: 1, resource: 'brick', hidden: false })
})

test('built and setup placements map to build effects', () => {
  const prev = base()
  const effects = effectsFor(
    prev,
    nextWith(prev, [
      { type: 'built', player: 0, kind: 'road', at: 3 },
      { type: 'setupSettlement', player: 1, vertex: 12 },
      { type: 'setupRoad', player: 1, edge: 20 },
      { type: 'built', player: 2, kind: 'city', at: 30 },
    ]),
    0,
  )
  assert.deepEqual(effects, [
    { kind: 'build', player: 0, buildKind: 'road', at: 3 },
    { kind: 'build', player: 1, buildKind: 'settlement', at: 12 },
    { kind: 'build', player: 1, buildKind: 'road', at: 20 },
    { kind: 'build', player: 2, buildKind: 'city', at: 30 },
  ])
})

test('development card events never name the bought card', () => {
  const prev = base()
  const bought = effectsFor(prev, nextWith(prev, [{ type: 'boughtDevCard', player: 1 }]), 0)
  assert.deepEqual(bought, [{ kind: 'devBought', player: 1 }])
  assert.ok(!('card' in bought[0]))

  const played = effectsFor(prev, nextWith(prev, [{ type: 'playedDevCard', player: 1, card: 'knight' }]), 0)
  assert.deepEqual(played, [{ kind: 'devPlayed', player: 1, card: 'knight' }])
})

test('longest road and largest army map to award effects', () => {
  const prev = base()
  const lost = effectsFor(prev, nextWith(prev, [{ type: 'longestRoad', player: null }]), 0)
  assert.deepEqual(lost, [{ kind: 'award', award: 'longestRoad', holder: null }])

  const army = effectsFor(prev, nextWith(prev, [{ type: 'largestArmy', player: 1 }]), 0)
  assert.deepEqual(army, [{ kind: 'award', award: 'largestArmy', holder: 1 }])
})

test('bank and player trades map to trade effects', () => {
  const prev = base()
  const bank = effectsFor(
    prev,
    nextWith(prev, [{ type: 'maritimeTrade', player: 0, give: 'brick', giveCount: 4, get: 'ore' }]),
    0,
  )
  assert.deepEqual(bank, [
    { kind: 'trade', from: 0, to: null, give: res({ brick: 4 }), get: res({ ore: 1 }) },
  ])

  const player = effectsFor(
    prev,
    nextWith(prev, [{ type: 'domesticTrade', player: 0, partner: 1, give: res({ wool: 1 }), get: res({ lumber: 2 }) }]),
    0,
  )
  assert.deepEqual(player, [
    { kind: 'trade', from: 0, to: 1, give: res({ wool: 1 }), get: res({ lumber: 2 }) },
  ])
})

test('trade replies map to trade effects with a reply marker', () => {
  const prev = base()
  const offerPhase = (from: number) => ({
    kind: 'trade' as const,
    offer: {
      id: 1,
      from,
      to: [0],
      replies: prev.players.map(() => 'decline' as const),
      counters: prev.players.map(() => null),
      give: res({ wool: 1 }),
      get: res({ lumber: 1 }),
    },
  })
  const accepted = effectsFor(
    prev,
    nextWith(prev, [{ type: 'tradeReplied', player: 0, offerId: 1, reply: 'accept', counter: null }], (state) => {
      state.phase = offerPhase(1)
    }),
    0,
  )
  assert.deepEqual(accepted, [
    { kind: 'trade', from: 1, to: 0, give: zeros(), get: zeros(), reply: 'accepted' },
  ])

  const declined = effectsFor(
    prev,
    nextWith(prev, [{ type: 'tradeReplied', player: 1, offerId: 1, reply: 'decline', counter: null }], (state) => {
      state.phase = offerPhase(0)
    }),
    0,
  )
  assert.deepEqual(declined, [
    { kind: 'trade', from: 0, to: 1, give: zeros(), get: zeros(), reply: 'declined' },
  ])
})

test('tradeProposed maps to an offer effect only when the human is a recipient', () => {
  const prev = base()
  const toHuman = effectsFor(
    prev,
    nextWith(prev, [{ type: 'tradeProposed', player: 1, offerId: 2, to: [0], give: res({ wool: 1 }), get: res({ ore: 1 }) }]),
    0,
  )
  assert.deepEqual(toHuman, [
    { kind: 'offer', from: 1, to: [0], give: res({ wool: 1 }), get: res({ ore: 1 }) },
  ])

  const toBots = effectsFor(
    prev,
    nextWith(prev, [{ type: 'tradeProposed', player: 1, offerId: 3, to: [2], give: res({ wool: 1 }), get: res({ ore: 1 }) }]),
    0,
  )
  assert.deepEqual(toBots, [])
})

test('discard and turnEnded map to discard and turn effects', () => {
  const prev = base()
  const discard = effectsFor(prev, nextWith(prev, [{ type: 'discard', player: 1, resources: res({ brick: 2, wool: 1 }) }]), 0)
  assert.deepEqual(discard, [{ kind: 'discard', player: 1, count: 3 }])

  const botTurn = effectsFor(prev, nextWith(prev, [{ type: 'turnEnded', player: 1 }], (state) => {
    state.current = 2
  }), 0)
  assert.deepEqual(botTurn, [{ kind: 'turn', player: 2, human: false }])

  const yourTurn = effectsFor(prev, nextWith(prev, [{ type: 'turnEnded', player: 1 }], (state) => {
    state.current = 0
  }), 0)
  assert.deepEqual(yourTurn, [{ kind: 'turn', player: 0, human: true }])
})

test('gameOver maps to a gameOver effect with the human result', () => {
  const prev = base()
  const lost = effectsFor(prev, nextWith(prev, [{ type: 'gameOver', winner: 1 }]), 0)
  assert.deepEqual(lost, [{ kind: 'gameOver', winner: 1, humanWon: false }])

  const won = effectsFor(prev, nextWith(prev, [{ type: 'gameOver', winner: 0 }]), 0)
  assert.deepEqual(won, [{ kind: 'gameOver', winner: 0, humanWon: true }])
})

test('more than 12 fresh events collapse into one summary effect', () => {
  const prev = base()
  const events: GameEventInput[] = Array.from({ length: 13 }, (_, i) => ({
    type: 'built',
    player: 1,
    kind: 'road',
    at: i,
  }))
  const effects = effectsFor(prev, nextWith(prev, events), 0)
  assert.equal(effects.length, 1)
  assert.equal(effects[0].kind, 'summary')
  if (effects[0].kind !== 'summary') return
  assert.ok(effects[0].text.includes('built 13 roads'))
})

test('the first render returns a single summary instead of animating everything', () => {
  const state = base()
  const next = nextWith(state, [
    { type: 'roll', player: 1, dice: [3, 5] },
    { type: 'built', player: 1, kind: 'road', at: 2 },
  ])
  const effects = effectsFor(null, next, 0)
  assert.equal(effects.length, 1)
  assert.equal(effects[0].kind, 'summary')
  if (effects[0].kind !== 'summary') return
  assert.equal(effects[0].text, "Bot 1's turn: rolled 8, built a road")
})

test('a first render with no events produces no effects', () => {
  assert.deepEqual(effectsFor(null, makeTestState(), 0), [])
})

test('an undo with a lower eventSeq produces no effects', () => {
  const prev = base()
  prev.eventSeq = 20
  const next = base()
  assert.deepEqual(effectsFor(prev, next, 0), [])
})

test('the effect union covers all emitted event types', () => {
  const prev = base()
  const events: GameEventInput[] = [
    { type: 'setupSettlement', player: 0, vertex: 10 },
    { type: 'setupRoad', player: 0, edge: 14 },
    { type: 'setupResources', player: 0, resources: res({ brick: 1 }) },
    { type: 'roll', player: 0, dice: [2, 2] },
    { type: 'produce', gains: [zeros(), zeros(), zeros(), zeros()], blocked: [zeros(), zeros(), zeros(), zeros()], shortage: [] },
    { type: 'discard', player: 0, resources: res({ wool: 1 }) },
    { type: 'robberMoved', player: 0, hex: 4 },
    { type: 'stole', player: 0, victim: 1, resource: 'ore' },
    { type: 'built', player: 0, kind: 'settlement', at: 20 },
    { type: 'boughtDevCard', player: 0 },
    { type: 'playedDevCard', player: 0, card: 'knight' },
    { type: 'yearOfPlenty', player: 0, resources: ['brick', 'lumber'] },
  ]
  const effects: Effect[] = effectsFor(prev, nextWith(prev, events), 0)
  const kinds = effects.map((e) => e.kind)
  assert.ok(kinds.includes('build'))
  assert.ok(kinds.includes('dice'))
  assert.ok(kinds.includes('produce'))
  assert.ok(kinds.includes('discard'))
  assert.ok(kinds.includes('robber'))
  assert.ok(kinds.includes('steal'))
  assert.ok(kinds.includes('devBought'))
  assert.ok(kinds.includes('devPlayed'))
  // yearOfPlenty and setupResources carry no effect, so all 10 kinds stay known
  assert.equal(kinds.length, 10)
})
