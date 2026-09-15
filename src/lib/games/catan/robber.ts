import { DISCARD_THRESHOLD, RESOURCES } from './constants'
import {
  hasResources,
  isHexId,
  isPlayerId,
  isResourceCounts,
  payToBank,
  pushEvent,
  robberVictims,
  totalCards,
} from './helpers'
import { nextInt } from './rng'
import type { GameState, HandlerMap, PlayerId, Resource } from './types'

export function startSevenResolution(state: GameState): void {
  const discards = state.players.map((p) => {
    const total = totalCards(p.resources)
    return total > DISCARD_THRESHOLD ? Math.floor(total / 2) : 0
  })
  state.phase = discards.some((n) => n > 0)
    ? { kind: 'discard', discards }
    : { kind: 'moveRobber', returnTo: 'main' }
}

function stealFrom(state: GameState, victim: PlayerId, player: PlayerId): void {
  const hand = state.players[victim].resources
  const total = totalCards(hand)
  if (total > 0) {
    let index = nextInt(state, total)
    let resource: Resource = RESOURCES[0]
    for (const r of RESOURCES) {
      if (index < hand[r]) {
        resource = r
        break
      }
      index -= hand[r]
    }
    hand[resource] -= 1
    state.players[player].resources[resource] += 1
    pushEvent(state, { type: 'stole', player, victim, resource })
    return
  }
  pushEvent(state, { type: 'stole', player, victim, resource: null })
}

export const robberHandlers: HandlerMap<'discard' | 'moveRobber' | 'steal'> = {
  discard: {
    validate(state, action) {
      if (state.phase.kind !== 'discard') return 'No discard is pending'
      if (!isPlayerId(state, action.player)) return 'Invalid player'
      const owed = state.phase.discards[action.player]
      if (owed === 0) return 'No cards to discard'
      if (!isResourceCounts(action.resources)) return 'Invalid resources'
      if (totalCards(action.resources) !== owed) return `Must discard exactly ${owed} cards`
      if (!hasResources(state.players[action.player].resources, action.resources)) return 'Cannot discard cards you do not have'
      return null
    },
    apply(state, action) {
      if (state.phase.kind !== 'discard') return
      payToBank(state, action.player, action.resources)
      state.phase.discards[action.player] = 0
      pushEvent(state, { type: 'discard', player: action.player, resources: { ...action.resources } })
      if (state.phase.discards.every((n) => n === 0)) {
        state.phase = { kind: 'moveRobber', returnTo: 'main' }
      }
    },
  },
  moveRobber: {
    validate(state, action) {
      if (state.phase.kind !== 'moveRobber') return 'No robber move is pending'
      if (!isHexId(action.hex)) return 'Invalid hex'
      if (action.hex === state.robber) return 'Must move the robber to a different hex'
      return null
    },
    apply(state, action) {
      if (state.phase.kind !== 'moveRobber') return
      state.robber = action.hex
      pushEvent(state, { type: 'robberMoved', player: state.current, hex: action.hex })
      const returnTo = state.phase.returnTo
      const victims = robberVictims(state, action.hex, state.current)
      if (victims.length === 0) {
        state.phase = { kind: returnTo }
      } else if (victims.length === 1) {
        stealFrom(state, victims[0], state.current)
        state.phase = { kind: returnTo }
      } else {
        state.phase = { kind: 'steal', candidates: victims, returnTo }
      }
    },
  },
  steal: {
    validate(state, action) {
      if (state.phase.kind !== 'steal') return 'No steal is pending'
      if (!state.phase.candidates.includes(action.victim)) return 'Invalid victim'
      return null
    },
    apply(state, action) {
      if (state.phase.kind !== 'steal') return
      const returnTo = state.phase.returnTo
      stealFrom(state, action.victim, state.current)
      state.phase = { kind: returnTo }
    },
  },
}
