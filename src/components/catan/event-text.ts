import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { RESOURCES } from '@/lib/games/catan/constants'
import { humanPlayer } from '@/lib/games/catan/engine'
import { totalCards } from '@/lib/games/catan/helpers'
import type { GameEvent, GameState, PlayerId, ResourceCounts } from '@/lib/games/catan/types'

/** Tiny {placeholder} interpolation used by the log and status lines. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = vars[key]
    return value === undefined ? match : String(value)
  })
}

function formatResources(counts: ResourceCounts, t: Dictionary): string {
  const parts = RESOURCES.filter((r) => counts[r] > 0).map((r) => `${counts[r]} ${t.catan.resources[r]}`)
  return parts.length > 0 ? parts.join(', ') : 'nothing'
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

/** Robber log destination: "Grain 9" or "the desert". */
function robberDestination(state: GameState, hex: number, t: Dictionary): string {
  const tile = state.tiles[hex]
  if (!tile) return 'the desert'
  const terrain = t.catan.board.terrain[tile.terrain] ?? 'Desert'
  if (tile.number === null) return `the ${terrain.toLowerCase()}`
  return `${terrain} ${tile.number}`
}

/** Turns a GameEvent into a sentence. Hidden info stays hidden:
 *  a bought dev card's identity, and the resource in a bot-vs-bot steal, are never shown. */
export function formatEvent(state: GameState, event: GameEvent, t: Dictionary): string {
  const log = t.catan.log
  const player = 'player' in event ? playerSubject(state, event.player) : ''

  switch (event.type) {
    case 'setupSettlement':
      return fill(log.setupSettlement, { player })
    case 'setupRoad':
      return fill(log.setupRoad, { player })
    case 'setupResources':
      return fill(log.setupResources, { player, resources: formatResources(event.resources, t) })
    case 'roll':
      return fill(log.roll, { player, dice: event.dice[0] + event.dice[1] })
    case 'produce':
      return event.gains
        .flatMap((gains, p) =>
          totalCards(gains) > 0
            ? [fill(log.produce, { player: playerSubject(state, p), resources: formatResources(gains, t) })]
            : [],
        )
        .join(', ')
    case 'discard':
      return fill(log.discard, { player, resources: formatResources(event.resources, t) })
    case 'robberMoved':
      return fill(log.robberMoved, { player, terrain: robberDestination(state, event.hex, t) })
    case 'stole': {
      if (event.resource !== null && (event.player === humanPlayer(state) || event.victim === humanPlayer(state))) {
        return fill(log.stoleResource, {
          player,
          victim: playerObject(state, event.victim),
          resource: t.catan.resources[event.resource],
        })
      }
      return fill(log.stole, { player, victim: playerObject(state, event.victim) })
    }
    case 'built':
      if (event.kind === 'road') return fill(log.builtRoad, { player })
      if (event.kind === 'settlement') return fill(log.builtSettlement, { player })
      return fill(log.builtCity, { player })
    case 'boughtDevCard':
      return fill(log.boughtDevCard, { player })
    case 'playedDevCard':
      if (event.card === 'knight') return fill(log.playedKnight, { player })
      if (event.card === 'roadBuilding') return fill(log.playedRoadBuilding, { player })
      if (event.card === 'yearOfPlenty') return fill(log.playedYearOfPlenty, { player })
      return fill(log.playedMonopoly, { player })
    case 'yearOfPlenty': {
      const resources = event.resources.map((r) => t.catan.resources[r]).join(', ')
      return fill(log.yearOfPlenty, { player, resources })
    }
    case 'monopoly':
      return fill(log.monopoly, {
        player,
        resource: t.catan.resources[event.resource],
        taken: event.taken,
      })
    case 'maritimeTrade':
      return fill(log.maritimeTrade, {
        player,
        giveCount: event.giveCount,
        give: t.catan.resources[event.give],
        get: t.catan.resources[event.get],
      })
    case 'domesticTrade':
      return fill(log.domesticTrade, { player, partner: playerObject(state, event.partner) })
    case 'longestRoad':
      if (event.player === null) return log.longestRoadLost
      return fill(log.longestRoad, { player: playerSubject(state, event.player) })
    case 'largestArmy':
      return fill(log.largestArmy, { player: playerSubject(state, event.player) })
    case 'turnEnded':
      return fill(log.turnEnded, { possessive: playerPossessive(state, event.player) })
    case 'gameOver':
      return fill(log.gameOver, { player: playerSubject(state, event.winner) })
  }
}
