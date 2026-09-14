import { VERTICES } from './geometry'
import { emptyResources, isEdgeId, isVertexId, payFromBank, pushEvent, satisfiesDistanceRule, setupOrder } from './helpers'
import type { HandlerMap, ResourceCounts } from './types'

export const setupHandlers: HandlerMap<'placeSetupSettlement' | 'placeSetupRoad'> = {
  placeSetupSettlement: {
    validate(state, action) {
      if (state.phase.kind !== 'setup' || state.phase.step !== 'settlement') {
        return 'Settlements are placed only during the setup settlement step'
      }
      if (!isVertexId(action.vertex)) return 'Invalid vertex'
      if (state.players[state.current].settlementsLeft < 1) return 'No settlements left'
      if (!satisfiesDistanceRule(state, action.vertex)) return 'Settlement violates the distance rule'
      return null
    },
    apply(state, action) {
      if (state.phase.kind !== 'setup') return
      const player = state.current
      state.buildings[action.vertex] = { owner: player, kind: 'settlement' }
      state.players[player].settlementsLeft -= 1
      const round = state.phase.round
      state.phase = { kind: 'setup', round, step: 'road', lastSettlement: action.vertex }
      pushEvent(state, { type: 'setupSettlement', player, vertex: action.vertex })
      if (round === 2) {
        const resources: ResourceCounts = emptyResources()
        for (const hex of VERTICES[action.vertex].hexes) {
          const terrain = state.tiles[hex].terrain
          if (terrain !== 'desert') resources[terrain] += 1
        }
        payFromBank(state, player, resources)
        pushEvent(state, { type: 'setupResources', player, resources })
      }
    },
  },
  placeSetupRoad: {
    validate(state, action) {
      if (state.phase.kind !== 'setup' || state.phase.step !== 'road') {
        return 'Roads are placed only during the setup road step'
      }
      if (!isEdgeId(action.edge)) return 'Invalid edge'
      if (state.players[state.current].roadsLeft < 1) return 'No roads left'
      if (state.roads[action.edge] !== null) return 'That road spot is already taken'
      if (state.phase.lastSettlement === null || !VERTICES[state.phase.lastSettlement].edges.includes(action.edge)) {
        return 'The road must touch the settlement just placed'
      }
      return null
    },
    apply(state, action) {
      if (state.phase.kind !== 'setup') return
      const player = state.current
      state.roads[action.edge] = player
      state.players[player].roadsLeft -= 1
      pushEvent(state, { type: 'setupRoad', player, edge: action.edge })

      const n = state.players.length
      const round = state.phase.round
      const order = setupOrder(n, round)
      const index = order.indexOf(state.current)
      if (index < order.length - 1) {
        state.current = order[index + 1]
        state.phase = { kind: 'setup', round, step: 'settlement', lastSettlement: null }
      } else if (round === 1) {
        state.current = setupOrder(n, 2)[0]
        state.phase = { kind: 'setup', round: 2, step: 'settlement', lastSettlement: null }
      } else {
        state.phase = { kind: 'preRoll' }
        state.current = 0
        state.turn = 1
      }
    },
  },
}
