import assert from 'node:assert/strict'
import { test } from 'node:test'
import { chooseBotAction } from './ai'
import { RESOURCES } from './constants'
import { applyAction, humanPlayer, playersToAct, validateAction } from './engine'
import { emptyResources, totalCards } from './helpers'
import { loadGame, saveGame } from './save'
import { applyStepPrepare, createTutorialGame, isStepComplete, TUTORIAL_STEPS } from './tutorial'
import type { Action, GameState, ResourceCounts } from './types'

const store = new Map<string, string>()

const mockLocalStorage: Storage = {
  get length() {
    return store.size
  },
  clear() {
    store.clear()
  },
  getItem(key) {
    return store.has(key) ? store.get(key)! : null
  },
  key(index) {
    return [...store.keys()][index] ?? null
  },
  removeItem(key) {
    store.delete(key)
  },
  setItem(key, value) {
    store.set(key, value)
  },
}

Object.defineProperty(globalThis, 'window', { value: { localStorage: mockLocalStorage }, configurable: true })

function assertValidSave(state: GameState) {
  store.clear()
  saveGame(state)
  const loaded = loadGame()
  assert.ok(loaded, 'saved state should pass save.ts validation')
  assert.deepEqual(loaded, state)
}

function runBotsUntilHuman(state: GameState): GameState {
  let current = state
  let guard = 0
  while (guard < 200) {
    if (current.phase.kind === 'gameOver') break
    const actors = playersToAct(current)
    if (actors.length === 0 || actors.includes(humanPlayer(current))) break
    const bot = actors.find((p) => current.players[p].isBot)
    if (bot === undefined) break
    const action = chooseBotAction(current, bot)
    assert.equal(validateAction(current, action), null, `bot action ${action.type} should be legal`)
    current = applyAction(current, action)
    assertValidSave(current)
    guard += 1
  }
  assert.ok(guard < 200, 'bots should not stall')
  return current
}

function emptyCounts(): ResourceCounts {
  return emptyResources()
}

function humanActionForStep(state: GameState, stepIndex: number): Action {
  const step = TUTORIAL_STEPS[stepIndex]
  const human = humanPlayer(state)
  const phase = state.phase

  switch (phase.kind) {
    case 'setup':
      if (phase.step === 'settlement') {
        const vertex = step.highlight.vertices?.[0] ?? 0
        return { type: 'placeSetupSettlement', vertex }
      }
      return { type: 'placeSetupRoad', edge: step.highlight.edges?.[0] ?? 0 }
    case 'preRoll':
      if (step.id === 'knight') return { type: 'playKnight' }
      return { type: 'rollDice' }
    case 'discard': {
      const owed = phase.discards[human]
      const resources = emptyCounts()
      resources.grain = owed
      return { type: 'discard', player: human, resources }
    }
    case 'moveRobber':
      return { type: 'moveRobber', hex: step.highlight.hexes?.[0] ?? 0 }
    case 'steal':
      if (step.id === 'seven') return { type: 'steal', victim: 1 }
      return { type: 'steal', victim: phase.candidates[0] }
    case 'main':
      if (step.id === 'build-road') return { type: 'buildRoad', edge: step.highlight.edges?.[0] ?? 0 }
      if (step.id === 'end-turn') return { type: 'endTurn' }
      if (step.id === 'trade-settlement') {
        const hand = state.players[human].resources
        if (hand.brick === 0 && hand.ore >= 4) return { type: 'maritimeTrade', give: 'ore', get: 'brick' }
        return { type: 'buildSettlement', vertex: step.highlight.vertices?.[0] ?? 0 }
      }
      if (step.id === 'buy-card') {
        return state.players[human].newDevCards.length === 0 ? { type: 'buyDevCard' } : { type: 'endTurn' }
      }
      throw new Error(`no main action for step ${step.id}`)
    default:
      throw new Error(`unexpected phase ${phase.kind}`)
  }
}

test('createTutorialGame builds a valid, deterministic tutorial state', () => {
  const state = createTutorialGame()
  assertValidSave(state)
  assert.equal(state.players.length, 3)
  assert.equal(humanPlayer(state), 0)
  assert.equal(state.phase.kind, 'setup')
  assert.equal(state.tiles.filter((tile) => tile.terrain === 'desert').length, 1)
  assert.equal(state.tiles.filter((tile) => tile.number === null).length, 1)
  assert.deepEqual(
    state.ports.map((port) => port.edge),
    [33, 10, 1, 5, 22, 48, 71, 68, 62],
  )
  assert.equal(state.devDeck[state.devDeck.length - 1], 'knight')
  const first = createTutorialGame()
  const second = createTutorialGame()
  assert.deepEqual(first, second)
})

test('the full scripted lesson plays through the real engine', () => {
  let state = createTutorialGame()
  const human = humanPlayer(state)
  assert.equal(human, 0)

  const firstRolls: number[] = []
  const secondRolls: number[] = []

  for (let stepIndex = 0; stepIndex < TUTORIAL_STEPS.length; stepIndex++) {
    const step = TUTORIAL_STEPS[stepIndex]
    if (step.completeWhen === 'next') continue

    let prepared = false
    let guard = 0
    while (guard < 300) {
      guard += 1
      if (!playersToAct(state).includes(human)) {
        state = runBotsUntilHuman(state)
        continue
      }
      if (step.prepare && !prepared) {
        state = applyStepPrepare(state, step)
        prepared = true
        assertValidSave(state)
      }
      const before = state
      const action = humanActionForStep(state, stepIndex)
      assert.ok(step.allows(state, action), `step ${step.id} should allow ${action.type}`)
      assert.equal(validateAction(state, action), null, `step ${step.id} action should be engine-legal`)
      const after = applyAction(state, action)
      assertValidSave(after)
      state = after

      if (action.type === 'rollDice' && state.dice) {
        const total = state.dice[0] + state.dice[1]
        if (state.turn === 1) firstRolls.push(total)
        else secondRolls.push(total)
      }

      if (step.id === 'roll') {
        assert.ok(state.dice)
        assert.equal(state.dice[0] + state.dice[1], 8)
        assert.equal(state.players[human].resources.grain, 1)
      }
      if (step.id === 'build-road') {
        assert.deepEqual(before.players[human].resources, { brick: 1, lumber: 1, wool: 0, grain: 1, ore: 0 })
      }
      if (step.id === 'seven' && action.type === 'rollDice') {
        assert.ok(state.dice)
        assert.equal(state.dice[0] + state.dice[1], 7)
        assert.equal(state.phase.kind, 'discard')
        assert.equal(state.phase.kind === 'discard' ? state.phase.discards[human] : -1, 10)
      }
      if (step.id === 'trade-settlement' && action.type === 'maritimeTrade') {
        assert.deepEqual(before.players[human].resources, { brick: 0, lumber: 1, wool: 2, grain: 2, ore: 6 })
      }
      if (step.id === 'buy-card' && action.type === 'buyDevCard') {
        assert.equal(state.players[human].newDevCards[0], 'knight')
        assert.equal(state.players[human].newDevCards.length, 1)
      }
      if (step.id === 'knight' && action.type === 'playKnight') {
        assert.equal(state.players[human].knightsPlayed, 1)
      }

      if (isStepComplete(step, before, state, action)) break
    }
    assert.ok(guard < 300, `step ${step.id} should complete`)
  }

  assert.deepEqual(firstRolls, [8])
  assert.deepEqual(secondRolls, [7])
  assert.equal(state.players[human].knightsPlayed, 1)
  assert.equal(state.devDeck[state.devDeck.length - 1], 'knight')
  assert.ok(totalCards(state.players[human].resources) >= 0)
  for (const resource of RESOURCES) {
    const total = state.bank[resource] + state.players.reduce((sum, player) => sum + player.resources[resource], 0)
    assert.equal(total, 19, `${resource} must be conserved`)
  }
  assertValidSave(state)
})

test('every tutorial step has an id, copy and a next or completion rule', () => {
  assert.ok(TUTORIAL_STEPS.length >= 14)
  for (const step of TUTORIAL_STEPS) {
    assert.ok(step.id.length > 0)
    assert.ok(step.title.length > 0)
    assert.ok(step.body.length > 0)
    assert.ok(step.completeWhen === 'next' || typeof step.completeWhen === 'function')
  }
})
