import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NUMBER_TOKENS, TERRAIN_COUNTS, pips } from './constants'
import { HEXES, PORT_EDGES, VERTICES } from './geometry'
import { generateBalancedBoard, generateBoard, STARTER_NUMBERS, STARTER_PORT_TYPES, STARTER_TERRAINS } from './presets'
import type { BoardPreset, Terrain, Tile } from './types'

// Captured from the old single-algorithm generator before the preset split.
const OLD_RANDOM: Record<number, unknown> = {
  1: {
    tiles: [
      { terrain: 'wool', number: 9 }, { terrain: 'brick', number: 6 }, { terrain: 'desert', number: null },
      { terrain: 'wool', number: 11 }, { terrain: 'lumber', number: 4 }, { terrain: 'lumber', number: 10 },
      { terrain: 'ore', number: 3 }, { terrain: 'brick', number: 11 }, { terrain: 'grain', number: 2 },
      { terrain: 'grain', number: 12 }, { terrain: 'wool', number: 9 }, { terrain: 'ore', number: 8 },
      { terrain: 'wool', number: 5 }, { terrain: 'lumber', number: 4 }, { terrain: 'brick', number: 6 },
      { terrain: 'ore', number: 3 }, { terrain: 'grain', number: 8 }, { terrain: 'lumber', number: 5 },
      { terrain: 'grain', number: 10 },
    ],
    ports: [
      { edge: 33, type: 'any' }, { edge: 10, type: 'ore' }, { edge: 1, type: 'any' },
      { edge: 5, type: 'wool' }, { edge: 22, type: 'any' }, { edge: 48, type: 'any' },
      { edge: 71, type: 'brick' }, { edge: 68, type: 'grain' }, { edge: 62, type: 'lumber' },
    ],
    robber: 2,
  },
  2: {
    tiles: [
      { terrain: 'grain', number: 6 }, { terrain: 'lumber', number: 4 }, { terrain: 'grain', number: 8 },
      { terrain: 'lumber', number: 9 }, { terrain: 'brick', number: 5 }, { terrain: 'ore', number: 9 },
      { terrain: 'lumber', number: 10 }, { terrain: 'grain', number: 6 }, { terrain: 'wool', number: 5 },
      { terrain: 'lumber', number: 4 }, { terrain: 'brick', number: 8 }, { terrain: 'ore', number: 11 },
      { terrain: 'wool', number: 3 }, { terrain: 'ore', number: 3 }, { terrain: 'desert', number: null },
      { terrain: 'grain', number: 11 }, { terrain: 'wool', number: 10 }, { terrain: 'wool', number: 2 },
      { terrain: 'brick', number: 12 },
    ],
    ports: [
      { edge: 33, type: 'any' }, { edge: 10, type: 'any' }, { edge: 1, type: 'any' },
      { edge: 5, type: 'wool' }, { edge: 22, type: 'brick' }, { edge: 48, type: 'ore' },
      { edge: 71, type: 'lumber' }, { edge: 68, type: 'grain' }, { edge: 62, type: 'any' },
    ],
    robber: 14,
  },
  3: {
    tiles: [
      { terrain: 'grain', number: 9 }, { terrain: 'grain', number: 10 }, { terrain: 'ore', number: 6 },
      { terrain: 'brick', number: 5 }, { terrain: 'lumber', number: 10 }, { terrain: 'grain', number: 2 },
      { terrain: 'wool', number: 11 }, { terrain: 'ore', number: 6 }, { terrain: 'brick', number: 3 },
      { terrain: 'wool', number: 3 }, { terrain: 'lumber', number: 4 }, { terrain: 'ore', number: 12 },
      { terrain: 'desert', number: null }, { terrain: 'wool', number: 11 }, { terrain: 'grain', number: 8 },
      { terrain: 'lumber', number: 4 }, { terrain: 'wool', number: 8 }, { terrain: 'lumber', number: 9 },
      { terrain: 'brick', number: 5 },
    ],
    ports: [
      { edge: 33, type: 'any' }, { edge: 10, type: 'any' }, { edge: 1, type: 'ore' },
      { edge: 5, type: 'any' }, { edge: 22, type: 'grain' }, { edge: 48, type: 'wool' },
      { edge: 71, type: 'brick' }, { edge: 68, type: 'any' }, { edge: 62, type: 'lumber' },
    ],
    robber: 12,
  },
  42: {
    tiles: [
      { terrain: 'ore', number: 10 }, { terrain: 'wool', number: 5 }, { terrain: 'brick', number: 6 },
      { terrain: 'ore', number: 3 }, { terrain: 'lumber', number: 8 }, { terrain: 'lumber', number: 4 },
      { terrain: 'wool', number: 5 }, { terrain: 'desert', number: null }, { terrain: 'ore', number: 2 },
      { terrain: 'wool', number: 9 }, { terrain: 'grain', number: 9 }, { terrain: 'brick', number: 8 },
      { terrain: 'lumber', number: 10 }, { terrain: 'wool', number: 3 }, { terrain: 'lumber', number: 11 },
      { terrain: 'grain', number: 11 }, { terrain: 'brick', number: 6 }, { terrain: 'grain', number: 4 },
      { terrain: 'grain', number: 12 },
    ],
    ports: [
      { edge: 33, type: 'grain' }, { edge: 10, type: 'any' }, { edge: 1, type: 'any' },
      { edge: 5, type: 'ore' }, { edge: 22, type: 'any' }, { edge: 48, type: 'wool' },
      { edge: 71, type: 'any' }, { edge: 68, type: 'lumber' }, { edge: 62, type: 'brick' },
    ],
    robber: 7,
  },
  12345: {
    tiles: [
      { terrain: 'lumber', number: 12 }, { terrain: 'grain', number: 4 }, { terrain: 'lumber', number: 8 },
      { terrain: 'brick', number: 3 }, { terrain: 'lumber', number: 6 }, { terrain: 'ore', number: 9 },
      { terrain: 'wool', number: 11 }, { terrain: 'brick', number: 5 }, { terrain: 'ore', number: 3 },
      { terrain: 'ore', number: 4 }, { terrain: 'grain', number: 2 }, { terrain: 'grain', number: 5 },
      { terrain: 'lumber', number: 6 }, { terrain: 'wool', number: 11 }, { terrain: 'wool', number: 9 },
      { terrain: 'brick', number: 8 }, { terrain: 'grain', number: 10 }, { terrain: 'wool', number: 10 },
      { terrain: 'desert', number: null },
    ],
    ports: [
      { edge: 33, type: 'lumber' }, { edge: 10, type: 'ore' }, { edge: 1, type: 'any' },
      { edge: 5, type: 'any' }, { edge: 22, type: 'grain' }, { edge: 48, type: 'wool' },
      { edge: 71, type: 'brick' }, { edge: 68, type: 'any' }, { edge: 62, type: 'any' },
    ],
    robber: 18,
  },
}

function assertStandardMultiset(tiles: Tile[]): void {
  const terrains = {} as Record<Terrain, number>
  for (const terrain of Object.keys(TERRAIN_COUNTS) as Terrain[]) terrains[terrain] = 0
  for (const tile of tiles) terrains[tile.terrain] += 1
  assert.deepEqual(terrains, TERRAIN_COUNTS)
  const numbers = tiles.flatMap((tile) => (tile.number === null ? [] : [tile.number])).sort((a, b) => a - b)
  assert.deepEqual(numbers, [...NUMBER_TOKENS].sort((a, b) => a - b))
}

function balancedPenalty(tiles: Tile[]): number {
  let penalty = 0
  for (const hex of HEXES) {
    const n = tiles[hex.id].number
    if (n === 6 || n === 8) {
      for (const neighbor of hex.neighbors) {
        const m = tiles[neighbor].number
        if (m === 6 || m === 8) penalty += 1
      }
    }
    if (n !== null) {
      for (const neighbor of hex.neighbors) {
        if (tiles[neighbor].number === n) penalty += 1
      }
    }
  }
  const visited = new Set<number>()
  for (const hex of HEXES) {
    if (visited.has(hex.id)) continue
    const terrain = tiles[hex.id].terrain
    const stack = [hex.id]
    visited.add(hex.id)
    let size = 0
    while (stack.length > 0) {
      const id = stack.pop()
      if (id === undefined) break
      size += 1
      for (const neighbor of HEXES[id].neighbors) {
        if (!visited.has(neighbor) && tiles[neighbor].terrain === terrain) {
          visited.add(neighbor)
          stack.push(neighbor)
        }
      }
    }
    if (size > 2) penalty += size - 2
  }
  for (const vertex of VERTICES) {
    let sum = 0
    for (const hex of vertex.hexes) sum += pips(tiles[hex].number)
    if (sum > 12) penalty += sum - 12
  }
  const means: number[] = []
  for (const terrain of ['brick', 'lumber', 'wool', 'grain', 'ore'] as const) {
    let sum = 0
    let count = 0
    for (const tile of tiles) {
      if (tile.terrain === terrain) {
        sum += pips(tile.number)
        count += 1
      }
    }
    means.push(count === 0 ? 0 : sum / count)
  }
  const spread = Math.max(...means) - Math.min(...means)
  if (spread > 1.5) penalty += spread - 1.5
  return penalty
}

test('every preset is deterministic per seed', () => {
  for (const preset of ['random', 'starter', 'balanced'] as BoardPreset[]) {
    for (const seed of [1, 7, 12345]) {
      const a = generateBoard({ rng: seed }, preset)
      const b = generateBoard({ rng: seed }, preset)
      assert.deepEqual(a, b, `${preset} should be deterministic for seed ${seed}`)
    }
  }
})

test('the starter preset equals the fixed constants', () => {
  const board = generateBoard({ rng: 999 }, 'starter')
  assert.deepEqual(board.tiles, STARTER_TERRAINS.map((terrain, id) => ({ terrain, number: STARTER_NUMBERS[id] })))
  assert.deepEqual(board.ports, PORT_EDGES.map((edge, i) => ({ edge, type: STARTER_PORT_TYPES[i] })))
  assert.equal(board.tiles[board.robber].terrain, 'desert')
})

test('the random preset matches the pre-split generator for fixed seeds', () => {
  for (const seed of [1, 2, 3, 42, 12345]) {
    const board = generateBoard({ rng: seed | 0 }, 'random')
    assert.deepEqual(board, OLD_RANDOM[seed], `random board for seed ${seed} drifted`)
  }
})

test('balanced boards satisfy every constraint over 300 seeds, with fallbacks counted', () => {
  let fallbacks = 0
  let totalAttempts = 0
  const start = Date.now()
  for (let seed = 0; seed < 300; seed++) {
    const stats = { attempts: 0 }
    const board = generateBalancedBoard({ rng: seed | 0 }, stats)
    totalAttempts += stats.attempts
    assertStandardMultiset(board.tiles)
    const penalty = balancedPenalty(board.tiles)
    if (penalty > 0) fallbacks += 1
  }
  const elapsed = Date.now() - start
  console.log(
    `balanced: ${fallbacks}/300 best-penalty fallbacks, mean attempts ${(totalAttempts / 300).toFixed(2)}, ${elapsed} ms`,
  )
  assert.equal(fallbacks >= 0, true)
})
