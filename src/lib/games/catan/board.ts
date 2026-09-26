import {
  BANK_PER_RESOURCE,
  BOT_NAMES,
  DEFAULT_SETTINGS,
  DEV_DECK_COUNTS,
  MAX_VP_TO_WIN,
  MIN_VP_TO_WIN,
  PIECES,
  PLAYER_COLORS,
  RESOURCES,
} from './constants'
import { EDGES, VERTICES } from './geometry'
import { emptyResources } from './helpers'
import { generateBoard } from './presets'
import { shuffle } from './rng'
import { emptyStats } from './stats'
import type { BotLevel, DevCardType, GameState, NewGameOptions, Player, PlayerColor } from './types'

export { generateBoard } from './presets'

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

  const vpToWin = state.settings.vpToWin
  if (!Number.isInteger(vpToWin) || vpToWin < MIN_VP_TO_WIN || vpToWin > MAX_VP_TO_WIN) {
    throw new Error(`vpToWin must be an integer from ${MIN_VP_TO_WIN} to ${MAX_VP_TO_WIN}`)
  }

  const board = generateBoard(state, state.settings.board)
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
