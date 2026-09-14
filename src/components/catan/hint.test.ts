import assert from 'node:assert/strict'
import test from 'node:test'
import { makeTestState, res } from '@/lib/games/catan/test-fixtures'
import type { Action, Phase } from '@/lib/games/catan/types'
import { describeHint, describeHintAction } from './hint'

function hintFor(statePhase: Phase, action: Action, playerCount: 3 | 4 = 4) {
  const state = makeTestState({ phase: statePhase, current: 0, playerCount })
  return describeHintAction(state, 0, action)
}

test('describeHintAction covers every action type', () => {
  const setupSettlement = hintFor({ kind: 'setup', round: 1, step: 'settlement', lastSettlement: null }, { type: 'placeSetupSettlement', vertex: 8 })
  assert.match(setupSettlement.text, /Place your starting settlement on the corner of/)
  assert.deepEqual(setupSettlement.highlight.vertices, [8])
  assert.ok(setupSettlement.highlight.ui?.includes('board'))

  const setupRoad = hintFor({ kind: 'setup', round: 1, step: 'road', lastSettlement: 8 }, { type: 'placeSetupRoad', edge: 7 })
  assert.match(setupRoad.text, /Place your starting road on the edge between/)
  assert.deepEqual(setupRoad.highlight.edges, [7])

  const roll = hintFor({ kind: 'preRoll' }, { type: 'rollDice' })
  assert.equal(roll.text, 'Roll the dice.')
  assert.deepEqual(roll.highlight.ui, ['roll'])

  const discard = hintFor({ kind: 'discard', discards: [2, 0, 0, 0] }, { type: 'discard', player: 0, resources: res({ grain: 2 }) })
  assert.equal(discard.text, 'Discard 2 cards. Keep what you need for your next build.')
  assert.deepEqual(discard.highlight.ui, ['hand'])

  const moveRobber = hintFor({ kind: 'moveRobber', returnTo: 'main' }, { type: 'moveRobber', hex: 3 })
  assert.match(moveRobber.text, /Move the robber to/)
  assert.deepEqual(moveRobber.highlight.hexes, [3])
  assert.ok(moveRobber.highlight.ui?.includes('board'))

  const steal = hintFor({ kind: 'steal', candidates: [1], returnTo: 'main' }, { type: 'steal', victim: 1 })
  assert.equal(steal.text, 'Steal from Bot 1.')
  assert.deepEqual(steal.highlight.ui, ['players'])

  const road = hintFor({ kind: 'main' }, { type: 'buildRoad', edge: 7 })
  assert.match(road.text, /Build a road on the edge between/)
  assert.deepEqual(road.highlight.edges, [7])
  assert.ok(road.highlight.ui?.includes('build-road'))

  const settlement = hintFor({ kind: 'main' }, { type: 'buildSettlement', vertex: 8 })
  assert.match(settlement.text, /Build a settlement on the corner of .*: it adds \d+ pips of production/)
  assert.deepEqual(settlement.highlight.vertices, [8])
  assert.ok(settlement.highlight.ui?.includes('build-settlement'))

  const city = hintFor({ kind: 'main' }, { type: 'buildCity', vertex: 8 })
  assert.match(city.text, /Upgrade to a city on the corner of/)
  assert.deepEqual(city.highlight.vertices, [8])
  assert.ok(city.highlight.ui?.includes('build-city'))

  const buyCard = hintFor({ kind: 'main' }, { type: 'buyDevCard' })
  assert.equal(buyCard.text, 'Buy a development card for 1 wool, 1 grain and 1 ore.')
  assert.deepEqual(buyCard.highlight.ui, ['buy-card'])

  const knight = hintFor({ kind: 'preRoll' }, { type: 'playKnight' })
  assert.equal(knight.text, 'Play your Knight to move the robber and steal a card.')
  assert.deepEqual(knight.highlight.ui, ['play-card'])

  const roadBuilding = hintFor({ kind: 'preRoll' }, { type: 'playRoadBuilding' })
  assert.equal(roadBuilding.text, 'Play Road Building and place two free roads.')
  assert.deepEqual(roadBuilding.highlight.ui, ['play-card'])

  const yearOfPlenty = hintFor({ kind: 'preRoll' }, { type: 'playYearOfPlenty', resources: ['grain', 'ore'] })
  assert.equal(yearOfPlenty.text, 'Play Year of Plenty and take two resources from the bank.')
  assert.deepEqual(yearOfPlenty.highlight.ui, ['play-card'])

  const monopoly = hintFor({ kind: 'preRoll' }, { type: 'playMonopoly', resource: 'grain' })
  assert.equal(monopoly.text, 'Play Monopoly and name a resource to take from every opponent.')
  assert.deepEqual(monopoly.highlight.ui, ['play-card'])

  const maritime = hintFor({ kind: 'main' }, { type: 'maritimeTrade', give: 'ore', get: 'grain' })
  assert.equal(maritime.text, 'Trade 4 ore to the bank for 1 grain.')
  assert.deepEqual(maritime.highlight.ui, ['trade'])

  const domestic = hintFor({ kind: 'main' }, { type: 'domesticTrade', partner: 1, give: res({ brick: 1 }), get: res({ lumber: 1 }) })
  assert.equal(domestic.text, 'Offer a trade to Bot 1.')
  assert.deepEqual(domestic.highlight.ui, ['trade'])

  const endTurn = hintFor({ kind: 'main' }, { type: 'endTurn' })
  assert.equal(endTurn.text, 'End your turn.')
  assert.deepEqual(endTurn.highlight.ui, ['end-turn'])
})

test('describeHint follows chooseBotAction and falls back safely', () => {
  const preRoll = makeTestState({ phase: { kind: 'preRoll' }, current: 0 })
  assert.equal(describeHint(preRoll, 0).text, 'Roll the dice.')

  const gameOver = makeTestState({ phase: { kind: 'gameOver', winner: 1 }, current: 0 })
  assert.equal(describeHint(gameOver, 0).text, 'The game is over.')
  assert.deepEqual(describeHint(gameOver, 0).highlight, {})

  const bad = makeTestState({ phase: { kind: 'main' }, current: 0 })
  assert.equal(describeHint(bad, -1).text, 'No hint available.')
})
