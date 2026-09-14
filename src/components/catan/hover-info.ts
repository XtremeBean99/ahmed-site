import { pips } from '@/lib/games/catan/constants'
import { EDGES } from '@/lib/games/catan/geometry'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { GameState } from '@/lib/games/catan/types'
import { fill, playerPossessive } from './event-text'

/** Mirrors the HoverTarget union produced by board-hover.ts so this module stays independent of it. */
export type HoverTarget =
  | { kind: 'hex'; hex: number }
  | { kind: 'robber'; hex: number }
  | { kind: 'harbor'; port: number }
  | { kind: 'building'; vertex: number }
  | { kind: 'road'; edge: number }

function oddsFraction(total: number): string {
  return `${pips(total)}/36`
}

/** Helpful hover text for a board target, or null when there is nothing to say. */
export function describeHover(state: GameState, target: HoverTarget, t: Dictionary): string | null {
  const h = t.catan.hover
  const terrain = t.catan.board.terrain

  switch (target.kind) {
    case 'hex': {
      const tile = state.tiles[target.hex]
      if (!tile) return null
      if (tile.terrain === 'desert') {
        return `${h.desert}${state.robber === target.hex ? ` ${h.robberPresent}` : ''}`
      }
      const text = fill(h.hex, {
        terrain: terrain[tile.terrain],
        number: tile.number ?? 0,
        odds: oddsFraction(tile.number ?? 0),
        resource: t.catan.resources[tile.terrain],
      })
      return state.robber === target.hex ? `${text} ${h.robberPresent}` : text
    }
    case 'robber':
      return h.robber
    case 'harbor': {
      const port = state.ports[target.port]
      if (!port) return null
      if (port.type === 'any') return h.harborAny
      return fill(h.harborResource, { resource: t.catan.resources[port.type] })
    }
    case 'building': {
      const building = state.buildings[target.vertex]
      if (!building) return null
      const kind = building.kind === 'city' ? h.city : h.settlement
      return fill(h.building, {
        possessive: playerPossessive(state, building.owner),
        kind,
        vp: building.kind === 'city' ? 2 : 1,
      })
    }
    case 'road': {
      const owner = state.roads[target.edge]
      if (owner === null) return null
      const edge = EDGES[target.edge]
      if (!edge) return null
      return fill(h.road, {
        possessive: playerPossessive(state, owner),
        length: state.players[owner].longestRoad,
      })
    }
  }
}
