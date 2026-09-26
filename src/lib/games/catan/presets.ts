import { NUMBER_TOKENS, PORT_TYPES, TERRAIN_COUNTS, pips } from './constants'
import { HEXES, PORT_EDGES, VERTICES } from './geometry'
import { shuffle } from './rng'
import type { BoardPreset, Port, PortType, Terrain, Tile } from './types'

export interface GeneratedBoard {
  tiles: Tile[]
  ports: Port[]
  robber: number
}

export const STARTER_TERRAINS: Terrain[] = [
  'ore', 'wool', 'lumber',
  'grain', 'brick', 'wool', 'brick',
  'grain', 'lumber', 'desert', 'lumber', 'ore',
  'lumber', 'ore', 'grain', 'wool',
  'brick', 'grain', 'wool',
]

export const STARTER_NUMBERS: (number | null)[] = [
  10, 2, 9,
  12, 6, 4, 10,
  9, 11, null, 3, 8,
  8, 3, 4, 5,
  5, 6, 11,
]

export const STARTER_PORT_TYPES: PortType[] = ['any', 'grain', 'ore', 'any', 'wool', 'any', 'any', 'brick', 'lumber']

export function generateBoard(holder: { rng: number }, preset: BoardPreset): GeneratedBoard {
  if (preset === 'random') return generateRandomBoard(holder)
  if (preset === 'starter') return generateStarterBoard()
  return generateBalancedBoard(holder)
}

function expandTerrains(): Terrain[] {
  const terrains: Terrain[] = []
  for (const [terrain, count] of Object.entries(TERRAIN_COUNTS) as [Terrain, number][]) {
    for (let i = 0; i < count; i++) terrains.push(terrain)
  }
  return terrains
}

function assignNumbers(tiles: Tile[], tokens: number[]): void {
  const nonDesertIds = tiles.flatMap((tile, id) => (tile.terrain === 'desert' ? [] : [id]))
  nonDesertIds.forEach((id, i) => {
    tiles[id].number = tokens[i]
  })
}

function generateRandomBoard(holder: { rng: number }): GeneratedBoard {
  const terrains = expandTerrains()
  shuffle(holder, terrains)
  const tiles: Tile[] = terrains.map((terrain) => ({ terrain, number: null }))

  const tokens = shuffle(holder, [...NUMBER_TOKENS])
  let redNumbersOk = false
  while (!redNumbersOk) {
    assignNumbers(tiles, tokens)
    redNumbersOk = HEXES.every((hex) => {
      const n = tiles[hex.id].number
      if (n !== 6 && n !== 8) return true
      return hex.neighbors.every((neighbor) => {
        const m = tiles[neighbor].number
        return m !== 6 && m !== 8
      })
    })
    if (!redNumbersOk) shuffle(holder, tokens)
  }

  const portTypes = shuffle(holder, [...PORT_TYPES])
  const ports: Port[] = PORT_EDGES.map((edge, i) => ({ edge, type: portTypes[i] }))
  const robber = tiles.findIndex((tile) => tile.terrain === 'desert')
  return { tiles, ports, robber }
}

function generateStarterBoard(): GeneratedBoard {
  const tiles: Tile[] = STARTER_TERRAINS.map((terrain, id) => ({ terrain, number: STARTER_NUMBERS[id] }))
  const ports: Port[] = PORT_EDGES.map((edge, i) => ({ edge, type: STARTER_PORT_TYPES[i] }))
  const robber = tiles.findIndex((tile) => tile.terrain === 'desert')
  return { tiles, ports, robber }
}

interface BoardPenalty {
  tiles: Tile[]
  robber: number
  penalty: number
}

function sampleBoard(holder: { rng: number }): BoardPenalty {
  const terrains = expandTerrains()
  shuffle(holder, terrains)
  const tiles: Tile[] = terrains.map((terrain) => ({ terrain, number: null }))
  const tokens = shuffle(holder, [...NUMBER_TOKENS])
  assignNumbers(tiles, tokens)
  const robber = tiles.findIndex((tile) => tile.terrain === 'desert')
  return { tiles, robber, penalty: boardPenalty(tiles) }
}

function boardPenalty(tiles: Tile[]): number {
  let penalty = 0

  // Adjacent 6/8 tokens.
  for (const hex of HEXES) {
    const n = tiles[hex.id].number
    if (n !== 6 && n !== 8) continue
    for (const neighbor of hex.neighbors) {
      const m = tiles[neighbor].number
      if (m === 6 || m === 8) penalty += 1
    }
  }

  // Adjacent equal numbers.
  for (const hex of HEXES) {
    const n = tiles[hex.id].number
    if (n === null) continue
    for (const neighbor of hex.neighbors) {
      if (tiles[neighbor].number === n) penalty += 1
    }
  }

  // Connected same-terrain groups may have at most 2 hexes.
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

  // No vertex may touch more than 12 pips.
  for (const vertex of VERTICES) {
    let sum = 0
    for (const hex of vertex.hexes) sum += pips(tiles[hex].number)
    if (sum > 12) penalty += sum - 12
  }

  // Resource pip means must stay within 1.5 of each other.
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

export const MAX_BALANCED_ATTEMPTS = 500

export function generateBalancedBoard(holder: { rng: number }, stats?: { attempts: number }): GeneratedBoard {
  const portTypes = shuffle(holder, [...PORT_TYPES])
  const ports: Port[] = PORT_EDGES.map((edge, i) => ({ edge, type: portTypes[i] }))

  let best: BoardPenalty | null = null
  for (let attempt = 0; attempt < MAX_BALANCED_ATTEMPTS; attempt++) {
    const sample = sampleBoard(holder)
    if (stats) stats.attempts = attempt + 1
    if (sample.penalty === 0) {
      return { tiles: sample.tiles, ports, robber: sample.robber }
    }
    if (best === null || sample.penalty < best.penalty) best = sample
  }
  if (best === null) throw new Error('balanced board sampling produced no board')
  return { tiles: best.tiles, ports, robber: best.robber }
}
