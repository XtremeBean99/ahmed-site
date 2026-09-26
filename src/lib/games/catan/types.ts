export type Resource = 'brick' | 'lumber' | 'wool' | 'grain' | 'ore'
export type Terrain = Resource | 'desert'
export type ResourceCounts = Record<Resource, number>
export type PortType = Resource | 'any'
export type DevCardType = 'knight' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly' | 'victoryPoint'
export type PlayerColor = 'red' | 'blue' | 'white' | 'orange'
/** Index into GameState.players. */
export type PlayerId = number
export type BotLevel = 'easy' | 'normal' | 'hard'
export type BoardPreset = 'balanced' | 'random' | 'starter'

export interface GameSettings {
  /** Victory points needed to win on your own turn, 8 to 13. */
  vpToWin: number
  /** The robber may not block or rob a player with 2 or fewer public VP while another hex is legal. */
  friendlyRobber: boolean
  board: BoardPreset
  /** Bots may propose trades to the other players, the human included. */
  botTrades: boolean
}

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
  /** Bot strength; 'normal' for the human, where it only sets the hint's quality. */
  level: BotLevel
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

export type TradeReply = 'pending' | 'accept' | 'decline' | 'counter'

/** Always from the proposer's side: `give` leaves the proposer, `get` reaches the proposer. */
export interface TradeTerms {
  give: ResourceCounts
  get: ResourceCounts
}

export interface TradeOffer extends TradeTerms {
  /** GameState.tradeSeq when proposed; a stable key for the UI and the log. */
  id: number
  from: PlayerId
  /** Recipients in ascending order, never including `from`. */
  to: PlayerId[]
  /** Indexed by player id; the proposer and non-recipients are 'decline'. */
  replies: TradeReply[]
  /** Indexed by player id; the terms a 'counter' reply proposes instead, else null. */
  counters: (TradeTerms | null)[]
}

export type Phase =
  | { kind: 'setup'; round: 1 | 2; step: 'settlement' | 'road'; lastSettlement: number | null }
  | { kind: 'preRoll' }
  /** discards[p] = cards player p still has to discard (0 when done). */
  | { kind: 'discard'; discards: number[] }
  | { kind: 'moveRobber'; returnTo: ReturnPhase }
  | { kind: 'steal'; candidates: PlayerId[]; returnTo: ReturnPhase }
  | { kind: 'main' }
  | { kind: 'roadBuilding'; remaining: number; returnTo: ReturnPhase }
  /** Entered from 'main' by proposeTrade; always returns to 'main'. */
  | { kind: 'trade'; offer: TradeOffer }
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
  /** Deprecated: an immediate trade without the partner's consent. Replaced by the trade actions below. */
  | { type: 'domesticTrade'; partner: PlayerId; give: ResourceCounts; get: ResourceCounts }
  /** The current player offers `give` for `get` to one or more players (main phase, capped per turn). */
  | { type: 'proposeTrade'; to: PlayerId[]; give: ResourceCounts; get: ResourceCounts }
  /** A pending recipient answers; `counter` is required when reply is 'counter'. Carries its actor like discard. */
  | { type: 'respondTrade'; player: PlayerId; reply: 'accept' | 'decline' | 'counter'; counter?: TradeTerms }
  /** The proposer trades with a player who accepted (original terms) or countered (their terms). */
  | { type: 'confirmTrade'; partner: PlayerId }
  /** The proposer withdraws the offer. */
  | { type: 'cancelTrade' }
  | { type: 'endTurn' }

export type ActionType = Action['type']

type EventBody =
  | { type: 'setupSettlement'; player: PlayerId; vertex: number }
  | { type: 'setupRoad'; player: PlayerId; edge: number }
  /** Resources paid out for the second setup settlement. */
  | { type: 'setupResources'; player: PlayerId; resources: ResourceCounts }
  | { type: 'roll'; player: PlayerId; dice: [number, number] }
  /**
   * gains[p] = what player p received; blocked[p] = what the robber's hex withheld from p;
   * shortage = resources nobody received because the bank ran short. Omitted when all three are empty.
   */
  | { type: 'produce'; gains: ResourceCounts[]; blocked: ResourceCounts[]; shortage: Resource[] }
  | { type: 'discard'; player: PlayerId; resources: ResourceCounts }
  | { type: 'robberMoved'; player: PlayerId; hex: number }
  /** resource is null when the victim had no cards. */
  | { type: 'stole'; player: PlayerId; victim: PlayerId; resource: Resource | null }
  | { type: 'built'; player: PlayerId; kind: 'road' | 'settlement' | 'city'; at: number }
  | { type: 'boughtDevCard'; player: PlayerId }
  | { type: 'playedDevCard'; player: PlayerId; card: Exclude<DevCardType, 'victoryPoint'> }
  | { type: 'yearOfPlenty'; player: PlayerId; resources: [Resource, Resource] }
  /** takenFrom[p] = cards taken from player p (0 for the player who played it). */
  | { type: 'monopoly'; player: PlayerId; resource: Resource; taken: number; takenFrom: number[] }
  | { type: 'maritimeTrade'; player: PlayerId; give: Resource; giveCount: number; get: Resource }
  | { type: 'domesticTrade'; player: PlayerId; partner: PlayerId; give: ResourceCounts; get: ResourceCounts }
  | { type: 'tradeProposed'; player: PlayerId; offerId: number; to: PlayerId[]; give: ResourceCounts; get: ResourceCounts }
  | { type: 'tradeReplied'; player: PlayerId; offerId: number; reply: 'accept' | 'decline' | 'counter'; counter: TradeTerms | null }
  | { type: 'tradeCancelled'; player: PlayerId; offerId: number }
  | { type: 'longestRoad'; player: PlayerId | null }
  | { type: 'largestArmy'; player: PlayerId }
  | { type: 'turnEnded'; player: PlayerId }
  | { type: 'gameOver'; winner: PlayerId }

export type GameEvent = EventBody & { seq: number; turn: number }
export type GameEventInput = EventBody

export interface PlayerStats {
  /** Cards received from dice production and the second setup settlement, by resource. */
  produced: ResourceCounts
  /** Cards the robber's hex withheld from this player on rolls. */
  blocked: number
  /** Cards this player stole with the robber, and cards stolen from them. */
  stole: number
  robbed: number
  discarded: number
  monopolyGained: number
  monopolyLost: number
  bankTrades: number
  playerTrades: number
  devCardsBought: number
  devCardsPlayed: number
}

export interface GameStats {
  /** rolls[n] = how often the dice totalled n; length 13, indexes 0 and 1 unused. */
  rolls: number[]
  players: PlayerStats[]
  /** vpHistory[i][p] = public VP of player p when turn i + 1 ended; a final row with hidden VP is added at game over. */
  vpHistory: number[][]
  /** True for games migrated from a v1 save: the counts only cover what the old event log still held. */
  partial: boolean
}

export interface GameState {
  version: 2
  settings: GameSettings
  stats: GameStats
  /** Trade proposals made by the current player this turn; reset by endTurn. */
  offersThisTurn: number
  /** Id of the most recent trade offer (0 before the first). */
  tradeSeq: number
  /** Tutorial only: dice used, front first, before the RNG is consulted. */
  scriptedRolls?: [number, number][]
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
  /** Defaults to red; the bots take the remaining colours in PLAYER_COLORS order. */
  humanColor?: PlayerColor
  /** Level for every bot; defaults to 'normal'. */
  botLevel?: BotLevel
  settings?: Partial<GameSettings>
}

export type ActionOf<T extends ActionType> = Extract<Action, { type: T }>

export interface Handler<T extends ActionType> {
  /** Reason the action is illegal right now, or null. Must not mutate. */
  validate(state: GameState, action: ActionOf<T>): string | null
  /** Mutates a state that validate() accepted. Never called otherwise. */
  apply(state: GameState, action: ActionOf<T>): void
}

export type HandlerMap<T extends ActionType> = { [K in T]: Handler<K> }
