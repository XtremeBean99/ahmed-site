import { COSTS, RESOURCES } from './constants'
import { HEXES } from './geometry'
import {
  canPlaceRoad,
  canPlaceSettlement,
  emptyResources,
  hasResources,
  isEdgeId,
  isPlayerId,
  isResource,
  isResourceCounts,
  isVertexId,
  legalRoads,
  maritimeRate,
  payFromBank,
  payToBank,
  pushEvent,
  totalCards,
} from './helpers'
import { nextInt } from './rng'
import { startSevenResolution } from './robber'
import type { GameState, Handler, HandlerMap } from './types'

export function produceResources(state: GameState, roll: number): void {
  const owed = state.players.map(() => emptyResources())
  for (const hex of HEXES) {
    const tile = state.tiles[hex.id]
    if (tile.number !== roll || tile.terrain === 'desert' || hex.id === state.robber) continue
    for (const v of hex.vertices) {
      const building = state.buildings[v]
      if (!building) continue
      owed[building.owner][tile.terrain] += building.kind === 'city' ? 2 : 1
    }
  }
  const gains = state.players.map(() => emptyResources())
  for (const r of RESOURCES) {
    const owedTotal = owed.reduce((sum, o) => sum + o[r], 0)
    if (owedTotal === 0) continue
    if (state.bank[r] >= owedTotal) {
      for (let p = 0; p < state.players.length; p++) {
        if (owed[p][r] > 0) {
          state.bank[r] -= owed[p][r]
          state.players[p].resources[r] += owed[p][r]
          gains[p][r] += owed[p][r]
        }
      }
    } else {
      const recipients = owed.flatMap((o, p) => (o[r] > 0 ? [p] : []))
      if (recipients.length === 1) {
        const p = recipients[0]
        gains[p][r] += state.bank[r]
        state.players[p].resources[r] += state.bank[r]
        state.bank[r] = 0
      }
    }
  }
  if (gains.some((g) => totalCards(g) > 0)) pushEvent(state, { type: 'produce', gains })
}

function inMain(state: GameState): string | null {
  return state.phase.kind === 'main' ? null : 'Only during the main phase'
}

const rollDice: Handler<'rollDice'> = {
  validate(state) {
    return state.phase.kind === 'preRoll' ? null : 'Roll only before the main phase'
  },
  apply(state) {
    const dice: [number, number] = [nextInt(state, 6) + 1, nextInt(state, 6) + 1]
    state.dice = dice
    pushEvent(state, { type: 'roll', player: state.current, dice })
    if (dice[0] + dice[1] === 7) {
      startSevenResolution(state)
    } else {
      produceResources(state, dice[0] + dice[1])
      state.phase = { kind: 'main' }
    }
  },
}

const buildRoad: Handler<'buildRoad'> = {
  validate(state, action) {
    if (!isEdgeId(action.edge)) return 'Invalid edge'
    if (state.phase.kind !== 'main' && state.phase.kind !== 'roadBuilding') return 'Roads can only be built in main or roadBuilding'
    if (state.phase.kind === 'roadBuilding' && state.phase.remaining <= 0) return 'No road building left'
    const player = state.players[state.current]
    if (player.roadsLeft === 0) return 'No roads left'
    if (!canPlaceRoad(state, state.current, action.edge)) return 'Road cannot be placed there'
    if (state.phase.kind === 'main' && !hasResources(player.resources, COSTS.road)) return 'Not enough resources'
    return null
  },
  apply(state, action) {
    if (state.phase.kind === 'main') payToBank(state, state.current, COSTS.road)
    state.roads[action.edge] = state.current
    state.players[state.current].roadsLeft -= 1
    pushEvent(state, { type: 'built', player: state.current, kind: 'road', at: action.edge })
    if (state.phase.kind === 'roadBuilding') {
      const returnTo = state.phase.returnTo
      state.phase.remaining -= 1
      if (state.phase.remaining === 0 || legalRoads(state, state.current).length === 0) {
        state.phase = { kind: returnTo }
      }
    }
  },
}

const buildSettlement: Handler<'buildSettlement'> = {
  validate(state, action) {
    if (!isVertexId(action.vertex)) return 'Invalid vertex'
    const phaseReason = inMain(state)
    if (phaseReason) return phaseReason
    const player = state.players[state.current]
    if (player.settlementsLeft === 0) return 'No settlements left'
    if (!canPlaceSettlement(state, state.current, action.vertex)) return 'Settlement cannot be placed there'
    if (!hasResources(player.resources, COSTS.settlement)) return 'Not enough resources'
    return null
  },
  apply(state, action) {
    payToBank(state, state.current, COSTS.settlement)
    state.buildings[action.vertex] = { owner: state.current, kind: 'settlement' }
    state.players[state.current].settlementsLeft -= 1
    pushEvent(state, { type: 'built', player: state.current, kind: 'settlement', at: action.vertex })
  },
}

const buildCity: Handler<'buildCity'> = {
  validate(state, action) {
    if (!isVertexId(action.vertex)) return 'Invalid vertex'
    const phaseReason = inMain(state)
    if (phaseReason) return phaseReason
    const player = state.players[state.current]
    if (player.citiesLeft === 0) return 'No cities left'
    const building = state.buildings[action.vertex]
    if (!building || building.owner !== state.current || building.kind !== 'settlement') return 'No settlement to upgrade there'
    if (!hasResources(player.resources, COSTS.city)) return 'Not enough resources'
    return null
  },
  apply(state, action) {
    payToBank(state, state.current, COSTS.city)
    state.buildings[action.vertex] = { owner: state.current, kind: 'city' }
    state.players[state.current].citiesLeft -= 1
    state.players[state.current].settlementsLeft += 1
    pushEvent(state, { type: 'built', player: state.current, kind: 'city', at: action.vertex })
  },
}

const buyDevCard: Handler<'buyDevCard'> = {
  validate(state) {
    const phaseReason = inMain(state)
    if (phaseReason) return phaseReason
    if (state.devDeck.length === 0) return 'No development cards left'
    if (!hasResources(state.players[state.current].resources, COSTS.devCard)) return 'Not enough resources'
    return null
  },
  apply(state) {
    payToBank(state, state.current, COSTS.devCard)
    const card = state.devDeck.pop()!
    state.players[state.current].newDevCards.push(card)
    pushEvent(state, { type: 'boughtDevCard', player: state.current })
  },
}

const maritimeTrade: Handler<'maritimeTrade'> = {
  validate(state, action) {
    const phaseReason = inMain(state)
    if (phaseReason) return phaseReason
    if (!isResource(action.give) || !isResource(action.get)) return 'Invalid resource'
    if (action.give === action.get) return 'Give and get must differ'
    const rate = maritimeRate(state, state.current, action.give)
    if (state.players[state.current].resources[action.give] < rate) return 'Not enough resources'
    if (state.bank[action.get] === 0) return 'The bank is out of that resource'
    return null
  },
  apply(state, action) {
    const rate = maritimeRate(state, state.current, action.give)
    const give = emptyResources()
    give[action.give] = rate
    payToBank(state, state.current, give)
    const get = emptyResources()
    get[action.get] = 1
    payFromBank(state, state.current, get)
    pushEvent(state, { type: 'maritimeTrade', player: state.current, give: action.give, giveCount: rate, get: action.get })
  },
}

const domesticTrade: Handler<'domesticTrade'> = {
  validate(state, action) {
    const phaseReason = inMain(state)
    if (phaseReason) return phaseReason
    if (!isPlayerId(state, action.partner)) return 'Invalid partner'
    if (action.partner === state.current) return 'Cannot trade with yourself'
    if (!isResourceCounts(action.give) || !isResourceCounts(action.get)) return 'Invalid trade counts'
    if (totalCards(action.give) === 0 || totalCards(action.get) === 0) return 'Both sides must give at least one card'
    if (RESOURCES.some((r) => action.give[r] > 0 && action.get[r] > 0)) return 'No resource may appear on both sides'
    if (!hasResources(state.players[state.current].resources, action.give)) return 'You do not have the cards to give'
    if (!hasResources(state.players[action.partner].resources, action.get)) return 'Partner does not have the cards to give'
    return null
  },
  apply(state, action) {
    const current = state.players[state.current]
    const partner = state.players[action.partner]
    const give = { ...action.give }
    const get = { ...action.get }
    for (const r of RESOURCES) {
      current.resources[r] -= give[r]
      partner.resources[r] += give[r]
      partner.resources[r] -= get[r]
      current.resources[r] += get[r]
    }
    pushEvent(state, { type: 'domesticTrade', player: state.current, partner: action.partner, give, get })
  },
}

const endTurn: Handler<'endTurn'> = {
  validate(state) {
    return state.phase.kind === 'main' ? null : 'End turn only during the main phase'
  },
  apply(state) {
    const player = state.players[state.current]
    player.devCards.push(...player.newDevCards)
    player.newDevCards = []
    state.devCardPlayedThisTurn = false
    state.dice = null
    pushEvent(state, { type: 'turnEnded', player: state.current })
    state.current = (state.current + 1) % state.players.length
    state.turn += 1
    state.phase = { kind: 'preRoll' }
  },
}

export const turnHandlers: HandlerMap<
  'rollDice' | 'buildRoad' | 'buildSettlement' | 'buildCity' | 'buyDevCard' | 'maritimeTrade' | 'domesticTrade' | 'endTurn'
> = {
  rollDice,
  buildRoad,
  buildSettlement,
  buildCity,
  buyDevCard,
  maritimeTrade,
  domesticTrade,
  endTurn,
}
