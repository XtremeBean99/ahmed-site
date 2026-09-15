import { MIN_LONGEST_ROAD } from './constants'
import { EDGES, VERTICES } from './geometry'
import { pushEvent } from './helpers'
import type { GameState, PlayerId } from './types'

function otherVertex(edge: number, vertex: number): number {
  const [a, b] = EDGES[edge].vertices
  return a === vertex ? b : a
}

export function longestRoadFor(state: GameState, player: PlayerId): number {
  const used = new Array<boolean>(state.roads.length).fill(false)
  let best = 0

  const dfs = (edge: number, vertex: number, length: number) => {
    if (length > best) best = length
    const building = state.buildings[vertex]
    if (building !== null && building.owner !== player) return
    for (const next of VERTICES[vertex].edges) {
      if (used[next] || state.roads[next] !== player) continue
      used[next] = true
      dfs(next, otherVertex(next, vertex), length + 1)
      used[next] = false
    }
  }

  for (let edge = 0; edge < state.roads.length; edge++) {
    if (state.roads[edge] !== player) continue
    for (const vertex of EDGES[edge].vertices) {
      used[edge] = true
      dfs(edge, vertex, 1)
      used[edge] = false
    }
  }

  return best
}

function computeHolder(state: GameState): PlayerId | null {
  const lengths = state.players.map((p) => p.longestRoad)
  let max = 0
  for (const length of lengths) if (length > max) max = length

  const leaders: PlayerId[] = []
  lengths.forEach((length, player) => {
    if (length === max) leaders.push(player)
  })

  const holder = state.longestRoadHolder
  if (holder !== null && leaders.includes(holder)) {
    return max >= MIN_LONGEST_ROAD ? holder : null
  }
  if (leaders.length === 1 && max >= MIN_LONGEST_ROAD) return leaders[0]
  return null
}

export function updateLongestRoad(state: GameState): void {
  for (const player of state.players) {
    player.longestRoad = longestRoadFor(state, player.id)
  }
  const holder = computeHolder(state)
  if (holder !== state.longestRoadHolder) {
    state.longestRoadHolder = holder
    pushEvent(state, { type: 'longestRoad', player: holder })
  }
}
