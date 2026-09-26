import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { z } from 'zod'
import { chooseBotAction } from './ai'
import { createGame } from './board'
import { applyAction, playersToAct } from './engine'
import { emptyResources, legalSetupRoads, legalSetupSettlements } from './helpers'
import { clearGame, loadGame, SAVE_KEY_V1, SAVE_KEY_V2, saveGame, saveKeyFor, saveSchemaV2 } from './save'
import { res } from './test-fixtures'
import type { GameState, Player } from './types'

const QUARANTINE_KEY = 'catan-save-quarantine'

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

function toV1(state: GameState): Record<string, unknown> {
  const v1 = JSON.parse(JSON.stringify(state)) as Record<string, unknown>
  v1.version = 1
  delete v1.settings
  delete v1.stats
  delete v1.offersThisTurn
  delete v1.tradeSeq
  delete v1.scriptedRolls
  for (const p of v1.players as Record<string, unknown>[]) delete p.level
  for (const e of v1.events as Record<string, unknown>[]) {
    if (e.type === 'produce') {
      delete e.blocked
      delete e.shortage
    }
    if (e.type === 'monopoly') delete e.takenFrom
  }
  return v1
}

function assertRoundTrip(storage: MemoryStorage, state: GameState): GameState {
  saveGame(state)
  const loaded = loadGame()
  assert.ok(loaded, 'saved state should load')
  assert.deepEqual(loaded, clone(state))
  return loaded
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
    assertRoundTrip(storage, state)
    assert.equal(storage.getItem(SAVE_KEY_V2) !== null, true)
  })

  test('round-trips a mid-game state produced by the engine', () => {
    const state = midGameState()
    assertRoundTrip(storage, state)
  })

  test('returns null when no save exists', () => {
    assert.equal(loadGame(), null)
  })

  test('saveKeyFor names the game and tutorial keys', () => {
    assert.equal(saveKeyFor('game'), SAVE_KEY_V2)
    assert.equal(saveKeyFor('tutorial'), 'catan-tutorial-v1')
  })

  test('quarantines and removes corrupt JSON', () => {
    storage.setItem(SAVE_KEY_V2, '{not-json')
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY_V2), null)
    assert.equal(storage.getItem(QUARANTINE_KEY), '{not-json')
  })

  test('leaves a newer save version untouched', () => {
    const state = createGame({ seed: 1, playerCount: 4 })
    const v3 = clone(state) as { version: number }
    v3.version = 3
    storage.setItem(SAVE_KEY_V2, JSON.stringify(v3))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY_V2), JSON.stringify(v3))
    assert.equal(storage.getItem(QUARANTINE_KEY), null)
  })

  test('rejects wrong top-level shapes and quarantines them', () => {
    const state = createGame({ seed: 2, playerCount: 3 })

    const wrongTiles = clone(state)
    wrongTiles.tiles = wrongTiles.tiles.slice(0, 18)
    storage.setItem(SAVE_KEY_V2, JSON.stringify(wrongTiles))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY_V2), null)
    assert.equal(storage.getItem(QUARANTINE_KEY), JSON.stringify(wrongTiles))

    storage.clear()
    const wrongBuildings = clone(state)
    wrongBuildings.buildings = wrongBuildings.buildings.slice(0, 53)
    storage.setItem(SAVE_KEY_V2, JSON.stringify(wrongBuildings))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(QUARANTINE_KEY), JSON.stringify(wrongBuildings))

    storage.clear()
    const wrongRoads = clone(state)
    wrongRoads.roads = wrongRoads.roads.slice(0, 71)
    storage.setItem(SAVE_KEY_V2, JSON.stringify(wrongRoads))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(QUARANTINE_KEY), JSON.stringify(wrongRoads))

    storage.clear()
    const badRng = clone(state)
    ;(badRng as { rng: unknown }).rng = 'abc'
    storage.setItem(SAVE_KEY_V2, JSON.stringify(badRng))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(QUARANTINE_KEY), JSON.stringify(badRng))

    storage.clear()
    const badPhase = clone(state)
    ;(badPhase as { phase: unknown }).phase = { kind: 'notARealPhase' }
    storage.setItem(SAVE_KEY_V2, JSON.stringify(badPhase))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(QUARANTINE_KEY), JSON.stringify(badPhase))
  })

  test('rejects wrong player counts and non-human sets', () => {
    const state = createGame({ seed: 3, playerCount: 4 })

    const twoPlayers = clone(state)
    twoPlayers.players = twoPlayers.players.slice(0, 2)
    storage.setItem(SAVE_KEY_V2, JSON.stringify(twoPlayers))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY_V2), null)

    storage.clear()
    const allBots = clone(state)
    for (const p of allBots.players) p.isBot = true
    storage.setItem(SAVE_KEY_V2, JSON.stringify(allBots))
    assert.equal(loadGame(), null)

    storage.clear()
    const twoHumans = clone(state)
    for (const p of twoHumans.players) p.isBot = false
    storage.setItem(SAVE_KEY_V2, JSON.stringify(twoHumans))
    assert.equal(loadGame(), null)
  })

  test('rejects the review crash payloads', () => {
    const state = createGame({ seed: 4, playerCount: 4 })

    const missingResources = clone(state)
    delete (missingResources.players[0] as Partial<Player>).resources
    storage.setItem(SAVE_KEY_V2, JSON.stringify(missingResources))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY_V2), null)

    storage.clear()
    const gameOverNoWinner = clone(state)
    ;(gameOverNoWinner as { phase: unknown }).phase = { kind: 'gameOver' }
    storage.setItem(SAVE_KEY_V2, JSON.stringify(gameOverNoWinner))
    assert.equal(loadGame(), null)

    storage.clear()
    const discardNoDiscards = clone(state)
    ;(discardNoDiscards as { phase: unknown }).phase = { kind: 'discard' }
    storage.setItem(SAVE_KEY_V2, JSON.stringify(discardNoDiscards))
    assert.equal(loadGame(), null)
  })

  test('rejects out-of-range ids', () => {
    const state = createGame({ seed: 5, playerCount: 3 })

    const badCurrent = clone(state)
    badCurrent.current = 99
    storage.setItem(SAVE_KEY_V2, JSON.stringify(badCurrent))
    assert.equal(loadGame(), null)

    storage.clear()
    const badOwner = clone(state)
    badOwner.buildings[0] = { owner: 99, kind: 'settlement' }
    storage.setItem(SAVE_KEY_V2, JSON.stringify(badOwner))
    assert.equal(loadGame(), null)

    storage.clear()
    const badCandidate = clone(state)
    badCandidate.phase = { kind: 'steal', candidates: [99], returnTo: 'main' }
    storage.setItem(SAVE_KEY_V2, JSON.stringify(badCandidate))
    assert.equal(loadGame(), null)

    storage.clear()
    const badRobber = clone(state)
    badRobber.robber = 99
    storage.setItem(SAVE_KEY_V2, JSON.stringify(badRobber))
    assert.equal(loadGame(), null)
  })

  test('rejects a discard phase with the wrong discards length', () => {
    const state = createGame({ seed: 6, playerCount: 4 })
    const badDiscards = clone(state)
    badDiscards.phase = { kind: 'discard', discards: [1, 2] }
    storage.setItem(SAVE_KEY_V2, JSON.stringify(badDiscards))
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY_V2), null)
  })

  test('migrates a v1 save to v2, writes v2, removes v1, and round-trips', () => {
    const state = midGameState()
    const v1 = toV1(state)
    const players = state.players.length
    const gains = state.players.map(() => emptyResources())
    gains[0] = res({ grain: 1 })
    ;(v1.events as Record<string, unknown>[]).push(
      { seq: state.eventSeq + 1, turn: state.turn, type: 'produce', gains },
      { seq: state.eventSeq + 2, turn: state.turn, type: 'monopoly', player: 0, resource: 'ore', taken: 2 },
    )
    v1.eventSeq = state.eventSeq + 2

    storage.setItem(SAVE_KEY_V1, JSON.stringify(v1))
    const loaded = loadGame()
    assert.ok(loaded)
    assert.equal(loaded.version, 2)
    assert.equal(storage.getItem(SAVE_KEY_V1), null)
    assert.ok(storage.getItem(SAVE_KEY_V2) !== null)
    assert.equal(loaded.settings.board, 'random')
    assert.equal(loaded.stats.partial, true)
    assert.equal(loaded.offersThisTurn, 0)
    assert.equal(loaded.tradeSeq, 0)
    assert.ok(loaded.players.every((p) => p.level === 'normal'))

    const produce = loaded.events.find((e) => e.type === 'produce')
    assert.ok(produce && produce.type === 'produce')
    if (produce?.type === 'produce') {
      assert.deepEqual(produce.blocked, Array.from({ length: players }, emptyResources))
      assert.deepEqual(produce.shortage, [])
      assert.equal(loaded.stats.players[0].produced.grain, 1)
    }
    const monopoly = loaded.events.find((e) => e.type === 'monopoly')
    assert.ok(monopoly && monopoly.type === 'monopoly')
    if (monopoly?.type === 'monopoly') {
      assert.deepEqual(monopoly.takenFrom, Array(players).fill(0))
      assert.equal(loaded.stats.players[0].monopolyGained, 2)
    }

    const again = assertRoundTrip(storage, loaded)
    assert.deepEqual(again, loaded)
  })

  test('a corrupt v1 save is quarantined and removed', () => {
    storage.setItem(SAVE_KEY_V1, '{not-json')
    assert.equal(loadGame(), null)
    assert.equal(storage.getItem(SAVE_KEY_V1), null)
    assert.equal(storage.getItem(QUARANTINE_KEY), '{not-json')
  })

  test('every state from 3 bots-only games round-trips through save and load', () => {
    for (const seed of [31, 32, 33]) {
      let state = createGame({ seed, playerCount: seed % 2 === 0 ? 3 : 4 })
      let actions = 0
      const cap = 1200
      while (state.phase.kind !== 'gameOver' && actions < cap) {
        for (const player of playersToAct(state)) {
          const action = chooseBotAction(state, player)
          state = applyAction(state, action)
          actions += 1
          assertRoundTrip(storage, state)
          if (state.phase.kind === 'gameOver') break
        }
      }
    }
  })

  test('schema type is tied to GameState', () => {
    // @ts-expect-error a wrong shape must not satisfy the schema's inferred type
    const wrong: z.infer<typeof saveSchemaV2> = { version: 2 }
    assert.ok(wrong !== undefined)
  })

  test('is a safe no-op without window (SSR)', () => {
    withoutWindow()
    assert.equal(loadGame(), null)
    assert.doesNotThrow(() => saveGame(createGame({ seed: 4, playerCount: 3 })))
    assert.doesNotThrow(() => clearGame())
  })
})
