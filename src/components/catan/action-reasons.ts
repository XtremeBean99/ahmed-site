import { COSTS, RESOURCES } from '@/lib/games/catan/constants'
import { emptyResources, hasResources, legalCities, legalRoads, legalSettlements } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'

export type BuildActionKind = 'road' | 'settlement' | 'city' | 'devCard'

export type ActionBlockReason =
  | { kind: 'resources'; missing: ResourceCounts }
  | { kind: 'noSpot' }
  | { kind: 'noPieces' }
  | { kind: 'deckEmpty' }
  | { kind: 'rollFirst' }

export interface ActionReasonMessages {
  needResources: string
  noSpot: string
  noPieces: string
  deckEmpty: string
  rollFirst: string
  resourceNames: Record<Resource, string>
}

function missingFor(hand: ResourceCounts, cost: ResourceCounts): ResourceCounts {
  const missing = emptyResources()
  for (const r of RESOURCES) missing[r] = Math.max(0, cost[r] - hand[r])
  return missing
}

function resourcesReason(hand: ResourceCounts, cost: ResourceCounts): ActionBlockReason | null {
  return hasResources(hand, cost) ? null : { kind: 'resources', missing: missingFor(hand, cost) }
}

/** Why a build/dev action is unavailable, or null when the player may take it. */
export function actionBlockReason(
  state: GameState,
  player: PlayerId,
  action: BuildActionKind,
): ActionBlockReason | null {
  if (state.phase.kind !== 'main') return { kind: 'rollFirst' }
  const hand = state.players[player].resources
  switch (action) {
    case 'road': {
      const resources = resourcesReason(hand, COSTS.road)
      if (resources) return resources
      if (state.players[player].roadsLeft === 0) return { kind: 'noPieces' }
      if (legalRoads(state, player).length === 0) return { kind: 'noSpot' }
      return null
    }
    case 'settlement': {
      const resources = resourcesReason(hand, COSTS.settlement)
      if (resources) return resources
      if (state.players[player].settlementsLeft === 0) return { kind: 'noPieces' }
      if (legalSettlements(state, player).length === 0) return { kind: 'noSpot' }
      return null
    }
    case 'city': {
      const resources = resourcesReason(hand, COSTS.city)
      if (resources) return resources
      if (state.players[player].citiesLeft === 0) return { kind: 'noPieces' }
      if (legalCities(state, player).length === 0) return { kind: 'noSpot' }
      return null
    }
    case 'devCard': {
      const resources = resourcesReason(hand, COSTS.devCard)
      if (resources) return resources
      if (state.devDeck.length === 0) return { kind: 'deckEmpty' }
      return null
    }
  }
}

export function formatActionBlockReason(reason: ActionBlockReason, messages: ActionReasonMessages): string {
  switch (reason.kind) {
    case 'resources': {
      const parts = RESOURCES.filter((r) => reason.missing[r] > 0).map(
        (r) => `${reason.missing[r]} ${messages.resourceNames[r]}`,
      )
      return messages.needResources.replace('{resources}', parts.join(', '))
    }
    case 'noSpot':
      return messages.noSpot
    case 'noPieces':
      return messages.noPieces
    case 'deckEmpty':
      return messages.deckEmpty
    case 'rollFirst':
      return messages.rollFirst
  }
}
