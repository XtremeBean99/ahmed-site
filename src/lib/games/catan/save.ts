import { z } from 'zod'
import { PIECES } from './constants'
import { COASTAL_EDGES, EDGES, HEXES, VERTICES } from './geometry'
import type { GameState } from './types'

const SAVE_KEY = 'catan-save-v1'

const TERRAINS = ['lumber', 'wool', 'grain', 'brick', 'ore', 'desert'] as const
const PORT_TYPES = ['any', 'brick', 'lumber', 'wool', 'grain', 'ore'] as const
const DEV_CARD_TYPES = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint'] as const
const PLAYER_COLORS = ['red', 'blue', 'white', 'orange'] as const
const RETURN_PHASES = ['preRoll', 'main'] as const

const nonNegativeInt = z.number().int().nonnegative()

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

const playerSchema = z
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

const phaseSchema = z.discriminatedUnion('kind', [
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

const eventSchema = z
  .object({
    seq: z.number().int(),
    type: z.string(),
  })
  .passthrough()

const gameStateSchema = z
  .object({
    version: z.literal(1),
    rng: z.number().int(),
    tiles: z.array(tileSchema).length(HEXES.length),
    ports: z.array(portSchema),
    robber: nonNegativeInt,
    buildings: z.array(buildingSchema.nullable()).length(VERTICES.length),
    roads: z.array(nonNegativeInt.nullable()).length(EDGES.length),
    players: z.array(playerSchema).min(3).max(4),
    current: nonNegativeInt,
    phase: phaseSchema,
    bank: resourceCountsSchema,
    devDeck: z.array(z.enum(DEV_CARD_TYPES)),
    devCardPlayedThisTurn: z.boolean(),
    dice: z
      .tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(6)])
      .nullable(),
    longestRoadHolder: nonNegativeInt.nullable(),
    largestArmyHolder: nonNegativeInt.nullable(),
    turn: nonNegativeInt,
    events: z.array(eventSchema),
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

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadGame(): GameState | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(SAVE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    const result = gameStateSchema.safeParse(parsed)
    if (!result.success) {
      storage.removeItem(SAVE_KEY)
      return null
    }
    return result.data as GameState
  } catch {
    try {
      storage.removeItem(SAVE_KEY)
    } catch {
      // ignore storage failures when clearing a corrupt save
    }
    return null
  }
}

export function saveGame(state: GameState): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

export function clearGame(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(SAVE_KEY)
  } catch {
    // ignore
  }
}
