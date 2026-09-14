import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { createGame } from './board'
import { applyAction } from './engine'
import { legalSetupRoads, legalSetupSettlements } from './helpers'
import { clearGame, loadGame, saveGame } from './save'
import type { GameState, Player } from './types'

const SAVE_KEY = 'catan-save-v1'

class MemoryStorage {
  private data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value))
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null
  }

  get length(): number {
    return this.data.size
  }
}

const g = globalThis as unknown as { window?: unknown }

function withWindow(storage: MemoryStorage): void {
  g.window = { localStorage: storage }
}

function withoutWindow(): void {
  delete g.window
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function loadRejects(storage: MemoryStorage, value: unknown): void {
  storage.setItem(SAVE_KEY, JSON.stringify(value))
  assert.equal(loadGame(), null)
  assert.equal(storage.getItem(SAVE_KEY), null)
}

function midGameState(): GameState {
  let state = createGame({ seed: 99, playerCount: 4, humanName: 'Ahmed' })
  while (state.phase.kind === 'setup') {
    if (state.phase.step === 'settlement') {
      state = applyAction(state, { type: 'placeSetupSettlement', vertex: legalSetupSettlements(state)[0] })
    } else {
      state = applyAction(state, { type: 'placeSetupRoad', edge: legalSetupRoads(state)[0] })
    }
  }
  return applyAction(state, { type: 'rollDice' })
}

describe('catan save', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    withWindow(storage)
  })

  afterEach(() => {
    withoutWindow()
  })

  test('round-trips a game through localStorage', () => {
    const state = createGame({ seed: 12345, playerCount: 4, humanName: 'Ahmed' })
    saveGame(state)
    const loaded = loadGame()
    assert.ok(loaded)
    assert.deepEqual(loaded, JSON.parse(JSON.stringify(state)))
  })

  test('round-trips a mid-game state produced by the engine', () => {
    const state = midGameState()
    saveGame(state)
    const loaded = loadGame()
    assert.ok(loaded)
    assert.deepEqual(loaded, clone(state))
  })

  test('returns null when no save exists', () => {
    assert.equal(loadGame(), null)
  })

  test('removes and rejects corrupt JSON', () => {
    storage.setItem(SAVE_KEY, '{not-json')
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY), null)
  })

  test('removes and rejects the wrong version', () => {
    const state = createGame({ seed: 1, playerCount: 4 })
    storage.setItem(SAVE_KEY, JSON.stringify({ ...state, version: 2 }))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY), null)
  })

  test('removes and rejects wrong top-level shapes', () => {
    const state = createGame({ seed: 2, playerCount: 3 })

    const wrongTiles = clone(state)
    wrongTiles.tiles = wrongTiles.tiles.slice(0, 18)
    storage.setItem(SAVE_KEY, JSON.stringify(wrongTiles))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY), null)

    const wrongBuildings = clone(state)
    wrongBuildings.buildings = wrongBuildings.buildings.slice(0, 53)
    storage.setItem(SAVE_KEY, JSON.stringify(wrongBuildings))
    assert.equal(loadGame(), null)

    const wrongRoads = clone(state)
    wrongRoads.roads = wrongRoads.roads.slice(0, 71)
    storage.setItem(SAVE_KEY, JSON.stringify(wrongRoads))
    assert.equal(loadGame(), null)

    const badRng = clone(state)
    ;(badRng as { rng: unknown }).rng = 'abc'
    storage.setItem(SAVE_KEY, JSON.stringify(badRng))
    assert.equal(loadGame(), null)

    const badPhase = clone(state)
    ;(badPhase as { phase: unknown }).phase = { kind: 'notARealPhase' }
    storage.setItem(SAVE_KEY, JSON.stringify(badPhase))
    assert.equal(loadGame(), null)
  })

  test('removes and rejects wrong player counts and non-human sets', () => {
    const state = createGame({ seed: 3, playerCount: 4 })

    const twoPlayers = clone(state)
    twoPlayers.players = twoPlayers.players.slice(0, 2)
    storage.setItem(SAVE_KEY, JSON.stringify(twoPlayers))
    assert.equal(loadGame(), null)

    const allBots = clone(state)
    for (const p of allBots.players) p.isBot = true
    storage.setItem(SAVE_KEY, JSON.stringify(allBots))
    assert.equal(loadGame(), null)

    const twoHumans = clone(state)
    for (const p of twoHumans.players) p.isBot = false
    storage.setItem(SAVE_KEY, JSON.stringify(twoHumans))
    assert.equal(loadGame(), null)
  })

  test('removes and rejects the review crash payloads', () => {
    const state = createGame({ seed: 4, playerCount: 4 })

    const missingResources = clone(state)
    delete (missingResources.players[0] as Partial<Player>).resources
    loadRejects(storage, missingResources)

    const gameOverNoWinner = clone(state)
    ;(gameOverNoWinner as { phase: unknown }).phase = { kind: 'gameOver' }
    loadRejects(storage, gameOverNoWinner)

    const discardNoDiscards = clone(state)
    ;(discardNoDiscards as { phase: unknown }).phase = { kind: 'discard' }
    loadRejects(storage, discardNoDiscards)
  })

  test('removes and rejects out-of-range ids', () => {
    const state = createGame({ seed: 5, playerCount: 3 })

    const badCurrent = clone(state)
    badCurrent.current = 99
    loadRejects(storage, badCurrent)

    const badOwner = clone(state)
    badOwner.buildings[0] = { owner: 99, kind: 'settlement' }
    loadRejects(storage, badOwner)

    const badCandidate = clone(state)
    badCandidate.phase = { kind: 'steal', candidates: [99], returnTo: 'main' }
    loadRejects(storage, badCandidate)

    const badRobber = clone(state)
    badRobber.robber = 99
    loadRejects(storage, badRobber)
  })

  test('removes and rejects a discard phase with the wrong discards length', () => {
    const state = createGame({ seed: 6, playerCount: 4 })
    const badDiscards = clone(state)
    badDiscards.phase = { kind: 'discard', discards: [1, 2] }
    loadRejects(storage, badDiscards)
  })

  test('is a safe no-op without window (SSR)', () => {
    withoutWindow()
    assert.equal(loadGame(), null)
    assert.doesNotThrow(() => saveGame(createGame({ seed: 4, playerCount: 3 })))
    assert.doesNotThrow(() => clearGame())
  })
})
