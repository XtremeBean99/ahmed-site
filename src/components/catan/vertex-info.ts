import { pips } from '@/lib/games/catan/constants'
import { EDGES, VERTICES } from '@/lib/games/catan/geometry'
import type { GameState, Terrain } from '@/lib/games/catan/types'

export interface VertexInfoMessages {
  pips: string
  harbourAny: string
  harbourResource: string
  robberSuffix: string
  terrain: Record<Terrain, string>
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key]
    return value === undefined ? match : String(value)
  })
}

/** Human-readable yield for a vertex: pip total, per-hex breakdown, and harbour when present. */
export function vertexDescription(state: GameState, vertex: number, messages: VertexInfoMessages): string {
  let total = 0
  const parts: string[] = []
  for (const hex of VERTICES[vertex].hexes) {
    const tile = state.tiles[hex]
    const terrain = messages.terrain[tile.terrain]
    const blocked = hex === state.robber
    if (tile.terrain !== 'desert' && !blocked) total += pips(tile.number)
    let label = tile.terrain === 'desert' ? terrain : `${terrain} ${tile.number}`
    if (blocked) label += ` ${messages.robberSuffix}`
    parts.push(label)
  }

  let text = fill(messages.pips, { pips: total, hexes: parts.join(', ') })
  const port = state.ports.find((p) => EDGES[p.edge].vertices.includes(vertex))
  if (port) {
    text += port.type === 'any' ? `, ${messages.harbourAny}` : `, ${fill(messages.harbourResource, { resource: messages.terrain[port.type] })}`
  }
  return text
}
