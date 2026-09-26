import { COSTS, RESOURCES } from '@/lib/games/catan/constants'
import { playersToAct, validateAction } from '@/lib/games/catan/engine'
import {
  hasResources,
  legalCities,
  legalRobberHexes,
  legalRoads,
  legalSettlements,
  legalSetupRoads,
  legalSetupSettlements,
  maritimeRate,
  totalCards,
} from '@/lib/games/catan/helpers'
import type { Action, GameState, PlayerId } from '@/lib/games/catan/types'
import { actionBlockReason } from './action-reasons'
import type { BuildMode } from './ActionBar'
import type { BoardTargets } from './BoardCanvas'
import { fill, playerSubject } from './event-text'
import { playableDevCards, type PlayableDevCard } from './PlayCardDialog'

export interface StatusMessages {
  newGame: string
  setupSettlement: string
  setupRoad: string
  preRoll: string
  main: string
  roadBuilding: string
  moveRobber: string
  steal: string
  discard: string
  gameOver: string
  gameOverYou: string
  buildMode: string
}

export interface StatusInfo {
  text: string
  /** Player whose colour square the status banner shows. */
  player: PlayerId
  /** True when the human is one of the players who must act. */
  mustAct: boolean
}

export interface CanFlags {
  canRoll: boolean
  canRoad: boolean
  canSettlement: boolean
  canCity: boolean
  canBuyDev: boolean
  canTrade: boolean
  canEndTurn: boolean
  canPlayCard: boolean
  playableCards: PlayableDevCard[]
}

function emptyTargets(): BoardTargets {
  return { kind: null, vertices: [], edges: [], hexes: [] }
}

function humanAllowed(
  state: GameState,
  action: Action,
  canHumanApply?: (state: GameState, action: Action) => boolean,
): boolean {
  return canHumanApply ? canHumanApply(state, action) : true
}

/** Board overlay targets for the current phase and build mode, filtered by the tutorial when present. */
export function selectBoardTargets(
  state: GameState | null,
  human: PlayerId,
  buildMode: BuildMode,
  canHumanApply?: (state: GameState, action: Action) => boolean,
): BoardTargets {
  if (!state || human < 0 || !playersToAct(state).includes(human)) return emptyTargets()
  const filterVertices = (list: number[], make: (v: number) => Action) =>
    canHumanApply ? list.filter((v) => canHumanApply(state, make(v))) : list
  const filterEdges = (list: number[], make: (e: number) => Action) =>
    canHumanApply ? list.filter((e) => canHumanApply(state, make(e))) : list
  const phase = state.phase
  switch (phase.kind) {
    case 'setup':
      if (phase.step === 'settlement') {
        return {
          kind: 'setupSettlement',
          vertices: filterVertices(legalSetupSettlements(state), (v) => ({ type: 'placeSetupSettlement', vertex: v })),
          edges: [],
          hexes: [],
        }
      }
      return {
        kind: 'setupRoad',
        vertices: [],
        edges: filterEdges(legalSetupRoads(state), (e) => ({ type: 'placeSetupRoad', edge: e })),
        hexes: [],
      }
    case 'moveRobber':
      return {
        kind: 'robber',
        vertices: [],
        edges: [],
        // The engine's legal set, so the friendly robber's protected hexes are never offered.
        hexes: legalRobberHexes(state).filter((id) => humanAllowed(state, { type: 'moveRobber', hex: id }, canHumanApply)),
      }
    case 'roadBuilding':
      return {
        kind: 'road',
        vertices: [],
        edges: filterEdges(legalRoads(state, human), (e) => ({ type: 'buildRoad', edge: e })),
        hexes: [],
      }
    case 'main':
      if (buildMode === 'road') {
        return {
          kind: 'road',
          vertices: [],
          edges: filterEdges(legalRoads(state, human), (e) => ({ type: 'buildRoad', edge: e })),
          hexes: [],
        }
      }
      if (buildMode === 'settlement') {
        return {
          kind: 'settlement',
          vertices: filterVertices(legalSettlements(state, human), (v) => ({ type: 'buildSettlement', vertex: v })),
          edges: [],
          hexes: [],
        }
      }
      if (buildMode === 'city') {
        return {
          kind: 'city',
          vertices: filterVertices(legalCities(state, human), (v) => ({ type: 'buildCity', vertex: v })),
          edges: [],
          hexes: [],
        }
      }
      return emptyTargets()
    default:
      return emptyTargets()
  }
}

function cardAction(card: PlayableDevCard): Action {
  if (card === 'knight') return { type: 'playKnight' }
  if (card === 'roadBuilding') return { type: 'playRoadBuilding' }
  if (card === 'yearOfPlenty') return { type: 'playYearOfPlenty', resources: ['brick', 'brick'] }
  return { type: 'playMonopoly', resource: 'brick' }
}

/** Whether a pending trade offer is addressed to the human and awaits their reply. */
export function isTradePendingForHuman(state: GameState, human: PlayerId): boolean {
  if (state.phase.kind !== 'trade') return false
  const { offer } = state.phase
  return offer.to.includes(human) && offer.replies[human] === 'pending'
}

export function selectCanFlags(
  state: GameState | null,
  human: PlayerId,
  canHumanApply?: (state: GameState, action: Action) => boolean,
): CanFlags {
  const none: CanFlags = {
    canRoll: false,
    canRoad: false,
    canSettlement: false,
    canCity: false,
    canBuyDev: false,
    canTrade: false,
    canEndTurn: false,
    canPlayCard: false,
    playableCards: [],
  }
  if (!state || human < 0 || !playersToAct(state).includes(human)) return none
  const me = state.players[human]
  const inMain = state.phase.kind === 'main'
  const inPreRoll = state.phase.kind === 'preRoll'
  const allowed = (action: Action) => humanAllowed(state, action, canHumanApply)

  const roadSpots = inMain ? legalRoads(state, human).filter((e) => allowed({ type: 'buildRoad', edge: e })) : []
  const settlementSpots = inMain
    ? legalSettlements(state, human).filter((v) => allowed({ type: 'buildSettlement', vertex: v }))
    : []
  const citySpots = inMain ? legalCities(state, human).filter((v) => allowed({ type: 'buildCity', vertex: v })) : []

  // Any card can go into a player offer, so outside the tutorial the panel opens whenever you hold one;
  // the tutorial allows only specific trades, so there it needs an allowed bank trade.
  let canTrade = inMain && !canHumanApply && totalCards(me.resources) > 0
  if (inMain && canHumanApply) {
    for (const give of RESOURCES) {
      const rate = maritimeRate(state, human, give)
      if (me.resources[give] < rate) continue
      for (const get of RESOURCES) {
        if (get === give || state.bank[get] === 0) continue
        if (allowed({ type: 'maritimeTrade', give, get })) {
          canTrade = true
          break
        }
      }
      if (canTrade) break
    }
  }

  const playableCards = playableDevCards(state, human).filter((card) => {
    if (card === 'yearOfPlenty') {
      return RESOURCES.some((a) =>
        RESOURCES.some(
          (b) =>
            validateAction(state, { type: 'playYearOfPlenty', resources: [a, b] }) === null &&
            allowed({ type: 'playYearOfPlenty', resources: [a, b] }),
        ),
      )
    }
    return allowed(cardAction(card))
  })

  return {
    canRoll: inPreRoll && allowed({ type: 'rollDice' }),
    canRoad: inMain && hasResources(me.resources, COSTS.road) && roadSpots.length > 0,
    canSettlement: inMain && hasResources(me.resources, COSTS.settlement) && settlementSpots.length > 0,
    canCity: inMain && hasResources(me.resources, COSTS.city) && citySpots.length > 0,
    canBuyDev: inMain && hasResources(me.resources, COSTS.devCard) && state.devDeck.length > 0 && allowed({ type: 'buyDevCard' }),
    canTrade,
    canEndTurn: inMain && allowed({ type: 'endTurn' }),
    canPlayCard: playableCards.length > 0,
    playableCards,
  }
}

export function selectBlockReasons(
  state: GameState | null,
  human: PlayerId,
  humanActing: boolean,
): { road: ReturnType<typeof actionBlockReason>; settlement: ReturnType<typeof actionBlockReason>; city: ReturnType<typeof actionBlockReason>; devCard: ReturnType<typeof actionBlockReason> } | null {
  if (!state || human < 0 || !state.players[human] || !humanActing) return null
  if (state.phase.kind !== 'main' && state.phase.kind !== 'preRoll') return null
  return {
    road: actionBlockReason(state, human, 'road'),
    settlement: actionBlockReason(state, human, 'settlement'),
    city: actionBlockReason(state, human, 'city'),
    devCard: actionBlockReason(state, human, 'devCard'),
  }
}

export function selectStatus(
  state: GameState | null,
  human: PlayerId,
  status: string | null,
  statusOverride: string | null | undefined,
  buildMode: BuildMode,
  messages: StatusMessages,
): StatusInfo {
  if (statusOverride) return { text: statusOverride, player: state?.current ?? 0, mustAct: false }
  if (!state) return { text: messages.newGame, player: 0, mustAct: false }
  if (status) return { text: status, player: state.current, mustAct: playersToAct(state).includes(human) }
  const acting = playersToAct(state).includes(human)
  const player = playerSubject(state, state.current)
  if (buildMode && state.phase.kind === 'main' && acting) {
    return { text: messages.buildMode, player: state.current, mustAct: true }
  }
  const phase = state.phase
  switch (phase.kind) {
    case 'setup':
      return {
        text: fill(phase.step === 'settlement' ? messages.setupSettlement : messages.setupRoad, { player }),
        player: state.current,
        mustAct: acting,
      }
    case 'preRoll':
      return { text: fill(messages.preRoll, { player }), player: state.current, mustAct: acting }
    case 'main':
      return { text: fill(messages.main, { player }), player: state.current, mustAct: acting }
    case 'roadBuilding':
      return {
        text: fill(messages.roadBuilding, { player, remaining: phase.remaining }),
        player: state.current,
        mustAct: acting,
      }
    case 'moveRobber':
      return { text: fill(messages.moveRobber, { player }), player: state.current, mustAct: acting }
    case 'steal':
      return { text: fill(messages.steal, { player }), player: state.current, mustAct: acting }
    case 'discard': {
      const next = phase.discards.findIndex((n) => n > 0)
      const discardPlayer = human >= 0 && phase.discards[human] > 0 ? human : next
      return {
        text: fill(messages.discard, {
          player: playerSubject(state, discardPlayer),
          count: phase.discards[discardPlayer] ?? 0,
        }),
        player: state.current,
        mustAct: acting,
      }
    }
    case 'trade':
      return { text: fill(messages.main, { player }), player: state.current, mustAct: acting }
    case 'gameOver':
      if (phase.winner === human) return { text: messages.gameOverYou, player: state.current, mustAct: false }
      return {
        text: fill(messages.gameOver, { player: state.players[phase.winner].name }),
        player: state.current,
        mustAct: false,
      }
  }
}

/** The most recent board placement (for the BoardCanvas blink), or null. */
export function selectLastPlaced(state: GameState | null): { kind: 'vertex' | 'edge'; id: number } | null {
  if (!state) return null
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]
    if (e.type === 'built') return e.kind === 'road' ? { kind: 'edge', id: e.at } : { kind: 'vertex', id: e.at }
    if (e.type === 'setupSettlement') return { kind: 'vertex', id: e.vertex }
    if (e.type === 'setupRoad') return { kind: 'edge', id: e.edge }
  }
  return null
}
