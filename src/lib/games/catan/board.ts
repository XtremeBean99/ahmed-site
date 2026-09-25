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
import { EDGES, HEXES, PORT_EDGES, VERTICES } from './geometry'
import { emptyResources } from './helpers'
import { shuffle } from './rng'
import { emptyStats } from './stats'
import type { BotLevel, DevCardType, GameState, NewGameOptions, Player, PlayerColor, Port, Terrain, Tile } from './types'

export function generateBoard(holder: { rng: number }): { tiles: Tile[]; ports: Port[]; robber: number } {
  const terrains: Terrain[] = []
  for (const [terrain, count] of Object.entries(TERRAIN_COUNTS) as [Terrain, number][]) {
    for (let i = 0; i < count; i++) terrains.push(terrain)
  }
  shuffle(holder, terrains)
  const tiles: Tile[] = terrains.map((terrain) => ({ terrain, number: null }))

  const nonDesertIds = tiles.flatMap((tile, id) => (tile.terrain === 'desert' ? [] : [id]))
  const tokens = shuffle(holder, [...NUMBER_TOKENS])
  let redNumbersOk = false
  while (!redNumbersOk) {
    nonDesertIds.forEach((id, i) => {
      tiles[id].number = tokens[i]
    })
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

export function makePlayer(name: string, color: PlayerColor, isBot: boolean, level: BotLevel = 'normal'): Player {
  return {
    id: 0,
    name,
    color,
    isBot,
    level,
    resources: emptyResources(),
    devCards: [],
    newDevCards: [],
    knightsPlayed: 0,
    roadsLeft: PIECES.roads,
    settlementsLeft: PIECES.settlements,
    citiesLeft: PIECES.cities,
    longestRoad: 0,
  }
}

export function createGame(opts: NewGameOptions): GameState {
  if (opts.playerCount !== 3 && opts.playerCount !== 4) {
    throw new Error('playerCount must be 3 or 4')
  }
  const state: GameState = {
    version: 2,
    settings: { ...DEFAULT_SETTINGS, ...opts.settings },
    stats: emptyStats(opts.playerCount),
    offersThisTurn: 0,
    tradeSeq: 0,
    rng: opts.seed | 0,
    tiles: [],
    ports: [],
    robber: -1,
    buildings: Array(VERTICES.length).fill(null),
    roads: Array(EDGES.length).fill(null),
    players: [],
    current: 0,
    phase: { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null },
    bank: emptyResources(),
    devDeck: [],
    devCardPlayedThisTurn: false,
    dice: null,
    longestRoadHolder: null,
    largestArmyHolder: null,
    turn: 0,
    events: [],
    eventSeq: 0,
  }
  for (const resource of RESOURCES) state.bank[resource] = BANK_PER_RESOURCE

  const board = generateBoard(state)
  state.tiles = board.tiles
  state.ports = board.ports
  state.robber = board.robber

  const humanColor = opts.humanColor ?? 'red'
  const human = makePlayer(opts.humanName ?? 'You', humanColor, false)
  const botColors = PLAYER_COLORS.filter((c) => c !== humanColor)
  const bots = Array.from({ length: opts.playerCount - 1 }, (_, i) =>
    makePlayer(BOT_NAMES[i], botColors[i], true, opts.botLevel ?? 'normal'),
  )
  const players = shuffle(state, [human, ...bots])
  players.forEach((player, id) => {
    player.id = id
  })
  state.players = players

  const devDeck: DevCardType[] = []
  for (const [card, count] of Object.entries(DEV_DECK_COUNTS) as [DevCardType, number][]) {
    for (let i = 0; i < count; i++) devDeck.push(card)
  }
  shuffle(state, devDeck)
  state.devDeck = devDeck

  return state
}
