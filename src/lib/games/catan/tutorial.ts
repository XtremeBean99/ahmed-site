import { humanPlayer, validateAction } from './engine'
import { makePlayer } from './board'
import { DEFAULT_SETTINGS, DEV_DECK_COUNTS, PORT_TYPES, RESOURCES } from './constants'
import { EDGES, PORT_EDGES, VERTICES } from './geometry'
import { addResources, emptyResources, subtractResources } from './helpers'
import { shuffle } from './rng'
import { emptyStats } from './stats'
import type { Action, DevCardType, GameState, ResourceCounts, Terrain } from './types'

export const TUTORIAL_UI_IDS = [
  'roll',
  'end-turn',
  'build-road',
  'build-settlement',
  'build-city',
  'buy-card',
  'trade',
  'play-card',
  'hand',
  'dev-cards',
  'dice',
  'players',
  'log',
  'legend',
  'settings',
  'speed',
  'skip',
  'status',
  'board',
] as const

export type TutorialUiId = (typeof TUTORIAL_UI_IDS)[number]

export const TUTORIAL_STEP_IDS = [
  'welcome',
  'board',
  'first-settlement',
  'bots-and-second',
  'hand',
  'roll',
  'build-road',
  'end-turn',
  'seven',
  'trade-settlement',
  'buy-card',
  'knight',
  'winning',
  'free',
] as const

export type TutorialStepId = (typeof TUTORIAL_STEP_IDS)[number]

/** Stack layout bottom sheet that holds a highlighted target, if any. */
export type TutorialSheet = 'build' | 'cards' | 'log' | 'menu'

export function tutorialSheetFor(id: TutorialUiId): TutorialSheet | null {
  switch (id) {
    case 'build-road':
    case 'build-settlement':
    case 'build-city':
    case 'buy-card':
      return 'build'
    case 'dev-cards':
      return 'cards'
    case 'log':
      return 'log'
    case 'settings':
    case 'speed':
    case 'legend':
      return 'menu'
    default:
      return null
  }
}

export interface TutorialHighlight {
  ui?: TutorialUiId[]
  vertices?: number[]
  edges?: number[]
  hexes?: number[]
}

export interface TutorialStep {
  id: TutorialStepId
  highlight: TutorialHighlight
  allows: (state: GameState, action: Action) => boolean
  completeWhen: 'next' | ((before: GameState, after: GameState, action: Action) => boolean)
  prepare?: (state: GameState) => GameState
}

export const TUTORIAL_PROGRESS_KEY = 'catan-tutorial-progress-v1'

export interface TutorialProgress {
  step: number
  finished: boolean
}

export function serializeTutorialProgress(progress: TutorialProgress): string {
  return JSON.stringify(progress)
}

/** Validates a persisted lesson position. Rejects out-of-range steps and bad shapes. */
export function parseTutorialProgress(raw: string | null): TutorialProgress | null {
  if (raw === null) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { step, finished } = parsed as Record<string, unknown>
    if (typeof step !== 'number' || !Number.isInteger(step)) return null
    if (step < 0 || step >= TUTORIAL_STEP_IDS.length) return null
    if (typeof finished !== 'boolean') return null
    return { step, finished }
  } catch {
    return null
  }
}

export function clampTutorialProgress(step: number, finished: boolean): TutorialProgress {
  const clamped = Math.min(Math.max(Math.trunc(step), 0), TUTORIAL_STEP_IDS.length - 1)
  return { step: clamped, finished: clamped === TUTORIAL_STEP_IDS.length - 1 ? finished : false }
}

export const TUTORIAL_SEED = 150

const TUTORIAL_DECK_SEED = 20260925

/** Every dice roll the lesson needs, in order, including the bots' turns. */
const TUTORIAL_ROLLS: [number, number][] = [
  [5, 3],
  [6, 5],
  [2, 3],
  [1, 6],
  [5, 1],
  [2, 2],
]

const TERRAINS: Terrain[] = [
  'lumber', 'wool', 'grain',
  'brick', 'lumber', 'wool', 'ore',
  'ore', 'wool', 'desert', 'grain', 'brick',
  'grain', 'lumber', 'wool', 'grain',
  'brick', 'lumber', 'ore',
]

const NUMBERS: (number | null)[] = [
  9, 10, 8,
  6, 3, 4, 11,
  5, 3, null, 10, 6,
  8, 11, 4, 9,
  12, 2, 5,
]

const TUTORIAL_BANK = { brick: 19, lumber: 19, wool: 19, grain: 19, ore: 19 } as const

function tutorialDevDeck(): DevCardType[] {
  const deck: DevCardType[] = []
  for (const [card, count] of Object.entries(DEV_DECK_COUNTS) as [DevCardType, number][]) {
    for (let i = 0; i < count; i++) deck.push(card)
  }
  return shuffle({ rng: TUTORIAL_DECK_SEED }, deck)
}

export function createTutorialGame(): GameState {
  const deck = tutorialDevDeck()
  const players = [makePlayer('You', 'red', false), makePlayer('Bram', 'blue', true), makePlayer('Ilsa', 'white', true)]
  players.forEach((player, id) => {
    player.id = id
  })
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS, board: 'starter', botTrades: false },
    stats: emptyStats(players.length),
    offersThisTurn: 0,
    tradeSeq: 0,
    scriptedRolls: TUTORIAL_ROLLS.map((roll) => [...roll]),
    rng: TUTORIAL_SEED,
    tiles: TERRAINS.map((terrain, i) => ({ terrain, number: NUMBERS[i] })),
    ports: PORT_EDGES.map((edge, i) => ({ edge, type: PORT_TYPES[i] })),
    robber: TERRAINS.indexOf('desert'),
    buildings: Array(VERTICES.length).fill(null),
    roads: Array(EDGES.length).fill(null),
    players,
    current: 0,
    phase: { kind: 'setup', round: 1, step: 'settlement', lastSettlement: null },
    bank: { ...TUTORIAL_BANK },
    devDeck: deck,
    devCardPlayedThisTurn: false,
    dice: null,
    longestRoadHolder: null,
    largestArmyHolder: null,
    turn: 0,
    events: [],
    eventSeq: 0,
  }
}

function humanTurn(state: GameState): boolean {
  const human = humanPlayer(state)
  return human >= 0 && state.current === human
}

function isSetupSettlement(state: GameState): boolean {
  return state.phase.kind === 'setup' && state.phase.step === 'settlement' && humanTurn(state)
}

function isSetupRoad(state: GameState): boolean {
  return state.phase.kind === 'setup' && state.phase.step === 'road' && humanTurn(state)
}

const FIRST_SETTLEMENT = 33
const FIRST_ROAD = 40
const SECOND_SETTLEMENT = 48
const SECOND_ROAD = 67
const LESSON_ROAD = 41
const LESSON_SETTLEMENT = 34
const SEVEN_ROBBER_HEX = 3
const KNIGHT_ROBBER_HEX = 10

function setupRoadAction(action: Action): action is Extract<Action, { type: 'placeSetupRoad' }> {
  return action.type === 'placeSetupRoad'
}

function isGrainDiscard(state: GameState, action: Action): boolean {
  if (action.type !== 'discard') return false
  const human = humanPlayer(state)
  if (action.player !== human) return false
  const owed = state.phase.kind === 'discard' ? state.phase.discards[human] : 0
  if (owed <= 0) return false
  return action.resources.grain === owed && RESOURCES.every((r) => r === 'grain' || action.resources[r] === 0)
}

function prepareSeven(state: GameState): GameState {
  const next = structuredClone(state)
  const human = humanPlayer(next)
  const target: ResourceCounts = { brick: 0, lumber: 1, wool: 2, grain: 12, ore: 5 }
  const hand = next.players[human].resources
  const delta = emptyResources()
  for (const r of RESOURCES) delta[r] = Math.max(0, target[r] - hand[r])
  addResources(hand, delta)
  subtractResources(next.bank, delta)
  return next
}

function prepareKnightCard(state: GameState): GameState {
  const next = structuredClone(state)
  const deck = next.devDeck
  const knight = deck.indexOf('knight')
  if (knight >= 0) {
    deck.splice(knight, 1)
    deck.push('knight')
  }
  return next
}

function prepareFreePlay(state: GameState): GameState {
  if (state.settings.botTrades) return state
  const next = structuredClone(state)
  next.settings = { ...next.settings, botTrades: true }
  return next
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    highlight: { ui: ['players', 'status'] },
    allows: () => false,
    completeWhen: 'next',
  },
  {
    id: 'board',
    highlight: { ui: ['board'], hexes: [7, 12, 2, 12] },
    allows: () => false,
    completeWhen: 'next',
  },
  {
    id: 'first-settlement',
    highlight: { ui: ['board'], vertices: [FIRST_SETTLEMENT], edges: [FIRST_ROAD] },
    allows: (state, action) =>
      (action.type === 'placeSetupSettlement' && isSetupSettlement(state) && action.vertex === FIRST_SETTLEMENT) ||
      (setupRoadAction(action) && isSetupRoad(state) && action.edge === FIRST_ROAD),
    completeWhen: (before, after, action) =>
      action.type === 'placeSetupRoad' && action.edge === FIRST_ROAD && after.phase.kind === 'setup',
  },
  {
    id: 'bots-and-second',
    highlight: { ui: ['board', 'players'], vertices: [SECOND_SETTLEMENT], edges: [SECOND_ROAD] },
    allows: (state, action) =>
      (action.type === 'placeSetupSettlement' && isSetupSettlement(state) && action.vertex === SECOND_SETTLEMENT) ||
      (setupRoadAction(action) && isSetupRoad(state) && action.edge === SECOND_ROAD),
    completeWhen: (before, after, action) => action.type === 'placeSetupRoad' && action.edge === SECOND_ROAD && after.phase.kind === 'preRoll',
  },
  {
    id: 'hand',
    highlight: { ui: ['hand'] },
    allows: () => false,
    completeWhen: 'next',
  },
  {
    id: 'roll',
    highlight: { ui: ['roll', 'dice', 'hand'] },
    allows: ((state, action) => action.type === 'rollDice' && state.phase.kind === 'preRoll' && humanTurn(state)),
    completeWhen: (before, after, action) =>
      action.type === 'rollDice' && after.phase.kind === 'main' && after.dice !== null && after.dice[0] + after.dice[1] === 8,
  },
  {
    id: 'build-road',
    highlight: { ui: ['build-road', 'board'], edges: [LESSON_ROAD] },
    allows: (state, action) =>
      action.type === 'buildRoad' && state.phase.kind === 'main' && humanTurn(state) && action.edge === LESSON_ROAD,
    completeWhen: (before, after, action) => action.type === 'buildRoad' && action.edge === LESSON_ROAD,
  },
  {
    id: 'end-turn',
    highlight: { ui: ['end-turn'] },
    allows: ((state, action) => action.type === 'endTurn' && state.phase.kind === 'main' && humanTurn(state)),
    completeWhen: (before, after, action) => action.type === 'endTurn',
  },
  {
    id: 'seven',
    highlight: { ui: ['roll', 'hand', 'board'], hexes: [SEVEN_ROBBER_HEX] },
    allows: ((state, action) => {
      if (action.type === 'rollDice') return state.phase.kind === 'preRoll' && humanTurn(state)
      if (action.type === 'discard') return state.phase.kind === 'discard' && isGrainDiscard(state, action)
      if (action.type === 'moveRobber') {
        return state.phase.kind === 'moveRobber' && humanTurn(state) && action.hex === SEVEN_ROBBER_HEX
      }
      if (action.type === 'steal') {
        return state.phase.kind === 'steal' && humanTurn(state) && action.victim === 1 && state.phase.candidates.includes(1)
      }
      return false
    }),
    prepare: prepareSeven,
    completeWhen: (before, after) =>
      after.phase.kind === 'main' && after.dice !== null && after.dice[0] + after.dice[1] === 7,
  },
  {
    id: 'trade-settlement',
    highlight: { ui: ['trade', 'board'], vertices: [LESSON_SETTLEMENT] },
    allows: ((state, action) => {
      if (action.type === 'maritimeTrade') {
        return state.phase.kind === 'main' && humanTurn(state) && action.give === 'ore' && action.get === 'brick'
      }
      if (action.type === 'buildSettlement') {
        return state.phase.kind === 'main' && humanTurn(state) && action.vertex === LESSON_SETTLEMENT
      }
      return false
    }),
    completeWhen: (before, after, action) => action.type === 'buildSettlement' && action.vertex === LESSON_SETTLEMENT,
  },
  {
    id: 'buy-card',
    highlight: { ui: ['buy-card'] },
    allows: ((state, action) => {
      if (!humanTurn(state)) return false
      if (action.type === 'buyDevCard') return state.phase.kind === 'main' && state.players[humanPlayer(state)].newDevCards.length === 0
      if (action.type === 'endTurn') return state.phase.kind === 'main' && state.players[humanPlayer(state)].newDevCards.length === 1
      return false
    }),
    prepare: prepareKnightCard,
    completeWhen: (before, after, action) => action.type === 'endTurn',
  },
  {
    id: 'knight',
    highlight: { ui: ['dev-cards', 'board'], hexes: [KNIGHT_ROBBER_HEX] },
    allows: ((state, action) => {
      if (!humanTurn(state)) return false
      if (action.type === 'playKnight') {
        return state.phase.kind === 'preRoll' && state.players[humanPlayer(state)].devCards.includes('knight')
      }
      if (action.type === 'moveRobber') {
        return state.phase.kind === 'moveRobber' && action.hex === KNIGHT_ROBBER_HEX
      }
      if (action.type === 'steal') {
        return state.phase.kind === 'steal' && state.phase.candidates.includes(action.victim)
      }
      return false
    }),
    completeWhen: (before, after) => after.phase.kind === 'preRoll' && after.devCardPlayedThisTurn,
  },
  {
    id: 'winning',
    highlight: { ui: ['players', 'status'] },
    allows: () => false,
    completeWhen: 'next',
  },
  {
    id: 'free',
    highlight: { ui: ['status', 'trade'] },
    allows: () => true,
    completeWhen: 'next',
    prepare: prepareFreePlay,
  },
]

export function isStepComplete(step: TutorialStep, before: GameState, after: GameState, action: Action): boolean {
  if (step.completeWhen === 'next') return false
  return step.completeWhen(before, after, action)
}

export function applyStepPrepare(state: GameState, step: TutorialStep): GameState {
  return step.prepare ? step.prepare(state) : state
}

export function isTutorialActionLegal(state: GameState, step: TutorialStep, action: Action): boolean {
  if (!step.allows(state, action)) return false
  return validateAction(state, action) === null
}
