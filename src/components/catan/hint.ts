import { chooseBotAction } from '@/lib/games/catan/ai'
import { pips } from '@/lib/games/catan/constants'
import { EDGES, VERTICES } from '@/lib/games/catan/geometry'
import { maritimeRate, totalCards } from '@/lib/games/catan/helpers'
import type { TutorialHighlight } from '@/lib/games/catan/tutorial'
import type { Action, GameState, PlayerId, Terrain } from '@/lib/games/catan/types'

export interface Hint {
  text: string
  highlight: TutorialHighlight
}

function terrainName(terrain: Terrain): string {
  return terrain === 'desert' ? 'Desert' : terrain[0].toUpperCase() + terrain.slice(1)
}

function describeTile(state: GameState, hex: number): string {
  const tile = state.tiles[hex]
  if (!tile || tile.terrain === 'desert') return 'the desert'
  return `${terrainName(tile.terrain)} ${tile.number}`
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function cornerDescription(state: GameState, vertex: number): string {
  return `the corner of ${joinNatural(VERTICES[vertex].hexes.map((hex) => describeTile(state, hex)))}`
}

function vertexPips(state: GameState, vertex: number): number {
  let total = 0
  for (const hex of VERTICES[vertex].hexes) {
    const tile = state.tiles[hex]
    if (!tile || tile.terrain === 'desert') continue
    if (hex === state.robber) continue
    total += pips(tile.number)
  }
  return total
}

function settlementHint(state: GameState, vertex: number, verb: string): string {
  return `${verb} on ${cornerDescription(state, vertex)}: it adds ${vertexPips(state, vertex)} pips of production`
}

function edgeDescription(state: GameState, edge: number): string {
  const hexes = EDGES[edge].hexes.map((hex) => describeTile(state, hex))
  return hexes.length === 1 ? `the coast edge next to ${hexes[0]}` : `the edge between ${hexes[0]} and ${hexes[1]}`
}

function describeDiscard(action: Extract<Action, { type: 'discard' }>): string {
  const count = totalCards(action.resources)
  return `Discard ${count} card${count === 1 ? '' : 's'}. Keep what you need for your next build.`
}

function describeMaritime(state: GameState, human: PlayerId, action: Extract<Action, { type: 'maritimeTrade' }>): string {
  const rate = maritimeRate(state, human, action.give)
  return `Trade ${rate} ${action.give} to the bank for 1 ${action.get}.`
}

function fallbackHint(state: GameState): Hint {
  switch (state.phase.kind) {
    case 'setup':
      return { text: 'Place a starting settlement on a strong corner.', highlight: { ui: ['board'] } }
    case 'preRoll':
      return { text: 'Roll the dice.', highlight: { ui: ['roll'] } }
    case 'discard':
      return { text: 'Discard cards to get down to 7.', highlight: { ui: ['hand'] } }
    case 'moveRobber':
      return { text: 'Move the robber to a hex that hurts the leader.', highlight: { ui: ['board'] } }
    case 'steal':
      return { text: 'Steal from the player with the most points.', highlight: { ui: ['players'] } }
    case 'main':
      return { text: 'Build, trade or buy a development card.', highlight: { ui: ['hand'] } }
    case 'roadBuilding':
      return { text: 'Place your free roads.', highlight: { ui: ['board'] } }
    case 'gameOver':
      return { text: 'The game is over.', highlight: {} }
  }
}

export function describeHintAction(state: GameState, human: PlayerId, action: Action): Hint {
  switch (action.type) {
    case 'placeSetupSettlement':
      return { text: `Place your starting settlement on ${cornerDescription(state, action.vertex)}: it adds ${vertexPips(state, action.vertex)} pips of production`, highlight: { vertices: [action.vertex], ui: ['board'] } }
    case 'placeSetupRoad':
      return { text: `Place your starting road on ${edgeDescription(state, action.edge)}.`, highlight: { edges: [action.edge], ui: ['board'] } }
    case 'rollDice':
      return { text: 'Roll the dice.', highlight: { ui: ['roll'] } }
    case 'discard':
      return { text: describeDiscard(action), highlight: { ui: ['hand'] } }
    case 'moveRobber':
      return { text: `Move the robber to ${describeTile(state, action.hex)}.`, highlight: { hexes: [action.hex], ui: ['board'] } }
    case 'steal':
      return { text: `Steal from ${state.players[action.victim]?.name ?? 'an opponent'}.`, highlight: { ui: ['players'] } }
    case 'buildRoad':
      return { text: `Build a road on ${edgeDescription(state, action.edge)}.`, highlight: { edges: [action.edge], ui: ['build-road'] } }
    case 'buildSettlement':
      return { text: settlementHint(state, action.vertex, 'Build a settlement'), highlight: { vertices: [action.vertex], ui: ['build-settlement'] } }
    case 'buildCity':
      return { text: `Upgrade to a city on ${cornerDescription(state, action.vertex)}.`, highlight: { vertices: [action.vertex], ui: ['build-city'] } }
    case 'buyDevCard':
      return { text: 'Buy a development card for 1 wool, 1 grain and 1 ore.', highlight: { ui: ['buy-card'] } }
    case 'playKnight':
      return { text: 'Play your Knight to move the robber and steal a card.', highlight: { ui: ['play-card'] } }
    case 'playRoadBuilding':
      return { text: 'Play Road Building and place two free roads.', highlight: { ui: ['play-card'] } }
    case 'playYearOfPlenty':
      return { text: 'Play Year of Plenty and take two resources from the bank.', highlight: { ui: ['play-card'] } }
    case 'playMonopoly':
      return { text: 'Play Monopoly and name a resource to take from every opponent.', highlight: { ui: ['play-card'] } }
    case 'maritimeTrade':
      return { text: describeMaritime(state, human, action), highlight: { ui: ['trade'] } }
    case 'domesticTrade':
      return { text: `Offer a trade to ${state.players[action.partner]?.name ?? 'an opponent'}.`, highlight: { ui: ['trade'] } }
    case 'endTurn':
      return { text: 'End your turn.', highlight: { ui: ['end-turn'] } }
  }
}

export function describeHint(state: GameState, human: PlayerId): Hint {
  if (human < 0 || human >= state.players.length) return { text: 'No hint available.', highlight: {} }
  try {
    return describeHintAction(state, human, chooseBotAction(state, human))
  } catch {
    return fallbackHint(state)
  }
}
