import { z } from 'zod'
import { DEFAULT_SETTINGS, MAX_VP_TO_WIN, MIN_VP_TO_WIN, PIECES } from './constants'
import { COASTAL_EDGES, EDGES, HEXES, VERTICES } from './geometry'
import { emptyResources, isResourceCounts } from './helpers'
import { recountStatsFromEvents } from './stats'
import type { GameEvent, GameState, Player, Resource, ResourceCounts } from './types'

export const SAVE_KEY_V1 = 'catan-save-v1'
export const SAVE_KEY_V2 = 'catan-save-v2'
const QUARANTINE_KEY = 'catan-save-quarantine'
export const TUTORIAL_SAVE_KEY = 'catan-tutorial-v1'

export function saveKeyFor(mode: 'game' | 'tutorial'): string {
  return mode === 'game' ? SAVE_KEY_V2 : TUTORIAL_SAVE_KEY
}

const TERRAINS = ['lumber', 'wool', 'grain', 'brick', 'ore', 'desert'] as const
const PORT_TYPES = ['any', 'brick', 'lumber', 'wool', 'grain', 'ore'] as const
const RESOURCE_TYPES = ['brick', 'lumber', 'wool', 'grain', 'ore'] as const
const DEV_CARD_TYPES = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'] as const
const PLAYER_COLORS = ['red', 'blue', 'white', 'orange'] as const
const RETURN_PHASES = ['preRoll', 'main'] as const
const TRADE_REPLIES = ['pending', 'accept', 'decline', 'counter'] as const

const nonNegativeInt = z.number().int().nonnegative()

const resourceEnum = z.enum(RESOURCE_TYPES)

const resourceCountsSchema = z
  .object({
    brick: nonNegativeInt,
    lumber: nonNegativeInt,
    wool: nonNegativeInt,
    grain: nonNegativeInt,
    ore: nonNegativeInt,
  })
  .strict()

const tileSchema = z
  .object({
    terrain: z.enum(TERRAINS),
    number: z
      .number()
      .int()
      .min(2)
      .max(12)
      .refine((n) => n !== 7, 'tile number must not be 7')
      .nullable(),
  })
  .strict()
  .superRefine((tile, ctx) => {
    if (tile.terrain === 'desert' && tile.number !== null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'desert tile must have number null', path: ['number'] })
    }
    if (tile.terrain !== 'desert' && tile.number === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'non-desert tile must have a number', path: ['number'] })
    }
  })

const portSchema = z
  .object({
    edge: z.number().int().refine((e) => (COASTAL_EDGES as readonly number[]).includes(e), 'not a coastal edge'),
    type: z.enum(PORT_TYPES),
  })
  .strict()

const buildingSchema = z
  .object({
    owner: nonNegativeInt,
    kind: z.enum(['settlement', 'city']),
  })
  .strict()

const diceSchema = z.tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(6)])

const tradeTermsSchema = z
  .object({
    give: resourceCountsSchema,
    get: resourceCountsSchema,
  })
  .strict()

// --- v1 (legacy) schema ------------------------------------------------------

const playerSchemaV1 = z
  .object({
    id: nonNegativeInt,
    name: z.string(),
    color: z.enum(PLAYER_COLORS),
    isBot: z.boolean(),
    resources: resourceCountsSchema,
    devCards: z.array(z.enum(DEV_CARD_TYPES)),
    newDevCards: z.array(z.enum(DEV_CARD_TYPES)),
    knightsPlayed: nonNegativeInt,
    roadsLeft: z.number().int().min(0).max(PIECES.roads),
    settlementsLeft: z.number().int().min(0).max(PIECES.settlements),
    citiesLeft: z.number().int().min(0).max(PIECES.cities),
    longestRoad: nonNegativeInt,
  })
  .strict()

const phaseSchemaV1 = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('setup'),
      round: z.union([z.literal(1), z.literal(2)]),
      step: z.enum(['settlement', 'road']),
      lastSettlement: nonNegativeInt.nullable(),
    })
    .strict(),
  z.object({ kind: z.literal('preRoll') }).strict(),
  z
    .object({
      kind: z.literal('discard'),
      discards: z.array(nonNegativeInt),
    })
    .strict(),
  z
    .object({
      kind: z.literal('moveRobber'),
      returnTo: z.enum(RETURN_PHASES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('steal'),
      candidates: z.array(nonNegativeInt).min(1),
      returnTo: z.enum(RETURN_PHASES),
    })
    .strict(),
  z.object({ kind: z.literal('main') }).strict(),
  z
    .object({
      kind: z.literal('roadBuilding'),
      remaining: z.number().int().min(1),
      returnTo: z.enum(RETURN_PHASES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('gameOver'),
      winner: nonNegativeInt,
    })
    .strict(),
])

const eventSchemaV1 = z
  .object({
    seq: z.number().int(),
    type: z.string(),
  })
  .passthrough()

const gameStateSchemaV1 = z
  .object({
    version: z.literal(1),
    rng: z.number().int(),
    tiles: z.array(tileSchema).length(HEXES.length),
    ports: z.array(portSchema),
    robber: nonNegativeInt,
    buildings: z.array(buildingSchema.nullable()).length(VERTICES.length),
    roads: z.array(nonNegativeInt.nullable()).length(EDGES.length),
    players: z.array(playerSchemaV1).min(3).max(4),
    current: nonNegativeInt,
    phase: phaseSchemaV1,
    bank: resourceCountsSchema,
    devDeck: z.array(z.enum(DEV_CARD_TYPES)),
    devCardPlayedThisTurn: z.boolean(),
    dice: diceSchema.nullable(),
    longestRoadHolder: nonNegativeInt.nullable(),
    largestArmyHolder: nonNegativeInt.nullable(),
    turn: nonNegativeInt,
    events: z.array(eventSchemaV1),
    eventSeq: nonNegativeInt,
  })
  .strict()
  .superRefine((state, ctx) => {
    const playerCount = state.players.length
    const validPlayerId = (id: number) => id >= 0 && id < playerCount

    const humans = state.players.filter((p) => !p.isBot)
    if (humans.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'exactly one human player required', path: ['players'] })
    }
    state.players.forEach((p, i) => {
      if (p.id !== i) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'player id must equal its index', path: ['players', i, 'id'] })
      }
    })

    if (!validPlayerId(state.current)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'current player out of range', path: ['current'] })
    }
    if (state.robber >= HEXES.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'robber hex out of range', path: ['robber'] })
    }
    state.buildings.forEach((b, i) => {
      if (b !== null && !validPlayerId(b.owner)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'building owner out of range', path: ['buildings', i, 'owner'] })
      }
    })
    state.roads.forEach((r, i) => {
      if (r !== null && !validPlayerId(r)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'road owner out of range', path: ['roads', i] })
      }
    })
    if (state.longestRoadHolder !== null && !validPlayerId(state.longestRoadHolder)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'longestRoadHolder out of range',
        path: ['longestRoadHolder'],
      })
    }
    if (state.largestArmyHolder !== null && !validPlayerId(state.largestArmyHolder)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'largestArmyHolder out of range',
        path: ['largestArmyHolder'],
      })
    }

    const phase = state.phase
    if (phase.kind === 'setup' && phase.lastSettlement !== null && phase.lastSettlement >= VERTICES.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'lastSettlement out of range', path: ['phase', 'lastSettlement'] })
    }
    if (phase.kind === 'discard' && phase.discards.length !== playerCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'discards length must equal player count',
        path: ['phase', 'discards'],
      })
    }
    if (phase.kind === 'steal') {
      phase.candidates.forEach((c, i) => {
        if (!validPlayerId(c)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'steal candidate out of range',
            path: ['phase', 'candidates', i],
          })
        }
      })
    }
    if (phase.kind === 'gameOver' && !validPlayerId(phase.winner)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'winner out of range', path: ['phase', 'winner'] })
    }
  })

// --- v2 schema ----------------------------------------------------------------

const playerSchemaV2 = z
  .object({
    id: nonNegativeInt,
    name: z.string(),
    color: z.enum(PLAYER_COLORS),
    isBot: z.boolean(),
    level: z.enum(['easy', 'normal', 'hard']),
    resources: resourceCountsSchema,
    devCards: z.array(z.enum(DEV_CARD_TYPES)),
    newDevCards: z.array(z.enum(DEV_CARD_TYPES)),
    knightsPlayed: nonNegativeInt,
    roadsLeft: z.number().int().min(0).max(PIECES.roads),
    settlementsLeft: z.number().int().min(0).max(PIECES.settlements),
    citiesLeft: z.number().int().min(0).max(PIECES.cities),
    longestRoad: nonNegativeInt,
  })
  .strict()

const settingsSchema = z
  .object({
    vpToWin: z.number().int().min(MIN_VP_TO_WIN).max(MAX_VP_TO_WIN),
    friendlyRobber: z.boolean(),
    board: z.enum(['balanced', 'random', 'starter']),
    botTrades: z.boolean(),
  })
  .strict()

const playerStatsSchema = z
  .object({
    produced: resourceCountsSchema,
    blocked: nonNegativeInt,
    stole: nonNegativeInt,
    robbed: nonNegativeInt,
    discarded: nonNegativeInt,
    monopolyGained: nonNegativeInt,
    monopolyLost: nonNegativeInt,
    bankTrades: nonNegativeInt,
    playerTrades: nonNegativeInt,
    devCardsBought: nonNegativeInt,
    devCardsPlayed: nonNegativeInt,
  })
  .strict()

const gameStatsSchema = z
  .object({
    rolls: z.array(nonNegativeInt).length(13),
    players: z.array(playerStatsSchema),
    vpHistory: z.array(z.array(nonNegativeInt)),
    partial: z.boolean(),
  })
  .strict()

const tradeOfferSchema = z
  .object({
    id: nonNegativeInt,
    from: nonNegativeInt,
    to: z.array(nonNegativeInt),
    replies: z.array(z.enum(TRADE_REPLIES)),
    counters: z.array(tradeTermsSchema.nullable()),
    give: resourceCountsSchema,
    get: resourceCountsSchema,
  })
  .strict()

const phaseSchemaV2 = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('setup'),
      round: z.union([z.literal(1), z.literal(2)]),
      step: z.enum(['settlement', 'road']),
      lastSettlement: nonNegativeInt.nullable(),
    })
    .strict(),
  z.object({ kind: z.literal('preRoll') }).strict(),
  z
    .object({
      kind: z.literal('discard'),
      discards: z.array(nonNegativeInt),
    })
    .strict(),
  z
    .object({
      kind: z.literal('moveRobber'),
      returnTo: z.enum(RETURN_PHASES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('steal'),
      candidates: z.array(nonNegativeInt).min(1),
      returnTo: z.enum(RETURN_PHASES),
    })
    .strict(),
  z.object({ kind: z.literal('main') }).strict(),
  z
    .object({
      kind: z.literal('roadBuilding'),
      remaining: z.number().int().min(1),
      returnTo: z.enum(RETURN_PHASES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('trade'),
      offer: tradeOfferSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('gameOver'),
      winner: nonNegativeInt,
    })
    .strict(),
])

const eventBase = { seq: nonNegativeInt, turn: nonNegativeInt }

const setupSettlementEvent = z.object({ ...eventBase, type: z.literal('setupSettlement'), player: nonNegativeInt, vertex: nonNegativeInt }).strict()
const setupRoadEvent = z.object({ ...eventBase, type: z.literal('setupRoad'), player: nonNegativeInt, edge: nonNegativeInt }).strict()
const setupResourcesEvent = z.object({ ...eventBase, type: z.literal('setupResources'), player: nonNegativeInt, resources: resourceCountsSchema }).strict()
const rollEvent = z.object({ ...eventBase, type: z.literal('roll'), player: nonNegativeInt, dice: diceSchema }).strict()
const produceEvent = z.object({
  ...eventBase,
  type: z.literal('produce'),
  gains: z.array(resourceCountsSchema),
  blocked: z.array(resourceCountsSchema),
  shortage: z.array(resourceEnum),
}).strict()
const discardEvent = z.object({ ...eventBase, type: z.literal('discard'), player: nonNegativeInt, resources: resourceCountsSchema }).strict()
const robberMovedEvent = z.object({ ...eventBase, type: z.literal('robberMoved'), player: nonNegativeInt, hex: nonNegativeInt }).strict()
const stoleEvent = z.object({ ...eventBase, type: z.literal('stole'), player: nonNegativeInt, victim: nonNegativeInt, resource: resourceEnum.nullable() }).strict()
const builtEvent = z.object({
  ...eventBase,
  type: z.literal('built'),
  player: nonNegativeInt,
  kind: z.enum(['road', 'settlement', 'city']),
  at: nonNegativeInt,
}).strict()
const boughtDevCardEvent = z.object({ ...eventBase, type: z.literal('boughtDevCard'), player: nonNegativeInt }).strict()
const playedDevCardEvent = z.object({
  ...eventBase,
  type: z.literal('playedDevCard'),
  player: nonNegativeInt,
  card: z.enum(['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly']),
}).strict()
const yearOfPlentyEvent = z.object({
  ...eventBase,
  type: z.literal('yearOfPlenty'),
  player: nonNegativeInt,
  resources: z.tuple([resourceEnum, resourceEnum]),
}).strict()
const monopolyEvent = z.object({
  ...eventBase,
  type: z.literal('monopoly'),
  player: nonNegativeInt,
  resource: resourceEnum,
  taken: nonNegativeInt,
  takenFrom: z.array(nonNegativeInt),
}).strict()
const maritimeTradeEvent = z.object({
  ...eventBase,
  type: z.literal('maritimeTrade'),
  player: nonNegativeInt,
  give: resourceEnum,
  giveCount: nonNegativeInt,
  get: resourceEnum,
}).strict()
const domesticTradeEvent = z.object({
  ...eventBase,
  type: z.literal('domesticTrade'),
  player: nonNegativeInt,
  partner: nonNegativeInt,
  give: resourceCountsSchema,
  get: resourceCountsSchema,
}).strict()
const tradeProposedEvent = z.object({
  ...eventBase,
  type: z.literal('tradeProposed'),
  player: nonNegativeInt,
  offerId: nonNegativeInt,
  to: z.array(nonNegativeInt),
  give: resourceCountsSchema,
  get: resourceCountsSchema,
}).strict()
const tradeRepliedEvent = z.object({
  ...eventBase,
  type: z.literal('tradeReplied'),
  player: nonNegativeInt,
  offerId: nonNegativeInt,
  reply: z.enum(['accept', 'decline', 'counter']),
  counter: tradeTermsSchema.nullable(),
}).strict()
const tradeCancelledEvent = z.object({ ...eventBase, type: z.literal('tradeCancelled'), player: nonNegativeInt, offerId: nonNegativeInt }).strict()
const longestRoadEvent = z.object({ ...eventBase, type: z.literal('longestRoad'), player: nonNegativeInt.nullable() }).strict()
const largestArmyEvent = z.object({ ...eventBase, type: z.literal('largestArmy'), player: nonNegativeInt }).strict()
const turnEndedEvent = z.object({ ...eventBase, type: z.literal('turnEnded'), player: nonNegativeInt }).strict()
const gameOverEvent = z.object({ ...eventBase, type: z.literal('gameOver'), winner: nonNegativeInt }).strict()

const eventSchemaV2 = z.discriminatedUnion('type', [
  setupSettlementEvent,
  setupRoadEvent,
  setupResourcesEvent,
  rollEvent,
  produceEvent,
  discardEvent,
  robberMovedEvent,
  stoleEvent,
  builtEvent,
  boughtDevCardEvent,
  playedDevCardEvent,
  yearOfPlentyEvent,
  monopolyEvent,
  maritimeTradeEvent,
  domesticTradeEvent,
  tradeProposedEvent,
  tradeRepliedEvent,
  tradeCancelledEvent,
  longestRoadEvent,
  largestArmyEvent,
  turnEndedEvent,
  gameOverEvent,
])

const gameStateSchemaV2 = z
  .object({
    version: z.literal(2),
    settings: settingsSchema,
    stats: gameStatsSchema,
    offersThisTurn: nonNegativeInt,
    tradeSeq: nonNegativeInt,
    scriptedRolls: z.array(diceSchema).optional(),
    rng: z.number().int(),
    tiles: z.array(tileSchema).length(HEXES.length),
    ports: z.array(portSchema),
    robber: nonNegativeInt,
    buildings: z.array(buildingSchema.nullable()).length(VERTICES.length),
    roads: z.array(nonNegativeInt.nullable()).length(EDGES.length),
    players: z.array(playerSchemaV2).min(3).max(4),
    current: nonNegativeInt,
    phase: phaseSchemaV2,
    bank: resourceCountsSchema,
    devDeck: z.array(z.enum(DEV_CARD_TYPES)),
    devCardPlayedThisTurn: z.boolean(),
    dice: diceSchema.nullable(),
    longestRoadHolder: nonNegativeInt.nullable(),
    largestArmyHolder: nonNegativeInt.nullable(),
    turn: nonNegativeInt,
    events: z.array(eventSchemaV2),
    eventSeq: nonNegativeInt,
  })
  .strict()
  .superRefine((state, ctx) => {
    const playerCount = state.players.length
    const validPlayerId = (id: number) => id >= 0 && id < playerCount

    const humans = state.players.filter((p) => !p.isBot)
    if (humans.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'exactly one human player required', path: ['players'] })
    }
    state.players.forEach((p, i) => {
      if (p.id !== i) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'player id must equal its index', path: ['players', i, 'id'] })
      }
    })

    if (!validPlayerId(state.current)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'current player out of range', path: ['current'] })
    }
    if (state.robber >= HEXES.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'robber hex out of range', path: ['robber'] })
    }
    state.buildings.forEach((b, i) => {
      if (b !== null && !validPlayerId(b.owner)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'building owner out of range', path: ['buildings', i, 'owner'] })
      }
    })
    state.roads.forEach((r, i) => {
      if (r !== null && !validPlayerId(r)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'road owner out of range', path: ['roads', i] })
      }
    })
    if (state.longestRoadHolder !== null && !validPlayerId(state.longestRoadHolder)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'longestRoadHolder out of range',
        path: ['longestRoadHolder'],
      })
    }
    if (state.largestArmyHolder !== null && !validPlayerId(state.largestArmyHolder)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'largestArmyHolder out of range',
        path: ['largestArmyHolder'],
      })
    }

    const phase = state.phase
    if (phase.kind === 'setup' && phase.lastSettlement !== null && phase.lastSettlement >= VERTICES.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'lastSettlement out of range', path: ['phase', 'lastSettlement'] })
    }
    if (phase.kind === 'discard' && phase.discards.length !== playerCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'discards length must equal player count',
        path: ['phase', 'discards'],
      })
    }
    if (phase.kind === 'steal') {
      phase.candidates.forEach((c, i) => {
        if (!validPlayerId(c)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'steal candidate out of range',
            path: ['phase', 'candidates', i],
          })
        }
      })
    }
    if (phase.kind === 'trade') {
      const { offer } = phase
      if (!validPlayerId(offer.from)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'offer proposer out of range', path: ['phase', 'offer', 'from'] })
      }
      offer.to.forEach((p, i) => {
        if (!validPlayerId(p) || p === offer.from) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'offer recipient invalid',
            path: ['phase', 'offer', 'to', i],
          })
        }
      })
      if (offer.replies.length !== playerCount || offer.counters.length !== playerCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'offer replies and counters must match the player count',
          path: ['phase', 'offer'],
        })
      }
    }
    if (phase.kind === 'gameOver' && !validPlayerId(phase.winner)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'winner out of range', path: ['phase', 'winner'] })
    }

    if (state.stats.players.length !== playerCount) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'stats players must match the player count', path: ['stats', 'players'] })
    }
    state.stats.vpHistory.forEach((row, i) => {
      if (row.length !== playerCount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'vpHistory row must match the player count',
          path: ['stats', 'vpHistory', i],
        })
      }
    })
  })

export const saveSchemaV1 = gameStateSchemaV1
export const saveSchemaV2: z.ZodType<GameState> = gameStateSchemaV2

// --- Storage helpers ----------------------------------------------------------

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function removeQuietly(storage: Storage, key: string): void {
  try {
    storage.removeItem(key)
  } catch {
    // ignore storage failures
  }
}

function quarantine(storage: Storage, key: string): void {
  try {
    const raw = storage.getItem(key)
    if (raw !== null) storage.setItem(QUARANTINE_KEY, raw)
  } catch {
    // ignore storage failures while quarantining
  }
}

function versionOf(parsed: unknown): number | null {
  if (typeof parsed !== 'object' || parsed === null || !('version' in parsed)) return null
  const version = (parsed as { version: unknown }).version
  return typeof version === 'number' ? version : null
}

type LoadResult<T> = { kind: 'state'; state: T } | { kind: 'newer' } | { kind: 'absent' } | { kind: 'unreadable' }

function tryLoadV2(storage: Storage): LoadResult<GameState> {
  const raw = storage.getItem(SAVE_KEY_V2)
  if (raw === null) return { kind: 'absent' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    quarantine(storage, SAVE_KEY_V2)
    removeQuietly(storage, SAVE_KEY_V2)
    return { kind: 'unreadable' }
  }
  const version = versionOf(parsed)
  if (version !== null && version > 2) return { kind: 'newer' }
  const result = saveSchemaV2.safeParse(parsed)
  if (!result.success) {
    quarantine(storage, SAVE_KEY_V2)
    removeQuietly(storage, SAVE_KEY_V2)
    return { kind: 'unreadable' }
  }
  return { kind: 'state', state: result.data }
}

type V1Save = z.infer<typeof saveSchemaV1>
type V1Event = z.infer<typeof eventSchemaV1>

function tryLoadV1(storage: Storage): LoadResult<V1Save> {
  const raw = storage.getItem(SAVE_KEY_V1)
  if (raw === null) return { kind: 'absent' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    quarantine(storage, SAVE_KEY_V1)
    removeQuietly(storage, SAVE_KEY_V1)
    return { kind: 'unreadable' }
  }
  const version = versionOf(parsed)
  if (version !== null && version > 2) return { kind: 'newer' }
  const result = saveSchemaV1.safeParse(parsed)
  if (!result.success) {
    quarantine(storage, SAVE_KEY_V1)
    removeQuietly(storage, SAVE_KEY_V1)
    return { kind: 'unreadable' }
  }
  return { kind: 'state', state: result.data }
}

export function loadGame(): GameState | null {
  const storage = getStorage()
  if (!storage) return null

  const v2 = tryLoadV2(storage)
  if (v2.kind === 'state') return v2.state
  if (v2.kind === 'newer') return null

  const v1 = tryLoadV1(storage)
  if (v1.kind === 'state') {
    const migrated = migrateV1(v1.state)
    const check = saveSchemaV2.safeParse(migrated)
    if (!check.success) {
      quarantine(storage, SAVE_KEY_V1)
      removeQuietly(storage, SAVE_KEY_V1)
      return null
    }
    saveGame(check.data)
    removeQuietly(storage, SAVE_KEY_V1)
    return check.data
  }
  return null
}

export function saveGame(state: GameState): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(SAVE_KEY_V2, JSON.stringify(state))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export function clearGame(): void {
  const storage = getStorage()
  if (!storage) return
  removeQuietly(storage, SAVE_KEY_V2)
  removeQuietly(storage, SAVE_KEY_V1)
}

// --- v1 migration -------------------------------------------------------------

function asInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function asCounts(value: unknown): ResourceCounts | null {
  return isResourceCounts(value) ? value : null
}

function asDice(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const a = asInt(value[0])
  const b = asInt(value[1])
  if (a === null || b === null || a < 1 || a > 6 || b < 1 || b > 6) return null
  return [a, b]
}

function asResource(value: unknown): Resource | null {
  if (typeof value !== 'string') return null
  return (RESOURCE_TYPES as readonly string[]).includes(value) ? (value as Resource) : null
}

function migrateEvent(raw: V1Event, playerCount: number): GameEvent | null {
  const seq = raw.seq
  const turn = typeof raw.turn === 'number' && Number.isInteger(raw.turn) && raw.turn >= 0 ? raw.turn : 0
  const player = asInt(raw.player)
  switch (raw.type) {
    case 'setupSettlement': {
      const vertex = asInt(raw.vertex)
      if (player === null || vertex === null) return null
      return { seq, turn, type: 'setupSettlement', player, vertex }
    }
    case 'setupRoad': {
      const edge = asInt(raw.edge)
      if (player === null || edge === null) return null
      return { seq, turn, type: 'setupRoad', player, edge }
    }
    case 'setupResources': {
      const resources = asCounts(raw.resources)
      if (player === null || resources === null) return null
      return { seq, turn, type: 'setupResources', player, resources }
    }
    case 'roll': {
      const dice = asDice(raw.dice)
      if (player === null || dice === null) return null
      return { seq, turn, type: 'roll', player, dice }
    }
    case 'produce': {
      const gains = Array.isArray(raw.gains) ? raw.gains.map(asCounts) : null
      if (gains === null || gains.some((g) => g === null) || gains.length !== playerCount) return null
      return {
        seq,
        turn,
        type: 'produce',
        gains: gains as ResourceCounts[],
        blocked: Array.from({ length: playerCount }, emptyResources),
        shortage: [],
      }
    }
    case 'discard': {
      const resources = asCounts(raw.resources)
      if (player === null || resources === null) return null
      return { seq, turn, type: 'discard', player, resources }
    }
    case 'robberMoved': {
      const hex = asInt(raw.hex)
      if (player === null || hex === null) return null
      return { seq, turn, type: 'robberMoved', player, hex }
    }
    case 'stole': {
      const victim = asInt(raw.victim)
      if (player === null || victim === null) return null
      if (raw.resource === null) return { seq, turn, type: 'stole', player, victim, resource: null }
      const resource = asResource(raw.resource)
      if (resource === null) return null
      return { seq, turn, type: 'stole', player, victim, resource }
    }
    case 'built': {
      const kind = raw.kind === 'road' || raw.kind === 'settlement' || raw.kind === 'city' ? raw.kind : null
      const at = asInt(raw.at)
      if (player === null || kind === null || at === null) return null
      return { seq, turn, type: 'built', player, kind, at }
    }
    case 'boughtDevCard':
      if (player === null) return null
      return { seq, turn, type: 'boughtDevCard', player }
    case 'playedDevCard': {
      const card =
        raw.card === 'knight' || raw.card === 'roadBuilding' || raw.card === 'yearOfPlenty' || raw.card === 'monopoly'
          ? raw.card
          : null
      if (player === null || card === null) return null
      return { seq, turn, type: 'playedDevCard', player, card }
    }
    case 'yearOfPlenty': {
      if (!Array.isArray(raw.resources) || raw.resources.length !== 2) return null
      const first = asResource(raw.resources[0])
      const second = asResource(raw.resources[1])
      if (player === null || first === null || second === null) return null
      return { seq, turn, type: 'yearOfPlenty', player, resources: [first, second] }
    }
    case 'monopoly': {
      const resource = asResource(raw.resource)
      const taken = asInt(raw.taken)
      if (player === null || resource === null || taken === null) return null
      return {
        seq,
        turn,
        type: 'monopoly',
        player,
        resource,
        taken,
        takenFrom: Array(playerCount).fill(0),
      }
    }
    case 'maritimeTrade': {
      const give = asResource(raw.give)
      const giveCount = asInt(raw.giveCount)
      const get = asResource(raw.get)
      if (player === null || give === null || giveCount === null || get === null) return null
      return { seq, turn, type: 'maritimeTrade', player, give, giveCount, get }
    }
    case 'domesticTrade': {
      const partner = asInt(raw.partner)
      const give = asCounts(raw.give)
      const get = asCounts(raw.get)
      if (player === null || partner === null || give === null || get === null) return null
      return { seq, turn, type: 'domesticTrade', player, partner, give, get }
    }
    case 'longestRoad': {
      const holder = raw.player === null ? null : asInt(raw.player)
      if (raw.player !== null && holder === null) return null
      return { seq, turn, type: 'longestRoad', player: holder }
    }
    case 'largestArmy': {
      if (player === null) return null
      return { seq, turn, type: 'largestArmy', player }
    }
    case 'turnEnded':
      if (player === null) return null
      return { seq, turn, type: 'turnEnded', player }
    case 'gameOver': {
      const winner = asInt(raw.winner)
      if (winner === null) return null
      return { seq, turn, type: 'gameOver', winner }
    }
    default:
      return null
  }
}

export function migrateV1(v1: V1Save): GameState {
  const playerCount = v1.players.length
  const players: Player[] = v1.players.map((p, id) => ({
    id,
    name: p.name,
    color: p.color,
    isBot: p.isBot,
    level: 'normal',
    resources: p.resources,
    devCards: p.devCards,
    newDevCards: p.newDevCards,
    knightsPlayed: p.knightsPlayed,
    roadsLeft: p.roadsLeft,
    settlementsLeft: p.settlementsLeft,
    citiesLeft: p.citiesLeft,
    longestRoad: p.longestRoad,
  }))
  const events = v1.events
    .map((event) => migrateEvent(event, playerCount))
    .filter((event): event is GameEvent => event !== null)
  const stats = recountStatsFromEvents(events, playerCount)
  return {
    version: 2,
    settings: { ...DEFAULT_SETTINGS, board: 'random' },
    stats,
    offersThisTurn: 0,
    tradeSeq: 0,
    rng: v1.rng,
    tiles: v1.tiles,
    ports: v1.ports,
    robber: v1.robber,
    buildings: v1.buildings,
    roads: v1.roads,
    players,
    current: v1.current,
    phase: v1.phase,
    bank: v1.bank,
    devDeck: v1.devDeck,
    devCardPlayedThisTurn: v1.devCardPlayedThisTurn,
    dice: v1.dice,
    longestRoadHolder: v1.longestRoadHolder,
    largestArmyHolder: v1.largestArmyHolder,
    turn: v1.turn,
    events,
    eventSeq: v1.eventSeq,
  }
}
