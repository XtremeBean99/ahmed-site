import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { RESOURCES } from '@/lib/games/catan/constants'
import { humanPlayer } from '@/lib/games/catan/engine'
import { totalCards } from '@/lib/games/catan/helpers'
import type { GameEvent, GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'

/** Tiny {placeholder} interpolation used by the log and status lines. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key]
    return value === undefined ? match : String(value)
  })
}

export type EventSegmentKind = 'player' | 'dice' | 'resource' | 'count' | 'card' | 'robber' | 'vp' | 'plain'

export interface EventSegment {
  text: string
  kind: EventSegmentKind
  player?: PlayerId
  resource?: Resource
  value?: number
}

function seg(text: string, kind: EventSegmentKind = 'plain'): EventSegment {
  return { text, kind }
}

function isHuman(state: GameState, player: PlayerId): boolean {
  return player === humanPlayer(state)
}

/** Subject form: "You" for the human, the player's name for bots. */
export function playerSubject(state: GameState, player: PlayerId | null): string {
  if (player === null) return ''
  return isHuman(state, player) ? 'You' : (state.players[player]?.name ?? '?')
}

/** Object form: "you" for the human, the player's name for bots. */
export function playerObject(state: GameState, player: PlayerId | null): string {
  if (player === null) return ''
  return isHuman(state, player) ? 'you' : (state.players[player]?.name ?? '?')
}

/** Possessive form: "Your" for the human, "Name's" for bots. */
export function playerPossessive(state: GameState, player: PlayerId | null): string {
  if (player === null) return ''
  return isHuman(state, player) ? 'Your' : `${state.players[player]?.name ?? '?'}'s`
}

function playerSeg(state: GameState, player: PlayerId | null): EventSegment {
  return { kind: 'player', text: playerSubject(state, player), player: player ?? undefined }
}

function playerObjectSeg(state: GameState, player: PlayerId | null): EventSegment {
  return { kind: 'player', text: playerObject(state, player), player: player ?? undefined }
}

function resourceSeg(t: Dictionary, resource: Resource): EventSegment {
  return { kind: 'resource', text: t.catan.resources[resource], resource }
}

/** "2 brick, 1 lumber": count segments bold, resource segments with icons. */
function formatResourceSegments(counts: ResourceCounts, t: Dictionary): EventSegment[] {
  const parts: EventSegment[] = []
  RESOURCES.filter((r) => counts[r] > 0).forEach((r, index) => {
    if (index > 0) parts.push(seg(', '))
    parts.push({ kind: 'count', text: String(counts[r]), value: counts[r] })
    parts.push(seg(' '))
    parts.push(resourceSeg(t, r))
  })
  return parts.length > 0 ? parts : [seg('nothing')]
}

/** "brick, lumber": resource names only. */
function formatResourceNames(resources: readonly Resource[], t: Dictionary): EventSegment[] {
  return resources.flatMap((r, index) => {
    const parts: EventSegment[] = []
    if (index > 0) parts.push(seg(', '))
    parts.push(resourceSeg(t, r))
    return parts
  })
}

/** Robber log destination: "Grain 9" or "the desert". */
function robberDestination(state: GameState, hex: number, t: Dictionary): string {
  const tile = state.tiles[hex]
  if (!tile) return 'the desert'
  const terrain = t.catan.board.terrain[tile.terrain] ?? 'Desert'
  if (tile.number === null) return `the ${terrain.toLowerCase()}`
  return `${terrain} ${tile.number}`
}

/** Interpolate {placeholders} with segment arrays, tagging literal runs with `literalKind`. */
function compose(
  template: string,
  values: Record<string, EventSegment[]>,
  literalKind: EventSegmentKind = 'plain',
): EventSegment[] {
  const out: EventSegment[] = []
  let last = 0
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const index = match.index ?? 0
    if (index > last) out.push(seg(template.slice(last, index), literalKind))
    out.push(...(values[match[1]] ?? [seg(match[0])]))
    last = index + match[0].length
  }
  if (last < template.length) out.push(seg(template.slice(last), literalKind))
  return out
}

/** Turns a GameEvent into styled segments. Hidden info stays hidden:
 *  a bought dev card's identity, and the resource in a bot-vs-bot steal, are never shown. */
export function formatEvent(state: GameState, event: GameEvent, t: Dictionary): EventSegment[] {
  const log = t.catan.log

  switch (event.type) {
    case 'setupSettlement':
      return compose(log.setupSettlement, { player: [playerSeg(state, event.player)] })
    case 'setupRoad':
      return compose(log.setupRoad, { player: [playerSeg(state, event.player)] })
    case 'setupResources':
      return compose(log.setupResources, {
        player: [playerSeg(state, event.player)],
        resources: formatResourceSegments(event.resources, t),
      })
    case 'roll':
      return compose(log.roll, {
        player: [playerSeg(state, event.player)],
        dice: [{ kind: 'dice', text: String(event.dice[0] + event.dice[1]), value: event.dice[0] + event.dice[1] }],
      })
    case 'produce': {
      const parts: EventSegment[] = []
      event.gains.forEach((gains, p) => {
        if (totalCards(gains) === 0) return
        if (parts.length > 0) parts.push(seg(', '))
        parts.push(
          ...compose(log.produce, {
            player: [playerSeg(state, p)],
            resources: formatResourceSegments(gains, t),
          }),
        )
      })
      return parts
    }
    case 'discard':
      return compose(log.discard, {
        player: [playerSeg(state, event.player)],
        resources: formatResourceSegments(event.resources, t),
      })
    case 'robberMoved':
      return compose(log.robberMoved, {
        player: [playerSeg(state, event.player)],
        robber: [{ kind: 'robber', text: log.robber }],
        terrain: [seg(robberDestination(state, event.hex, t))],
      })
    case 'stole': {
      if (event.resource !== null && (event.player === humanPlayer(state) || event.victim === humanPlayer(state))) {
        return compose(log.stoleResource, {
          player: [playerSeg(state, event.player)],
          victim: [playerObjectSeg(state, event.victim)],
          resource: [resourceSeg(t, event.resource)],
        })
      }
      return compose(log.stole, {
        player: [playerSeg(state, event.player)],
        victim: [playerObjectSeg(state, event.victim)],
      })
    }
    case 'built':
      if (event.kind === 'road') return compose(log.builtRoad, { player: [playerSeg(state, event.player)] })
      if (event.kind === 'settlement') return compose(log.builtSettlement, { player: [playerSeg(state, event.player)] })
      return compose(log.builtCity, { player: [playerSeg(state, event.player)] })
    case 'boughtDevCard':
      return compose(log.boughtDevCard, { player: [playerSeg(state, event.player)] })
    case 'playedDevCard':
      if (event.card === 'knight') {
        return compose(log.playedKnight, { player: [playerSeg(state, event.player)], card: [seg('knight', 'card')] })
      }
      if (event.card === 'roadBuilding') {
        return compose(log.playedRoadBuilding, {
          player: [playerSeg(state, event.player)],
          card: [seg('Road Building', 'card')],
        })
      }
      if (event.card === 'yearOfPlenty') {
        return compose(log.playedYearOfPlenty, {
          player: [playerSeg(state, event.player)],
          card: [seg('Year of Plenty', 'card')],
        })
      }
      return compose(log.playedMonopoly, {
        player: [playerSeg(state, event.player)],
        card: [seg('Monopoly', 'card')],
      })
    case 'yearOfPlenty':
      return compose(log.yearOfPlenty, {
        player: [playerSeg(state, event.player)],
        resources: formatResourceNames(event.resources, t),
      })
    case 'monopoly':
      return compose(log.monopoly, {
        player: [playerSeg(state, event.player)],
        resource: [resourceSeg(t, event.resource)],
        taken: [{ kind: 'count', text: String(event.taken), value: event.taken }],
      })
    case 'maritimeTrade':
      return compose(log.maritimeTrade, {
        player: [playerSeg(state, event.player)],
        giveCount: [{ kind: 'count', text: String(event.giveCount), value: event.giveCount }],
        give: [resourceSeg(t, event.give)],
        get: [resourceSeg(t, event.get)],
      })
    case 'domesticTrade':
      return compose(log.domesticTrade, {
        player: [playerSeg(state, event.player)],
        partner: [playerObjectSeg(state, event.partner)],
      })
    case 'tradeProposed':
      return compose(log.tradeProposed, {
        player: [playerSeg(state, event.player)],
        give: formatResourceSegments(event.give, t),
        get: formatResourceSegments(event.get, t),
      })
    case 'tradeReplied':
      if (event.reply === 'counter' && event.counter) {
        // counter terms are from the proposer's side, so the replier gives `get` and asks for `give`
        return compose(log.tradeCountered, {
          player: [playerSeg(state, event.player)],
          give: formatResourceSegments(event.counter.get, t),
          get: formatResourceSegments(event.counter.give, t),
        })
      }
      return compose(event.reply === 'accept' ? log.tradeAccepted : log.tradeDeclined, {
        player: [playerSeg(state, event.player)],
      })
    case 'tradeCancelled':
      return compose(log.tradeCancelled, { player: [playerSeg(state, event.player)] })
    case 'longestRoad':
      if (event.player === null) return [{ kind: 'vp', text: log.longestRoadLost }]
      return [playerSeg(state, event.player), seg(' took '), { kind: 'vp', text: log.longestRoadName }]
    case 'largestArmy':
      return [playerSeg(state, event.player), seg(' took '), { kind: 'vp', text: log.largestArmyName }]
    case 'turnEnded':
      return compose(log.turnEnded, { possessive: [seg(playerPossessive(state, event.player))] })
    case 'gameOver':
      return compose(log.gameOver, { player: [playerSeg(state, event.winner)] }, 'vp')
  }
}

/** Plain-text form of formatEvent, for tests and aria labels. */
export function formatEventText(state: GameState, event: GameEvent, t: Dictionary): string {
  return formatEvent(state, event, t)
    .map((segment) => segment.text)
    .join('')
}
