export type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore'
export type Terrain = Resource | 'desert'
export type ResourceCounts = Record<Resource, number>
export type PortType = Resource | 'any'
export type DevCardType = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint'
export type PlayerColor = 'red' | 'blue' | 'white' | 'orange'
/** Index into GameState.players. */
export type PlayerId = number

/** Indexed by hex id (see geometry.ts). */
export interface Tile {
  terrain: Terrain
  /** 2..12 except 7; null on the desert. */
  number: number | null
}

export interface Port {
  /** Coastal edge id; both of its vertices trade at this port's rate. */
  edge: number
  type: PortType
}

export interface Building {
  owner: PlayerId
  kind: 'settlement' | 'city'
}

export interface Player {
  id: PlayerId
  name: string
  color: PlayerColor
  isBot: boolean
  resources: ResourceCounts
  /** Playable cards (bought before the current turn). Includes unplayable victoryPoint cards. */
  devCards: DevCardType[]
  /** Bought this turn; become playable when this player's turn ends. */
  newDevCards: DevCardType[]
  knightsPlayed: number
  roadsLeft: number
  settlementsLeft: number
  citiesLeft: number
  /** Cached by longest-road.ts after every action. */
  longestRoad: number
}

/** Where the game resumes after the robber (knight or 7) or Road Building resolves. */
export type ReturnPhase = 'preRoll' | 'main'

export type Phase =
  | { kind: 'setup'; round: 1 | 2; step: 'settlement' | 'road'; lastSettlement: number | null }
  | { kind: 'preRoll' }
  /** discards[p] = cards player p still has to discard (0 when done). */
  | { kind: 'discard'; discards: number[] }
  | { kind: 'moveRobber'; returnTo: ReturnPhase }
  | { kind: 'steal'; candidates: PlayerId[]; returnTo: ReturnPhase }
  | { kind: 'main' }
  | { kind: 'roadBuilding'; remaining: number; returnTo: ReturnPhase }
  | { kind: 'gameOver'; winner: PlayerId }

export type PhaseKind = Phase['kind']

export type Action =
  | { type: 'placeSetupSettlement'; vertex: number }
  | { type: 'placeSetupRoad'; edge: number }
  | { type: 'rollDice' }
  /** The only action taken by a player other than `current`. */
  | { type: 'discard'; player: PlayerId; resources: ResourceCounts }
  | { type: 'moveRobber'; hex: number }
  | { type: 'steal'; victim: PlayerId }
  /** Paid in `main`; free in `roadBuilding`. */
  | { type: 'buildRoad'; edge: number }
  | { type: 'buildSettlement'; vertex: number }
  | { type: 'buildCity'; vertex: number }
  | { type: 'buyDevCard' }
  | { type: 'playKnight' }
  | { type: 'playRoadBuilding' }
  | { type: 'playYearOfPlenty'; resources: [Resource, Resource] }
  | { type: 'playMonopoly'; resource: Resource }
  /** Gives `maritimeRate(give)` of `give` to the bank for one `get`. */
  | { type: 'maritimeTrade'; give: Resource; get: Resource }
  /** Acceptance is decided outside the engine (ai.ts botAcceptsTrade). */
  | { type: 'domesticTrade'; partner: PlayerId; give: ResourceCounts; get: ResourceCounts }
  | { type: 'endTurn' }

export type ActionType = Action['type']

type EventBody =
  | { type: 'setupSettlement'; player: PlayerId; vertex: number }
  | { type: 'setupRoad'; player: PlayerId; edge: number }
  /** Resources paid out for the second setup settlement. */
  | { type: 'setupResources'; player: PlayerId; resources: ResourceCounts }
  | { type: 'roll'; player: PlayerId; dice: [number, number] }
  /** gains[p] = what player p received. Omitted when nobody received anything. */
  | { type: 'produce'; gains: ResourceCounts[] }
  | { type: 'discard'; player: PlayerId; resources: ResourceCounts }
  | { type: 'robberMoved'; player: PlayerId; hex: number }
  /** resource is null when the victim had no cards. */
  | { type: 'stole'; player: PlayerId; victim: PlayerId; resource: Resource | null }
  | { type: 'built'; player: PlayerId; kind: 'road' | 'settlement' | 'city'; at: number }
  | { type: 'boughtDevCard'; player: PlayerId }
  | { type: 'playedDevCard'; player: PlayerId; card: Exclude<DevCardType, 'victoryPoint'> }
  | { type: 'yearOfPlenty'; player: PlayerId; resources: [Resource, Resource] }
  | { type: 'monopoly'; player: PlayerId; resource: Resource; taken: number }
  | { type: 'maritimeTrade'; player: PlayerId; give: Resource; giveCount: number; get: Resource }
  | { type: 'domesticTrade'; player: PlayerId; partner: PlayerId; give: ResourceCounts; get: ResourceCounts }
  | { type: 'longestRoad'; player: PlayerId | null }
  | { type: 'largestArmy'; player: PlayerId }
  | { type: 'turnEnded'; player: PlayerId }
  | { type: 'gameOver'; winner: PlayerId }

export type GameEvent = EventBody & { seq: number; turn: number }
export type GameEventInput = EventBody

export interface GameState {
  version: 1
  /** mulberry32 state; advance only through rng.ts. */
  rng: number
  /** 19 tiles, indexed by hex id. */
  tiles: Tile[]
  ports: Port[]
  /** Hex id. */
  robber: number
  /** 54 entries, indexed by vertex id. */
  buildings: (Building | null)[]
  /** 72 entries, indexed by edge id; the owning player. */
  roads: (PlayerId | null)[]
  players: Player[]
  current: PlayerId
  phase: Phase
  bank: ResourceCounts
  /** Drawn from the end. */
  devDeck: DevCardType[]
  devCardPlayedThisTurn: boolean
  dice: [number, number] | null
  longestRoadHolder: PlayerId | null
  largestArmyHolder: PlayerId | null
  /** 0 during setup, 1 on the first normal turn, +1 on every endTurn. */
  turn: number
  /** Most recent events, oldest first, capped at MAX_EVENTS. */
  events: GameEvent[]
  eventSeq: number
}

export interface NewGameOptions {
  seed: number
  playerCount: 3 | 4
  humanName?: string
}

export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>

export interface Handler<T extends ActionType> {
  /** Reason the action is illegal right now, or null. Must not mutate. */
  validate(state: GameState, action: ActionOf<T>): string | null
  /** Mutates a state that validate() accepted. Never called otherwise. */
  apply(state: GameState, action: ActionOf<T>): void
}

export type HandlerMap<T extends ActionType> = { [K in T]: Handler<K> }
