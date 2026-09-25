import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, generateBoard } from './board'
import {
  BANK_PER_RESOURCE,
  BOT_NAMES,
  DEFAULT_SETTINGS,
  DEV_DECK_COUNTS,
  NUMBER_TOKENS,
  PIECES,
  PLAYER_COLORS,
  PORT_TYPES,
  RESOURCES,
  TERRAIN_COUNTS,
} from './constants'
import { HEXES, PORT_EDGES } from './geometry'
import type { DevCardType, NewGameOptions, Terrain } from './types'

test('generateBoard returns the standard multisets and robber on the desert', () => {
  const board = generateBoard({ rng: 12345 }, 'random')
  assert.equal(board.tiles.length, 19)
  const terrains = Object.fromEntries(Object.keys(TERRAIN_COUNTS).map((t) => [t, 0])) as Record<Terrain, number>
  for (const tile of board.tiles) terrains[tile.terrain] += 1
  assert.deepEqual(terrains, TERRAIN_COUNTS)
  assert.equal(board.tiles[board.robber].terrain, 'desert')
  assert.equal(board.tiles[board.robber].number, null)
  const numbers = board.tiles
    .flatMap((tile) => (tile.number === null ? [] : [tile.number]))
    .sort((a, b) => a - b)
  assert.deepEqual(numbers, [...NUMBER_TOKENS].sort((a, b) => a - b))
  assert.equal(board.ports.length, 9)
  assert.deepEqual(new Set(board.ports.map((port) => port.edge)), new Set(PORT_EDGES))
  assert.deepEqual([...board.ports.map((port) => port.type)].sort(), [...PORT_TYPES].sort())
})

test('no adjacent red numbers over 300 generated boards', () => {
  for (let seed = 0; seed < 300; seed++) {
    const board = generateBoard({ rng: seed | 0 }, 'random')
    for (const hex of HEXES) {
      const n = board.tiles[hex.id].number
      if (n !== 6 && n !== 8) continue
      for (const neighbor of hex.neighbors) {
        const m = board.tiles[neighbor].number
        assert.ok(m !== 6 && m !== 8, `seed ${seed}: red numbers adjacent at ${hex.id}/${neighbor}`)
      }
    }
  }
})

test('createGame is deterministic per seed and varies across seeds', () => {
  const a = createGame({ seed: 42, playerCount: 3 })
  const b = createGame({ seed: 42, playerCount: 3 })
  assert.deepEqual(a, b)
  const c = createGame({ seed: 43, playerCount: 3 })
  assert.notDeepEqual(a.tiles, c.tiles)
})

test('createGame rejects invalid player counts', () => {
  assert.throws(() => createGame({ seed: 1, playerCount: 2 } as unknown as NewGameOptions), /playerCount/)
  assert.throws(() => createGame({ seed: 1, playerCount: 5 } as unknown as NewGameOptions), /playerCount/)
})

test('createGame creates one human and bots in shuffled seat order', () => {
  for (const n of [3, 4] as const) {
    const game = createGame({ seed: 7, playerCount: n })
    assert.equal(game.players.length, n)
    assert.deepEqual(
      game.players.map((p) => p.id).sort((a, b) => a - b),
      Array.from({ length: n }, (_, i) => i),
    )
    const humans = game.players.filter((p) => !p.isBot)
    assert.equal(humans.length, 1)
    assert.equal(humans[0].name, 'You')
    assert.equal(humans[0].color, 'red')
    const bots = game.players.filter((p) => p.isBot)
    assert.equal(bots.length, n - 1)
    assert.deepEqual(new Set(bots.map((p) => p.color)), new Set(PLAYER_COLORS.slice(1, n)))
    for (const bot of bots) assert.ok(BOT_NAMES.includes(bot.name))
  }
  const custom = createGame({ seed: 7, playerCount: 3, humanName: 'Ahmed' })
  assert.equal(custom.players.find((p) => !p.isBot)?.name, 'Ahmed')
})

test('createGame initializes pieces, bank, deck and phase', () => {
  const game = createGame({ seed: 3, playerCount: 4 })
  for (const player of game.players) {
    assert.deepEqual(player.resources, { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 })
    assert.deepEqual(player.devCards, [])
    assert.deepEqual(player.newDevCards, [])
    assert.equal(player.knightsPlayed, 0)
    assert.equal(player.roadsLeft, PIECES.roads)
    assert.equal(player.settlementsLeft, PIECES.settlements)
    assert.equal(player.citiesLeft, PIECES.cities)
    assert.equal(player.longestRoad, 0)
  }
  for (const resource of RESOURCES) assert.equal(game.bank[resource], BANK_PER_RESOURCE)
  assert.equal(game.devDeck.length, 25)
  const deckCounts = Object.fromEntries(Object.keys(DEV_DECK_COUNTS).map((c) => [c, 0])) as Record<
    DevCardType,
    number
  >
  for (const card of game.devDeck) deckCounts[card] += 1
  assert.deepEqual(deckCounts, DEV_DECK_COUNTS)
  assert.deepEqual(game.phase, { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null })
  assert.equal(game.current, 0)
  assert.equal(game.turn, 0)
  assert.equal(game.dice, null)
  assert.equal(game.longestRoadHolder, null)
  assert.equal(game.largestArmyHolder, null)
  assert.equal(game.devCardPlayedThisTurn, false)
  assert.deepEqual(game.events, [])
  assert.equal(game.eventSeq, 0)
  assert.equal(game.version, 2)
  assert.deepEqual(game.settings, DEFAULT_SETTINGS)
  assert.equal(game.offersThisTurn, 0)
  assert.equal(game.stats.players.length, 4)
  assert.ok(game.players.every((p) => p.level === 'normal'))
  assert.equal(game.buildings.length, 54)
  assert.equal(game.roads.length, 72)
  assert.ok(game.buildings.every((b) => b === null))
  assert.ok(game.roads.every((r) => r === null))
})
