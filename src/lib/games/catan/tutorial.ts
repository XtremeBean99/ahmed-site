import { applyAction, humanPlayer, playersToAct, validateAction } from './engine'
import { chooseBotAction } from './ai'
import { PORT_TYPES, RESOURCES } from './constants'
import { EDGES, PORT_EDGES, VERTICES } from './geometry'
import { addResources, emptyResources, subtractResources } from './helpers'
import type { Action, DevCardType, GameState, PlayerColor, ResourceCounts, Terrain } from './types'

export type TutorialUiId =
  | 'roll'
  | 'end-turn'
  | 'build-road'
  | 'build-settlement'
  | 'build-city'
  | 'buy-card'
  | 'trade'
  | 'play-card'
  | 'hand'
  | 'dev-cards'
  | 'dice'
  | 'players'
  | 'log'
  | 'legend'
  | 'settings'
  | 'speed'
  | 'skip'
  | 'status'
  | 'board'

export interface TutorialHighlight {
  ui?: TutorialUiId[]
  vertices?: number[]
  edges?: number[]
  hexes?: number[]
}

export interface TutorialStep {
  id: string
  title: string
  body: string
  highlight: TutorialHighlight
  allows: (state: GameState, action: Action) => boolean
  completeWhen: 'next' | ((before: GameState, after: GameState, action: Action) => boolean)
  prepare?: (state: GameState) => GameState
}

export const TUTORIAL_SEED = 150

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

function makePlayer(name: string, color: PlayerColor, isBot: boolean) {
  return {
    id: 0,
    name,
    color,
    isBot,
    resources: emptyResources(),
    devCards: [] as DevCardType[],
    newDevCards: [] as DevCardType[],
    knightsPlayed: 0,
    roadsLeft: 15,
    settlementsLeft: 5,
    citiesLeft: 4,
    longestRoad: 0,
  }
}

function tutorialDevDeck(): DevCardType[] {
  const deck: DevCardType[] = []
  const counts: Record<DevCardType, number> = {
    knight: 14,
    victoryPoint: 5,
    roadBuilding: 2,
    yearOfPlenty: 2,
    monopoly: 2,
  }
  for (const [card, count] of Object.entries(counts) as [DevCardType, number][]) {
    for (let i = 0; i < count; i++) deck.push(card)
  }
  const nonKnights = deck.filter((c) => c !== 'knight')
  const knights = deck.filter((c) => c === 'knight')
  return [...nonKnights, ...knights]
}

export function createTutorialGame(): GameState {
  const deck = tutorialDevDeck()
  const players = [makePlayer('You', 'red', false), makePlayer('Bram', 'blue', true), makePlayer('Ilsa', 'white', true)]
  players.forEach((player, id) => {
    player.id = id
  })
  return {
    version: 1,
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

function allowedWhen(predicate: (state: GameState, action: Action) => boolean): (state: GameState, action: Action) => boolean {
  return predicate
}

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

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Catan',
    body:
      'You are red. The first player to 10 victory points wins. Settlements are worth 1 point, cities 2, the Longest Road and Largest Army are worth 2 each, and some development cards hide 1 point. You can only win on your own turn.',
    highlight: { ui: ['players', 'status'] },
    allows: () => false,
    completeWhen: 'next',
  },
  {
    id: 'board',
    title: 'The island',
    body:
      'Each hex produces one resource when its number is rolled: lumber from green, wool from pale green, grain from yellow, brick from red-brown, ore from grey. The dots under a number show how often it is rolled; 6 and 8 are the most likely, which is why they are printed red and never touch. The robber starts on the desert.',
    highlight: { ui: ['board', 'legend'], hexes: [7, 12, 2, 12] },
    allows: () => false,
    completeWhen: 'next',
  },
  {
    id: 'first-settlement',
    title: 'Your first settlement',
    body:
      'Place your first settlement on the highlighted corner of Grain 8 and Ore 5. It adds 9 pips of production. Then place the road next to it, toward the middle of the island.',
    highlight: { ui: ['board'], vertices: [FIRST_SETTLEMENT], edges: [FIRST_ROAD] },
    allows: allowedWhen(
      (state, action) =>
        (action.type === 'placeSetupSettlement' && isSetupSettlement(state) && action.vertex === FIRST_SETTLEMENT) ||
        (setupRoadAction(action) && isSetupRoad(state) && action.edge === FIRST_ROAD),
    ),
    completeWhen: (before, after, action) =>
      action.type === 'placeSetupRoad' && action.edge === FIRST_ROAD && after.phase.kind === 'setup',
  },
  {
    id: 'bots-and-second',
    title: 'Bots place, then you',
    body:
      'Watch the bots place their starting settlements. When it is your turn again, place your second settlement on the highlighted corner of Brick 12 and Lumber 2, then its road. You collect one card for each hex around that second settlement: 1 brick and 1 lumber.',
    highlight: { ui: ['board', 'players'], vertices: [SECOND_SETTLEMENT], edges: [SECOND_ROAD] },
    allows: allowedWhen(
      (state, action) =>
        (action.type === 'placeSetupSettlement' && isSetupSettlement(state) && action.vertex === SECOND_SETTLEMENT) ||
        (setupRoadAction(action) && isSetupRoad(state) && action.edge === SECOND_ROAD),
    ),
    completeWhen: (before, after, action) => action.type === 'placeSetupRoad' && action.edge === SECOND_ROAD && after.phase.kind === 'preRoll',
  },
  {
    id: 'hand',
    title: 'Your hand and costs',
    body:
      'Your hand is in the right panel. A road costs 1 brick and 1 lumber. A settlement costs 1 brick, 1 lumber, 1 wool and 1 grain. A city costs 2 grain and 3 ore. A development card costs 1 wool, 1 grain and 1 ore.',
    highlight: { ui: ['hand', 'build-road', 'build-settlement', 'build-city', 'buy-card'] },
    allows: () => false,
    completeWhen: 'next',
  },
  {
    id: 'roll',
    title: 'Roll the dice',
    body:
      'Click Roll. Your first roll will be an 8. Your settlement sits on Grain 8, so the Grain 8 hex pays you 1 grain. Watch your hand and the game log.',
    highlight: { ui: ['roll', 'dice', 'hand'] },
    allows: allowedWhen((state, action) => action.type === 'rollDice' && state.phase.kind === 'preRoll' && humanTurn(state)),
    completeWhen: (before, after, action) =>
      action.type === 'rollDice' && after.phase.kind === 'main' && after.dice !== null && after.dice[0] + after.dice[1] === 8,
  },
  {
    id: 'build-road',
    title: 'Build a road',
    body:
      'You have 1 brick and 1 lumber, exactly the cost of a road. Click Build road, then the highlighted edge. Roads connect your settlements and count toward Longest Road.',
    highlight: { ui: ['build-road', 'board'], edges: [LESSON_ROAD] },
    allows: allowedWhen(
      (state, action) => action.type === 'buildRoad' && state.phase.kind === 'main' && humanTurn(state) && action.edge === LESSON_ROAD,
    ),
    completeWhen: (before, after, action) => action.type === 'buildRoad' && action.edge === LESSON_ROAD,
  },
  {
    id: 'end-turn',
    title: 'End your turn',
    body:
      'You have nothing else to do, so end your turn. The bots will now take their turns at normal speed. You can change the speed at the top, or click Skip to jump to your turn, but for now just watch.',
    highlight: { ui: ['end-turn', 'speed', 'skip'] },
    allows: allowedWhen((state, action) => action.type === 'endTurn' && state.phase.kind === 'main' && humanTurn(state)),
    completeWhen: (before, after, action) => action.type === 'endTurn',
  },
  {
    id: 'seven',
    title: 'The robber',
    body:
      'Your next roll is a 7. The tutorial gives you extra grain so you can see what happens when you hold more than 7 cards: you discard half of them, rounded down. For this lesson, discard 10 grain. Then move the robber to the highlighted hex and steal one card from Bram. The robber also blocks that hex from producing.',
    highlight: { ui: ['roll', 'hand', 'board'], hexes: [SEVEN_ROBBER_HEX] },
    allows: allowedWhen((state, action) => {
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
    title: 'Trade 4:1, then settle',
    body:
      'You have spare ore but no brick, and a settlement costs 1 brick. Open Trade and, on the Bank tab, give 4 ore for 1 brick. Then build a settlement on the highlighted corner.',
    highlight: { ui: ['trade', 'build-settlement', 'board'], vertices: [LESSON_SETTLEMENT] },
    allows: allowedWhen((state, action) => {
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
    title: 'Buy a development card',
    body:
      'You have 1 wool, 1 grain and 1 ore, the cost of a development card. Buy one; it is a Knight. Cards bought this turn cannot be played until your next turn, so end your turn.',
    highlight: { ui: ['buy-card', 'dev-cards'] },
    allows: allowedWhen((state, action) => {
      if (!humanTurn(state)) return false
      if (action.type === 'buyDevCard') return state.phase.kind === 'main' && state.players[humanPlayer(state)].newDevCards.length === 0
      if (action.type === 'endTurn') return state.phase.kind === 'main' && state.players[humanPlayer(state)].newDevCards.length === 1
      return false
    }),
    completeWhen: (before, after, action) => action.type === 'endTurn',
  },
  {
    id: 'knight',
    title: 'Play the Knight',
    body:
      'Before rolling, play your Knight card. Move the robber to the highlighted hex and steal a card. Play three knights and you earn Largest Army, worth 2 victory points.',
    highlight: { ui: ['play-card', 'dev-cards', 'board'], hexes: [KNIGHT_ROBBER_HEX] },
    allows: allowedWhen((state, action) => {
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
    title: 'Longest Road, cities and winning',
    body:
      'The first player to build a road of 5 or more connected segments holds Longest Road (2 VP). Cities upgrade settlements and produce double. Keep playing until someone reaches 10 VP on their own turn.',
    highlight: { ui: ['players', 'status', 'hand'] },
    allows: () => false,
    completeWhen: 'next',
  },
  {
    id: 'free',
    title: 'You are on your own now',
    body:
      'The tutorial is over. Play this game freely from here. The Hint button is available whenever you want a suggestion; everything else works exactly like a normal game.',
    highlight: { ui: ['status', 'board'] },
    allows: () => true,
    completeWhen: 'next',
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

export function botActionsUntilHuman(state: GameState): Action[] {
  const actions: Action[] = []
  let current = state
  const human = humanPlayer(current)
  let guard = 0
  while (guard < 200) {
    if (current.phase.kind === 'gameOver') break
    const actors = playersToAct(current)
    if (actors.length === 0 || actors.includes(human)) break
    const bot = actors.find((p) => current.players[p].isBot)
    if (bot === undefined) break
    const action = chooseBotAction(current, bot)
    actions.push(action)
    current = applyAction(current, action)
    guard += 1
  }
  return actions
}
