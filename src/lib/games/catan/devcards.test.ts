import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeTestState, give, putSettlement, res } from './test-fixtures'
import { devCardHandlers, updateLargestArmy } from './devcards'
import type { ActionOf, Phase } from './types'

test('playKnight returns to preRoll when played in preRoll and to main when played in main', () => {
  const pre = makeTestState({ phase: { kind: 'preRoll' } })
  pre.players[0].devCards.push('knight')
  assert.equal(devCardHandlers.playKnight.validate(pre, { type: 'playKnight' }), null)
  devCardHandlers.playKnight.apply(pre, { type: 'playKnight' })
  assert.deepEqual(pre.phase, { kind: 'moveRobber', returnTo: 'preRoll' })
  assert.equal(pre.players[0].knightsPlayed, 1)
  assert.equal(pre.devCardPlayedThisTurn, true)
  assert.deepEqual(pre.players[0].devCards, [])
  assert.equal(pre.events.at(-1)?.type, 'playedDevCard')

  const main = makeTestState({ phase: { kind: 'main' } })
  main.players[0].devCards.push('knight')
  devCardHandlers.playKnight.apply(main, { type: 'playKnight' })
  assert.deepEqual(main.phase, { kind: 'moveRobber', returnTo: 'main' })
  assert.equal(main.players[0].knightsPlayed, 1)
})

test('only one dev card may be played per turn', () => {
  const state = makeTestState()
  state.players[0].devCards.push('monopoly', 'knight')
  devCardHandlers.playMonopoly.apply(state, { type: 'playMonopoly', resource: 'brick' })
  assert.equal(devCardHandlers.playKnight.validate(state, { type: 'playKnight' }), 'Already played a dev card this turn')
  assert.equal(devCardHandlers.playRoadBuilding.validate(state, { type: 'playRoadBuilding' }), 'Already played a dev card this turn')
})

test('cards bought this turn cannot be played', () => {
  const state = makeTestState()
  state.players[0].newDevCards.push('knight')
  assert.equal(devCardHandlers.playKnight.validate(state, { type: 'playKnight' }), 'Card not in hand')
})

test('victoryPoint cards are never playable and are never consumed', () => {
  const onlyVp = makeTestState()
  onlyVp.players[0].devCards.push('victoryPoint')
  assert.equal(devCardHandlers.playKnight.validate(onlyVp, { type: 'playKnight' }), 'Card not in hand')
  assert.equal(devCardHandlers.playRoadBuilding.validate(onlyVp, { type: 'playRoadBuilding' }), 'Card not in hand')
  assert.equal(devCardHandlers.playYearOfPlenty.validate(onlyVp, { type: 'playYearOfPlenty', resources: ['brick', 'lumber'] }), 'Card not in hand')
  assert.equal(devCardHandlers.playMonopoly.validate(onlyVp, { type: 'playMonopoly', resource: 'brick' }), 'Card not in hand')

  const state = makeTestState()
  state.players[0].devCards.push('victoryPoint', 'knight')
  devCardHandlers.playKnight.apply(state, { type: 'playKnight' })
  assert.deepEqual(state.players[0].devCards, ['victoryPoint'])
})

test('dev cards cannot be played outside preRoll or main', () => {
  const phases: Phase[] = [
    { kind: 'discard', discards: [0, 0, 0, 0] },
    { kind: 'moveRobber', returnTo: 'main' },
    { kind: 'steal', candidates: [1], returnTo: 'main' },
    { kind: 'roadBuilding', remaining: 2, returnTo: 'main' },
    { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null },
  ]
  for (const phase of phases) {
    const state = makeTestState({ phase })
    state.players[0].devCards.push('knight', 'roadBuilding', 'yearOfPlenty', 'monopoly')
    assert.equal(devCardHandlers.playKnight.validate(state, { type: 'playKnight' }), 'Dev cards can only be played in preRoll or main')
    assert.equal(devCardHandlers.playRoadBuilding.validate(state, { type: 'playRoadBuilding' }), 'Dev cards can only be played in preRoll or main')
    assert.equal(devCardHandlers.playYearOfPlenty.validate(state, { type: 'playYearOfPlenty', resources: ['brick', 'lumber'] }), 'Dev cards can only be played in preRoll or main')
    assert.equal(devCardHandlers.playMonopoly.validate(state, { type: 'playMonopoly', resource: 'brick' }), 'Dev cards can only be played in preRoll or main')
  }
})

test('road building needs a road piece and a legal spot, remaining is min(2, roadsLeft)', () => {
  const noSpot = makeTestState()
  noSpot.players[0].devCards.push('roadBuilding')
  assert.equal(devCardHandlers.playRoadBuilding.validate(noSpot, { type: 'playRoadBuilding' }), 'No legal road spot')

  const noPieces = makeTestState()
  noPieces.players[0].devCards.push('roadBuilding')
  putSettlement(noPieces, 0, 0)
  noPieces.players[0].roadsLeft = 0
  assert.equal(devCardHandlers.playRoadBuilding.validate(noPieces, { type: 'playRoadBuilding' }), 'No road pieces left')

  const onePiece = makeTestState()
  onePiece.players[0].devCards.push('roadBuilding')
  putSettlement(onePiece, 0, 0)
  onePiece.players[0].roadsLeft = 1
  assert.equal(devCardHandlers.playRoadBuilding.validate(onePiece, { type: 'playRoadBuilding' }), null)
  devCardHandlers.playRoadBuilding.apply(onePiece, { type: 'playRoadBuilding' })
  assert.deepEqual(onePiece.phase, { kind: 'roadBuilding', remaining: 1, returnTo: 'main' })

  const twoPieces = makeTestState()
  twoPieces.players[0].devCards.push('roadBuilding')
  putSettlement(twoPieces, 0, 0)
  devCardHandlers.playRoadBuilding.apply(twoPieces, { type: 'playRoadBuilding' })
  assert.deepEqual(twoPieces.phase, { kind: 'roadBuilding', remaining: 2, returnTo: 'main' })
})

test('year of plenty takes two of the same resource from the bank', () => {
  const state = makeTestState()
  state.players[0].devCards.push('yearOfPlenty')
  const action: ActionOf<'playYearOfPlenty'> = { type: 'playYearOfPlenty', resources: ['ore', 'ore'] }
  assert.equal(devCardHandlers.playYearOfPlenty.validate(state, action), null)
  devCardHandlers.playYearOfPlenty.apply(state, action)
  assert.equal(state.bank.ore, 17)
  assert.equal(state.players[0].resources.ore, 2)
  assert.equal(state.events.at(-1)?.type, 'yearOfPlenty')
})

test('year of plenty rejects empty-bank requests and malformed resources', () => {
  const state = makeTestState()
  state.players[0].devCards.push('yearOfPlenty')

  state.bank.ore = 1
  assert.equal(devCardHandlers.playYearOfPlenty.validate(state, { type: 'playYearOfPlenty', resources: ['ore', 'ore'] }), 'Bank does not have those resources')

  state.bank.ore = 0
  state.bank.brick = 0
  assert.equal(devCardHandlers.playYearOfPlenty.validate(state, { type: 'playYearOfPlenty', resources: ['brick', 'ore'] }), 'Bank does not have those resources')

  assert.equal(
    devCardHandlers.playYearOfPlenty.validate(state, { type: 'playYearOfPlenty', resources: ['gold', 'ore'] } as unknown as ActionOf<'playYearOfPlenty'>),
    'Invalid resources',
  )
  assert.equal(
    devCardHandlers.playYearOfPlenty.validate(state, { type: 'playYearOfPlenty', resources: 'bad' } as unknown as ActionOf<'playYearOfPlenty'>),
    'Invalid resources',
  )
})

test('monopoly takes every card of one resource from all other players only', () => {
  const state = makeTestState()
  state.players[0].devCards.push('monopoly')
  give(state, 0, res({ brick: 2 }))
  give(state, 1, res({ brick: 3 }))
  give(state, 2, res({ wool: 4 }))
  give(state, 3, res({ brick: 5 }))

  assert.equal(devCardHandlers.playMonopoly.validate(state, { type: 'playMonopoly', resource: 'brick' }), null)
  assert.equal(
    devCardHandlers.playMonopoly.validate(state, { type: 'playMonopoly', resource: 'gold' } as unknown as ActionOf<'playMonopoly'>),
    'Invalid resource',
  )
  devCardHandlers.playMonopoly.apply(state, { type: 'playMonopoly', resource: 'brick' })

  assert.equal(state.players[0].resources.brick, 10)
  assert.equal(state.players[1].resources.brick, 0)
  assert.equal(state.players[2].resources.brick, 0)
  assert.equal(state.players[2].resources.wool, 4)
  assert.equal(state.players[3].resources.brick, 0)

  const event = state.events.at(-1)
  assert.ok(event && event.type === 'monopoly')
  if (event?.type === 'monopoly') assert.equal(event.taken, 8)
})

test('largest army: awarded at 3, tie keeps it, strictly more takes it, event only on change', () => {
  const state = makeTestState()
  state.players[1].knightsPlayed = 3
  updateLargestArmy(state)
  assert.equal(state.largestArmyHolder, 1)
  assert.equal(state.events.filter((e) => e.type === 'largestArmy').length, 1)

  updateLargestArmy(state)
  assert.equal(state.largestArmyHolder, 1)
  assert.equal(state.events.filter((e) => e.type === 'largestArmy').length, 1)

  state.players[2].knightsPlayed = 3
  updateLargestArmy(state)
  assert.equal(state.largestArmyHolder, 1)
  assert.equal(state.events.filter((e) => e.type === 'largestArmy').length, 1)

  state.players[2].knightsPlayed = 4
  updateLargestArmy(state)
  assert.equal(state.largestArmyHolder, 2)
  assert.equal(state.events.filter((e) => e.type === 'largestArmy').length, 2)
})

test('dev card validate never mutates state', () => {
  const state = makeTestState()
  state.players[0].devCards.push('knight', 'roadBuilding', 'yearOfPlenty', 'monopoly')
  putSettlement(state, 0, 0)
  const before = structuredClone(state)

  devCardHandlers.playKnight.validate(state, { type: 'playKnight' })
  devCardHandlers.playRoadBuilding.validate(state, { type: 'playRoadBuilding' })
  devCardHandlers.playYearOfPlenty.validate(state, { type: 'playYearOfPlenty', resources: ['brick', 'lumber'] })
  devCardHandlers.playMonopoly.validate(state, { type: 'playMonopoly', resource: 'brick' })

  assert.deepEqual(state, before)
})
