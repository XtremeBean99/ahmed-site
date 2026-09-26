import type { DevCardType, GameEvent, GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'
import { totalCards } from '@/lib/games/catan/helpers'
import { en } from '@/lib/i18n/dictionaries/en'
import { fill } from '../event-text'

export type BuildKind = 'road' | 'settlement' | 'city'
export type AwardKind = 'longestRoad' | 'largestArmy'
export type TradeReplyKind = 'accepted' | 'declined'

export interface DiceEffect {
  kind: 'dice'
  dice: [number, number]
  roller: PlayerId
}

export interface ProduceEffect {
  kind: 'produce'
  total: number
  hexes: number[]
  gains: ResourceCounts[]
  blocked: ResourceCounts[]
  blockedHex: number | null
  shortage: Resource[]
}

export interface RobberEffect {
  kind: 'robber'
  from: number
  to: number
}

export interface StealEffect {
  kind: 'steal'
  thief: PlayerId
  victim: PlayerId
  /** The stolen resource, only when the human is the thief or the victim. */
  resource: Resource | null
  hidden: boolean
}

export interface BuildEffect {
  kind: 'build'
  player: PlayerId
  buildKind: BuildKind
  /** Vertex id for settlements and cities, edge id for roads. */
  at: number
}

export interface DevBoughtEffect {
  kind: 'devBought'
  player: PlayerId
}

export interface DevPlayedEffect {
  kind: 'devPlayed'
  player: PlayerId
  card: Exclude<DevCardType, 'victoryPoint'>
}

export interface AwardEffect {
  kind: 'award'
  award: AwardKind
  /** The new holder, or null when Longest Road is lost. */
  holder: PlayerId | null
}

export interface TradeEffect {
  kind: 'trade'
  /** Who gives `give`: the acting player, or the offer proposer for a reply. */
  from: PlayerId
  /** Who gives `get`; null means the bank. */
  to: PlayerId | null
  give: ResourceCounts
  get: ResourceCounts
  /** Set for tradeReplied events, which move no cards yet. */
  reply?: TradeReplyKind
}

export interface DiscardEffect {
  kind: 'discard'
  player: PlayerId
  count: number
}

export interface TurnEffect {
  kind: 'turn'
  player: PlayerId
  human: boolean
}

export interface OfferEffect {
  kind: 'offer'
  from: PlayerId
  to: PlayerId[]
  give: ResourceCounts
  get: ResourceCounts
}

export interface GameOverEffect {
  kind: 'gameOver'
  winner: PlayerId
  humanWon: boolean
}

export interface SummaryEffect {
  kind: 'summary'
  text: string
}

export type Effect =
  | DiceEffect
  | ProduceEffect
  | RobberEffect
  | StealEffect
  | BuildEffect
  | DevBoughtEffect
  | DevPlayedEffect
  | AwardEffect
  | TradeEffect
  | DiscardEffect
  | TurnEffect
  | OfferEffect
  | GameOverEffect
  | SummaryEffect

function zeroCounts(): ResourceCounts {
  return { brick: 0, lumber: 0, wool: 0, grain: 0, ore: 0 }
}

function eventPlayer(event: GameEvent): PlayerId | null {
  if (event.type === 'produce') return null
  if (event.type === 'gameOver') return event.winner
  return event.player
}

function producingHexes(prev: GameState | null, next: GameState, total: number): { hexes: number[]; blockedHex: number | null } {
  const robber = prev?.robber ?? next.robber
  const hexes: number[] = []
  let blockedHex: number | null = null
  for (let h = 0; h < next.tiles.length; h++) {
    const tile = next.tiles[h]
    if (tile.terrain === 'desert' || tile.number !== total) continue
    if (h === robber) {
      blockedHex = h
      continue
    }
    hexes.push(h)
  }
  return { hexes, blockedHex }
}

function mapEvent(prev: GameState | null, next: GameState, event: GameEvent, human: PlayerId, robberFrom: number): Effect[] {
  switch (event.type) {
    case 'roll':
      return [{ kind: 'dice', dice: event.dice, roller: event.player }]
    case 'produce': {
      const dice = next.dice ?? prev?.dice
      const total = dice ? dice[0] + dice[1] : 0
      const { hexes, blockedHex } = producingHexes(prev, next, total)
      return [
        {
          kind: 'produce',
          total,
          hexes,
          gains: event.gains,
          blocked: event.blocked,
          blockedHex,
          shortage: event.shortage,
        },
      ]
    }
    case 'robberMoved': {
      const effect: RobberEffect = { kind: 'robber', from: robberFrom, to: event.hex }
      return [effect]
    }
    case 'stole': {
      const humanInvolved = event.player === human || event.victim === human
      return [
        {
          kind: 'steal',
          thief: event.player,
          victim: event.victim,
          resource: humanInvolved ? event.resource : null,
          hidden: !humanInvolved && event.resource !== null,
        },
      ]
    }
    case 'built':
      return [{ kind: 'build', player: event.player, buildKind: event.kind, at: event.at }]
    case 'setupSettlement':
      return [{ kind: 'build', player: event.player, buildKind: 'settlement', at: event.vertex }]
    case 'setupRoad':
      return [{ kind: 'build', player: event.player, buildKind: 'road', at: event.edge }]
    case 'boughtDevCard':
      return [{ kind: 'devBought', player: event.player }]
    case 'playedDevCard':
      return [{ kind: 'devPlayed', player: event.player, card: event.card }]
    case 'longestRoad':
      return [{ kind: 'award', award: 'longestRoad', holder: event.player }]
    case 'largestArmy':
      return [{ kind: 'award', award: 'largestArmy', holder: event.player }]
    case 'maritimeTrade': {
      const give = zeroCounts()
      give[event.give] = event.giveCount
      const get = zeroCounts()
      get[event.get] = 1
      return [{ kind: 'trade', from: event.player, to: null, give, get }]
    }
    case 'domesticTrade':
      return [{ kind: 'trade', from: event.player, to: event.partner, give: event.give, get: event.get }]
    case 'tradeProposed':
      if (event.to.includes(human)) {
        return [{ kind: 'offer', from: event.player, to: event.to, give: event.give, get: event.get }]
      }
      return []
    case 'tradeReplied': {
      if (event.reply === 'counter') return []
      const from =
        next.phase.kind === 'trade' ? next.phase.offer.from : prev?.phase.kind === 'trade' ? prev.phase.offer.from : event.player
      return [
        {
          kind: 'trade',
          from,
          to: event.player,
          give: zeroCounts(),
          get: zeroCounts(),
          reply: event.reply === 'accept' ? 'accepted' : 'declined',
        },
      ]
    }
    case 'discard':
      return [{ kind: 'discard', player: event.player, count: totalCards(event.resources) }]
    case 'turnEnded':
      return [{ kind: 'turn', player: next.current, human: next.current === human }]
    case 'gameOver':
      return [{ kind: 'gameOver', winner: event.winner, humanWon: event.winner === human }]
    default:
      return []
  }
}

function summaryText(prev: GameState | null, next: GameState, events: GameEvent[], human: PlayerId): string {
  const t = en.catan.effects
  const first = events.find((event) => eventPlayer(event) !== null)
  const actor = first ? (eventPlayer(first) ?? next.current) : (prev?.current ?? next.current)
  const player = actor === human ? 'Your' : `${next.players[actor]?.name ?? '?'}'s`
  const parts: string[] = []

  let rolled: number | null = null
  const built = { road: 0, settlement: 0, city: 0 }
  let bought = 0
  let played: Exclude<DevCardType, 'victoryPoint'> | null = null
  for (const event of events) {
    switch (event.type) {
      case 'roll':
        rolled = event.dice[0] + event.dice[1]
        break
      case 'built':
        built[event.kind] += 1
        break
      case 'boughtDevCard':
        bought += 1
        break
      case 'playedDevCard':
        if (played === null) played = event.card
        break
    }
  }

  if (rolled !== null) parts.push(fill(t.summaryRolled, { total: rolled }))
  if (built.road === 1) parts.push(t.summaryBuiltRoad)
  else if (built.road > 1) parts.push(fill(t.summaryBuiltRoads, { count: built.road }))
  if (built.settlement === 1) parts.push(t.summaryBuiltSettlement)
  else if (built.settlement > 1) parts.push(fill(t.summaryBuiltSettlements, { count: built.settlement }))
  if (built.city === 1) parts.push(t.summaryBuiltCity)
  else if (built.city > 1) parts.push(fill(t.summaryBuiltCities, { count: built.city }))
  if (bought === 1) parts.push(t.summaryBoughtCard)
  else if (bought > 1) parts.push(fill(t.summaryBoughtCards, { count: bought }))
  if (played !== null) parts.push(fill(t.summaryPlayedCard, { card: en.catan.playCard.cards[played].name }))
  if (parts.length === 0) parts.push(fill(t.summaryEvents, { count: events.length }))

  return fill(t.summary, { player, summary: parts.slice(0, 3).join(', ') })
}

/** Turns the events with `seq > prev.eventSeq` into a list of effects. */
export function effectsFor(prev: GameState | null, next: GameState, human: PlayerId): Effect[] {
  const fresh = prev ? next.events.filter((event) => event.seq > prev.eventSeq) : next.events
  if (fresh.length === 0) return []
  if (prev === null || fresh.length > 12) {
    return [{ kind: 'summary', text: summaryText(prev, next, fresh, human) }]
  }

  const effects: Effect[] = []
  let robberFrom = prev?.robber ?? next.robber
  for (const event of fresh) {
    effects.push(...mapEvent(prev, next, event, human, robberFrom))
    if (event.type === 'robberMoved') robberFrom = event.hex
  }
  return effects
}
