import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HEXES, VERTICES, edgeBetween } from './geometry'
import { emptyResources } from './helpers'
import { nextInt } from './rng'
import { makeTestState, give, putCity, putRoadPath, putSettlement, res, resourceTotals } from './test-fixtures'
import { produceResources, turnHandlers } from './turn'
import type { GameState, ResourceCounts } from './types'

const FULL_BANK = res({ brick: 19, lumber: 19, wool: 19, grain: 19, ore: 19 })

function findSeed(pred: (sum: number) => boolean): { seed: number; dice: [number, number] } {
  for (let seed = 0; seed < 100000; seed++) {
    const probe = makeTestState()
    probe.rng = seed
    const dice: [number, number] = [nextInt(probe, 6) + 1, nextInt(probe, 6) + 1]
    if (pred(dice[0] + dice[1])) return { seed, dice }
  }
  throw new Error('no seed found')
}

function gainOf(state: GameState, player: number): ResourceCounts {
  const event = state.events[state.events.length - 1]
  assert.equal(event.type, 'produce')
  if (event.type !== 'produce') throw new Error('unreachable')
  return event.gains[player]
}

test('produceResources pays settlements 1 and cities 2 across multiple hexes with the same number', () => {
  const s = makeTestState()
  putSettlement(s, 0, HEXES[11].vertices[0])
  putSettlement(s, 0, HEXES[12].vertices[1])
  putCity(s, 1, HEXES[12].vertices[0])
  produceResources(s, 8)
  assert.deepEqual(s.players[0].resources, res({ lumber: 1, ore: 1 }))
  assert.deepEqual(s.players[1].resources, res({ lumber: 2 }))
  assert.deepEqual(s.bank, res({ brick: 19, lumber: 16, wool: 19, grain: 19, ore: 18 }))
  assert.deepEqual(gainOf(s, 0), res({ lumber: 1, ore: 1 }))
  assert.deepEqual(gainOf(s, 1), res({ lumber: 2 }))
  assert.deepEqual(gainOf(s, 2), emptyResources())
  assert.deepEqual(gainOf(s, 3), emptyResources())
})

test('produceResources skips the hex with the robber', () => {
  const s = makeTestState()
  s.robber = 11
  putSettlement(s, 0, HEXES[11].vertices[0])
  putSettlement(s, 0, HEXES[12].vertices[0])
  produceResources(s, 8)
  assert.deepEqual(s.players[0].resources, res({ lumber: 1 }))
  assert.equal(s.bank.ore, 19)
  assert.equal(s.bank.lumber, 18)
})

test('produceResources pushes no event when nobody receives anything', () => {
  const s = makeTestState()
  produceResources(s, 8)
  assert.equal(s.events.length, 0)
})

test('produceResources shortage: bank covers everyone in full', () => {
  const s = makeTestState()
  putCity(s, 0, HEXES[11].vertices[0])
  putSettlement(s, 0, HEXES[11].vertices[1])
  produceResources(s, 8)
  assert.equal(s.players[0].resources.ore, 3)
  assert.equal(s.bank.ore, 16)
})

test('produceResources shortage: a single recipient gets the bank remainder', () => {
  const s = makeTestState()
  s.bank.ore = 2
  putCity(s, 0, HEXES[11].vertices[0])
  putSettlement(s, 0, HEXES[11].vertices[1])
  produceResources(s, 8)
  assert.equal(s.players[0].resources.ore, 2)
  assert.equal(s.bank.ore, 0)
})

test('produceResources shortage: two recipients get nothing', () => {
  const s = makeTestState()
  s.bank.ore = 1
  putSettlement(s, 0, HEXES[11].vertices[0])
  putSettlement(s, 1, HEXES[11].vertices[1])
  produceResources(s, 8)
  assert.equal(s.players[0].resources.ore, 0)
  assert.equal(s.players[1].resources.ore, 0)
  assert.equal(s.bank.ore, 1)
})

test('produceResources shortage: other resources are unaffected', () => {
  const s = makeTestState()
  s.bank.ore = 1
  putSettlement(s, 0, HEXES[11].vertices[0])
  putSettlement(s, 1, HEXES[11].vertices[1])
  putSettlement(s, 0, HEXES[12].vertices[0])
  produceResources(s, 8)
  assert.deepEqual(s.players[0].resources, res({ lumber: 1 }))
  assert.equal(s.players[1].resources.ore, 0)
  assert.equal(s.bank.ore, 1)
  assert.equal(s.bank.lumber, 18)
})

test('rollDice only validates in preRoll', () => {
  const pre = makeTestState({ phase: { kind: 'preRoll' } })
  assert.equal(turnHandlers.rollDice.validate(pre, { type: 'rollDice' }), null)
  const main = makeTestState()
  assert.ok(turnHandlers.rollDice.validate(main, { type: 'rollDice' }))
})

test('main-only actions are rejected outside main', () => {
  const s = makeTestState({ phase: { kind: 'preRoll' } })
  assert.ok(turnHandlers.buildRoad.validate(s, { type: 'buildRoad', edge: 0 }))
  assert.ok(turnHandlers.buildSettlement.validate(s, { type: 'buildSettlement', vertex: 0 }))
  assert.ok(turnHandlers.buildCity.validate(s, { type: 'buildCity', vertex: 0 }))
  assert.ok(turnHandlers.buyDevCard.validate(s, { type: 'buyDevCard' }))
  assert.ok(turnHandlers.maritimeTrade.validate(s, { type: 'maritimeTrade', give: 'ore', get: 'lumber' }))
  assert.ok(
    turnHandlers.domesticTrade.validate(s, {
      type: 'domesticTrade',
      partner: 1,
      give: res({ ore: 1 }),
      get: res({ lumber: 1 }),
    }),
  )
  assert.ok(turnHandlers.endTurn.validate(s, { type: 'endTurn' }))
})

test('rollDice rolls two dice, produces on a non-7 roll and enters main', () => {
  const found = findSeed((sum) => sum === 8)
  const s = makeTestState({ phase: { kind: 'preRoll' } })
  s.rng = found.seed
  putSettlement(s, 0, HEXES[11].vertices[0])
  turnHandlers.rollDice.apply(s, { type: 'rollDice' })
  assert.deepEqual(s.dice, found.dice)
  assert.equal(s.phase.kind, 'main')
  assert.deepEqual(s.players[0].resources, res({ ore: 1 }))
  assert.equal(s.events[0].type, 'roll')
  assert.equal(s.events[1].type, 'produce')
})

test('rollDice on a 7 starts seven resolution', () => {
  const found = findSeed((sum) => sum === 7)
  const s = makeTestState({ phase: { kind: 'preRoll' } })
  s.rng = found.seed
  turnHandlers.rollDice.apply(s, { type: 'rollDice' })
  assert.deepEqual(s.dice, found.dice)
  assert.ok(s.phase.kind === 'discard' || s.phase.kind === 'moveRobber')
  assert.equal(s.events[0].type, 'roll')
})

test('buildRoad charges brick and lumber in main', () => {
  const s = makeTestState()
  putSettlement(s, 0, 4)
  give(s, 0, res({ brick: 1, lumber: 1 }))
  const edge = VERTICES[4].edges[0]
  assert.equal(turnHandlers.buildRoad.validate(s, { type: 'buildRoad', edge }), null)
  turnHandlers.buildRoad.apply(s, { type: 'buildRoad', edge })
  assert.deepEqual(s.players[0].resources, emptyResources())
  assert.deepEqual(s.bank, FULL_BANK)
  assert.equal(s.roads[edge], 0)
  assert.equal(s.players[0].roadsLeft, 14)
})

test('buildRoad rejects insufficient resources', () => {
  const s = makeTestState()
  putSettlement(s, 0, 4)
  give(s, 0, res({ brick: 1 }))
  assert.ok(turnHandlers.buildRoad.validate(s, { type: 'buildRoad', edge: VERTICES[4].edges[0] }))
})

test('buildSettlement charges all four resources', () => {
  const s = makeTestState()
  putSettlement(s, 0, 4)
  putRoadPath(s, 0, [4, 8, 12])
  give(s, 0, res({ brick: 1, lumber: 1, wool: 1, grain: 1 }))
  assert.equal(turnHandlers.buildSettlement.validate(s, { type: 'buildSettlement', vertex: 12 }), null)
  turnHandlers.buildSettlement.apply(s, { type: 'buildSettlement', vertex: 12 })
  assert.deepEqual(s.players[0].resources, emptyResources())
  assert.deepEqual(s.bank, FULL_BANK)
  assert.equal(s.buildings[12]?.owner, 0)
  assert.equal(s.players[0].settlementsLeft, 3)
})

test('buildSettlement rejects insufficient resources', () => {
  const s = makeTestState()
  putSettlement(s, 0, 4)
  putRoadPath(s, 0, [4, 8, 12])
  give(s, 0, res({ brick: 1, lumber: 1, wool: 1 }))
  assert.ok(turnHandlers.buildSettlement.validate(s, { type: 'buildSettlement', vertex: 12 }))
})

test('buildCity charges 3 ore and 2 grain and returns the settlement piece', () => {
  const s = makeTestState()
  putSettlement(s, 0, 12)
  give(s, 0, res({ ore: 3, grain: 2 }))
  assert.equal(turnHandlers.buildCity.validate(s, { type: 'buildCity', vertex: 12 }), null)
  turnHandlers.buildCity.apply(s, { type: 'buildCity', vertex: 12 })
  assert.deepEqual(s.players[0].resources, emptyResources())
  assert.deepEqual(s.bank, FULL_BANK)
  assert.equal(s.buildings[12]?.kind, 'city')
  assert.equal(s.players[0].settlementsLeft, 5)
  assert.equal(s.players[0].citiesLeft, 3)
})

test('buildCity rejects insufficient resources', () => {
  const s = makeTestState()
  putSettlement(s, 0, 12)
  give(s, 0, res({ ore: 3, grain: 1 }))
  assert.ok(turnHandlers.buildCity.validate(s, { type: 'buildCity', vertex: 12 }))
})

test('buyDevCard charges ore, wool and grain, pops the deck end into newDevCards without revealing', () => {
  const s = makeTestState()
  give(s, 0, res({ ore: 1, wool: 1, grain: 1 }))
  assert.equal(turnHandlers.buyDevCard.validate(s, { type: 'buyDevCard' }), null)
  turnHandlers.buyDevCard.apply(s, { type: 'buyDevCard' })
  assert.deepEqual(s.players[0].resources, emptyResources())
  assert.deepEqual(s.bank, FULL_BANK)
  assert.equal(s.devDeck.length, 24)
  assert.deepEqual(s.players[0].newDevCards, ['monopoly'])
  assert.deepEqual(s.players[0].devCards, [])
  const event = s.events[s.events.length - 1]
  assert.equal(event.type, 'boughtDevCard')
  assert.equal('card' in event, false)
})

test('buyDevCard rejects an empty deck and insufficient resources', () => {
  const empty = makeTestState()
  give(empty, 0, res({ ore: 1, wool: 1, grain: 1 }))
  empty.devDeck = []
  assert.ok(turnHandlers.buyDevCard.validate(empty, { type: 'buyDevCard' }))
  const poor = makeTestState()
  give(poor, 0, res({ ore: 1, wool: 1 }))
  assert.ok(turnHandlers.buyDevCard.validate(poor, { type: 'buyDevCard' }))
})

test('piece limits are enforced', () => {
  const road = makeTestState()
  putSettlement(road, 0, 4)
  give(road, 0, res({ brick: 1, lumber: 1 }))
  road.players[0].roadsLeft = 0
  assert.ok(turnHandlers.buildRoad.validate(road, { type: 'buildRoad', edge: VERTICES[4].edges[0] }))

  const settlement = makeTestState()
  putSettlement(settlement, 0, 4)
  putRoadPath(settlement, 0, [4, 8, 12])
  give(settlement, 0, res({ brick: 1, lumber: 1, wool: 1, grain: 1 }))
  settlement.players[0].settlementsLeft = 0
  assert.ok(turnHandlers.buildSettlement.validate(settlement, { type: 'buildSettlement', vertex: 12 }))

  const city = makeTestState()
  putSettlement(city, 0, 12)
  give(city, 0, res({ ore: 3, grain: 2 }))
  city.players[0].citiesLeft = 0
  assert.ok(turnHandlers.buildCity.validate(city, { type: 'buildCity', vertex: 12 }))
})

test('roads can extend through own roads but not through opposing buildings', () => {
  const own = makeTestState()
  putSettlement(own, 0, 4)
  putRoadPath(own, 0, [4, 8])
  give(own, 0, res({ brick: 1, lumber: 1 }))
  const edge = edgeBetween(8, 12)
  assert.notEqual(edge, null)
  assert.equal(turnHandlers.buildRoad.validate(own, { type: 'buildRoad', edge: edge! }), null)

  const blocked = makeTestState()
  putSettlement(blocked, 0, 4)
  putRoadPath(blocked, 0, [4, 8])
  putSettlement(blocked, 1, 8)
  assert.ok(turnHandlers.buildRoad.validate(blocked, { type: 'buildRoad', edge: edge! }))
})

test('settlements obey the distance rule and the own-road requirement', () => {
  const s = makeTestState()
  putSettlement(s, 0, 4)
  putRoadPath(s, 0, [4, 8])
  give(s, 0, res({ brick: 1, lumber: 1, wool: 1, grain: 1 }))
  assert.ok(turnHandlers.buildSettlement.validate(s, { type: 'buildSettlement', vertex: 8 }))
  assert.ok(turnHandlers.buildSettlement.validate(s, { type: 'buildSettlement', vertex: 0 }))
  putRoadPath(s, 0, [8, 12])
  assert.equal(turnHandlers.buildSettlement.validate(s, { type: 'buildSettlement', vertex: 12 }), null)
  turnHandlers.buildSettlement.apply(s, { type: 'buildSettlement', vertex: 12 })
  assert.equal(s.buildings[12]?.owner, 0)
})

test('roadBuilding counts down and is free', () => {
  const s = makeTestState({ phase: { kind: 'roadBuilding', remaining: 2, returnTo: 'main' } })
  putSettlement(s, 0, 4)
  const [e1, e2] = VERTICES[4].edges
  assert.equal(turnHandlers.buildRoad.validate(s, { type: 'buildRoad', edge: e1 }), null)
  turnHandlers.buildRoad.apply(s, { type: 'buildRoad', edge: e1 })
  assert.equal(s.phase.kind, 'roadBuilding')
  assert.equal(s.phase.kind === 'roadBuilding' ? s.phase.remaining : -1, 1)
  turnHandlers.buildRoad.apply(s, { type: 'buildRoad', edge: e2 })
  assert.equal(s.phase.kind, 'main')
  assert.equal(s.players[0].roadsLeft, 13)
  assert.deepEqual(s.bank, FULL_BANK)
})

test('roadBuilding exits early when no legal road remains', () => {
  const s = makeTestState({ phase: { kind: 'roadBuilding', remaining: 2, returnTo: 'main' } })
  putSettlement(s, 0, 4)
  const blocked = VERTICES[4].edges.filter((e) => e !== 7)
  s.roads[blocked[0]] = 1
  s.roads[blocked[1]] = 1
  putSettlement(s, 1, 8)
  assert.equal(turnHandlers.buildRoad.validate(s, { type: 'buildRoad', edge: 7 }), null)
  turnHandlers.buildRoad.apply(s, { type: 'buildRoad', edge: 7 })
  assert.equal(s.phase.kind, 'main')
  assert.equal(s.players[0].roadsLeft, 14)
})

test('maritimeTrade rate 4 with no harbour', () => {
  const s = makeTestState()
  give(s, 0, res({ ore: 4 }))
  assert.equal(turnHandlers.maritimeTrade.validate(s, { type: 'maritimeTrade', give: 'ore', get: 'lumber' }), null)
  turnHandlers.maritimeTrade.apply(s, { type: 'maritimeTrade', give: 'ore', get: 'lumber' })
  assert.deepEqual(s.players[0].resources, res({ lumber: 1 }))
  assert.deepEqual(s.bank, res({ brick: 19, lumber: 18, wool: 19, grain: 19, ore: 19 }))
  assert.equal(s.events[0].type, 'maritimeTrade')
})

test('maritimeTrade rate 3 with an any harbour', () => {
  const s = makeTestState()
  putSettlement(s, 0, 21)
  give(s, 0, res({ brick: 3 }))
  assert.equal(turnHandlers.maritimeTrade.validate(s, { type: 'maritimeTrade', give: 'brick', get: 'ore' }), null)
  turnHandlers.maritimeTrade.apply(s, { type: 'maritimeTrade', give: 'brick', get: 'ore' })
  assert.deepEqual(s.players[0].resources, res({ ore: 1 }))
  assert.deepEqual(s.bank, res({ brick: 19, lumber: 19, wool: 19, grain: 19, ore: 18 }))
})

test('maritimeTrade rate 2 with a matching 2:1 harbour on either vertex', () => {
  for (const vertex of [15, 20]) {
    const s = makeTestState()
    putSettlement(s, 0, vertex)
    give(s, 0, res({ brick: 2, lumber: 4 }))
    assert.equal(turnHandlers.maritimeTrade.validate(s, { type: 'maritimeTrade', give: 'brick', get: 'ore' }), null)
    turnHandlers.maritimeTrade.apply(s, { type: 'maritimeTrade', give: 'brick', get: 'ore' })
    assert.equal(s.players[0].resources.ore, 1)
    assert.equal(turnHandlers.maritimeTrade.validate(s, { type: 'maritimeTrade', give: 'lumber', get: 'grain' }), null)
    turnHandlers.maritimeTrade.apply(s, { type: 'maritimeTrade', give: 'lumber', get: 'grain' })
    assert.equal(s.players[0].resources.grain, 1)
  }
})

test('maritimeTrade rejects give === get, insufficient cards and an empty bank', () => {
  const same = makeTestState()
  give(same, 0, res({ ore: 4 }))
  assert.ok(turnHandlers.maritimeTrade.validate(same, { type: 'maritimeTrade', give: 'ore', get: 'ore' }))

  const poor = makeTestState()
  give(poor, 0, res({ ore: 3 }))
  assert.ok(turnHandlers.maritimeTrade.validate(poor, { type: 'maritimeTrade', give: 'ore', get: 'lumber' }))

  const empty = makeTestState()
  give(empty, 0, res({ ore: 4 }))
  empty.bank.lumber = 0
  assert.ok(turnHandlers.maritimeTrade.validate(empty, { type: 'maritimeTrade', give: 'ore', get: 'lumber' }))
})

test('domesticTrade exchanges resources between the two players only', () => {
  const s = makeTestState()
  give(s, 0, res({ brick: 1, lumber: 1 }))
  give(s, 1, res({ wool: 2 }))
  const action = {
    type: 'domesticTrade',
    partner: 1,
    give: res({ brick: 1, lumber: 1 }),
    get: res({ wool: 2 }),
  } as const
  assert.equal(turnHandlers.domesticTrade.validate(s, action), null)
  turnHandlers.domesticTrade.apply(s, action)
  assert.deepEqual(s.players[0].resources, res({ wool: 2 }))
  assert.deepEqual(s.players[1].resources, res({ brick: 1, lumber: 1 }))
  assert.deepEqual(s.bank, res({ brick: 18, lumber: 18, wool: 17, grain: 19, ore: 19 }))
  assert.equal(s.events[0].type, 'domesticTrade')
})

test('domesticTrade rejects invalid exchanges', () => {
  const emptySide = makeTestState()
  give(emptySide, 0, res({ brick: 1 }))
  give(emptySide, 1, res({ wool: 1 }))
  assert.ok(
    turnHandlers.domesticTrade.validate(emptySide, {
      type: 'domesticTrade',
      partner: 1,
      give: res({}),
      get: res({ wool: 1 }),
    }),
  )
  assert.ok(
    turnHandlers.domesticTrade.validate(emptySide, {
      type: 'domesticTrade',
      partner: 1,
      give: res({ brick: 1 }),
      get: res({}),
    }),
  )

  const overlap = makeTestState()
  give(overlap, 0, res({ brick: 1 }))
  give(overlap, 1, res({ brick: 1 }))
  assert.ok(
    turnHandlers.domesticTrade.validate(overlap, {
      type: 'domesticTrade',
      partner: 1,
      give: res({ brick: 1 }),
      get: res({ brick: 1 }),
    }),
  )

  const poorCurrent = makeTestState()
  give(poorCurrent, 0, res({ brick: 1 }))
  give(poorCurrent, 1, res({ wool: 1 }))
  assert.ok(
    turnHandlers.domesticTrade.validate(poorCurrent, {
      type: 'domesticTrade',
      partner: 1,
      give: res({ brick: 2 }),
      get: res({ wool: 1 }),
    }),
  )

  const poorPartner = makeTestState()
  give(poorPartner, 0, res({ brick: 1 }))
  give(poorPartner, 1, res({ wool: 1 }))
  assert.ok(
    turnHandlers.domesticTrade.validate(poorPartner, {
      type: 'domesticTrade',
      partner: 1,
      give: res({ brick: 1 }),
      get: res({ wool: 2 }),
    }),
  )

  const self = makeTestState()
  give(self, 0, res({ brick: 1 }))
  assert.ok(
    turnHandlers.domesticTrade.validate(self, {
      type: 'domesticTrade',
      partner: 0,
      give: res({ brick: 1 }),
      get: res({ wool: 1 }),
    }),
  )

  const badPartner = makeTestState()
  give(badPartner, 0, res({ brick: 1 }))
  assert.ok(
    turnHandlers.domesticTrade.validate(badPartner, {
      type: 'domesticTrade',
      partner: 4,
      give: res({ brick: 1 }),
      get: res({ wool: 1 }),
    }),
  )
})

test('domesticTrade rejects malformed counts', () => {
  const s = makeTestState()
  give(s, 0, res({ brick: 1 }))
  give(s, 1, res({ wool: 1 }))
  const bad = (giveCounts: unknown) =>
    turnHandlers.domesticTrade.validate(s, {
      type: 'domesticTrade',
      partner: 1,
      give: giveCounts as ResourceCounts,
      get: res({ wool: 1 }),
    })
  assert.ok(bad({ brick: 1 }))
  assert.ok(bad({ brick: 1.5, lumber: 0, wool: 0, grain: 0, ore: 0 }))
  assert.ok(bad({ brick: -1, lumber: 0, wool: 0, grain: 0, ore: 0 }))
  assert.ok(bad(null))
})

test('endTurn moves newDevCards into devCards, clears flags and advances the turn', () => {
  const s = makeTestState()
  s.players[0].newDevCards = ['knight']
  s.devCardPlayedThisTurn = true
  s.dice = [3, 4]
  assert.equal(turnHandlers.endTurn.validate(s, { type: 'endTurn' }), null)
  turnHandlers.endTurn.apply(s, { type: 'endTurn' })
  assert.equal(s.current, 1)
  assert.equal(s.turn, 2)
  assert.equal(s.phase.kind, 'preRoll')
  assert.deepEqual(s.players[0].devCards, ['knight'])
  assert.deepEqual(s.players[0].newDevCards, [])
  assert.equal(s.devCardPlayedThisTurn, false)
  assert.equal(s.dice, null)
  assert.equal(s.events[0].type, 'turnEnded')
})

test('endTurn wraps current from the last seat to seat 0', () => {
  const s = makeTestState({ current: 3 })
  turnHandlers.endTurn.apply(s, { type: 'endTurn' })
  assert.equal(s.current, 0)
  assert.equal(s.turn, 2)
})

test('bought cards are not playable until moved on endTurn', () => {
  const s = makeTestState()
  give(s, 0, res({ ore: 1, wool: 1, grain: 1 }))
  turnHandlers.buyDevCard.apply(s, { type: 'buyDevCard' })
  assert.deepEqual(s.players[0].devCards, [])
  assert.equal(s.players[0].newDevCards.length, 1)
  turnHandlers.endTurn.apply(s, { type: 'endTurn' })
  assert.deepEqual(s.players[0].devCards, ['monopoly'])
  assert.deepEqual(s.players[0].newDevCards, [])
})

test('actions conserve the total of every resource', () => {
  const s = makeTestState()
  putSettlement(s, 0, 4)
  give(s, 0, res({ brick: 4, lumber: 3, wool: 2, grain: 4, ore: 8 }))
  give(s, 1, res({ wool: 1 }))
  turnHandlers.buildRoad.apply(s, { type: 'buildRoad', edge: edgeBetween(4, 8)! })
  assert.deepEqual(resourceTotals(s), FULL_BANK)
  turnHandlers.buildRoad.apply(s, { type: 'buildRoad', edge: edgeBetween(8, 12)! })
  assert.deepEqual(resourceTotals(s), FULL_BANK)
  turnHandlers.buildSettlement.apply(s, { type: 'buildSettlement', vertex: 12 })
  assert.deepEqual(resourceTotals(s), FULL_BANK)
  turnHandlers.buildCity.apply(s, { type: 'buildCity', vertex: 12 })
  assert.deepEqual(resourceTotals(s), FULL_BANK)
  turnHandlers.buyDevCard.apply(s, { type: 'buyDevCard' })
  assert.deepEqual(resourceTotals(s), FULL_BANK)
  turnHandlers.maritimeTrade.apply(s, { type: 'maritimeTrade', give: 'ore', get: 'lumber' })
  assert.deepEqual(resourceTotals(s), FULL_BANK)
  turnHandlers.domesticTrade.apply(s, {
    type: 'domesticTrade',
    partner: 1,
    give: res({ brick: 1 }),
    get: res({ wool: 1 }),
  })
  assert.deepEqual(resourceTotals(s), FULL_BANK)
})

test('validate never mutates state', () => {
  const s = makeTestState()
  give(s, 0, res({ brick: 1, ore: 4 }))
  putSettlement(s, 0, 4)
  const snapshot = structuredClone(s)
  turnHandlers.rollDice.validate(s, { type: 'rollDice' })
  turnHandlers.buildRoad.validate(s, { type: 'buildRoad', edge: 999 })
  turnHandlers.buildSettlement.validate(s, { type: 'buildSettlement', vertex: 999 })
  turnHandlers.buildCity.validate(s, { type: 'buildCity', vertex: 999 })
  turnHandlers.buyDevCard.validate(s, { type: 'buyDevCard' })
  turnHandlers.maritimeTrade.validate(s, { type: 'maritimeTrade', give: 'ore', get: 'ore' })
  turnHandlers.domesticTrade.validate(s, {
    type: 'domesticTrade',
    partner: 1,
    give: res({ brick: 1 }),
    get: res({ brick: 1 }),
  })
  turnHandlers.endTurn.validate(s, { type: 'endTurn' })
  assert.deepEqual(s, snapshot)
})
