import { MAX_OFFERS_PER_TURN, RESOURCES } from '@/lib/games/catan/constants'
import { hasResources, maritimeRate, totalCards } from '@/lib/games/catan/helpers'
import type {
  GameState,
  PlayerColor,
  PlayerId,
  PortType,
  Resource,
  ResourceCounts,
  TradeOffer,
  TradeReply,
  TradeTerms,
} from '@/lib/games/catan/types'

export interface MaritimeOption {
  give: Resource
  get: Resource
  /** How many of `give` the bank takes for one `get`. */
  rate: 2 | 3 | 4
  /** The harbour behind the rate: the 2:1 resource, 'any' for a 3:1, null at the base 4:1. */
  harbour: PortType | null
}

/** Every bank trade `human` can make right now, with the rate and the harbour behind it. */
export function maritimeOptions(state: GameState, human: PlayerId): MaritimeOption[] {
  const options: MaritimeOption[] = []
  for (const give of RESOURCES) {
    const rate = maritimeRate(state, human, give)
    if (state.players[human].resources[give] < rate) continue
    const harbour: PortType | null = rate === 2 ? give : rate === 3 ? 'any' : null
    for (const get of RESOURCES) {
      if (get === give || state.bank[get] === 0) continue
      options.push({ give, get, rate, harbour })
    }
  }
  return options
}

export type OfferBlockReason = 'rollFirst' | 'notMain' | 'noOffers' | 'noCards'

/** Why the Players tab cannot propose right now, or null when it can. */
export function offerBlockReason(state: GameState, human: PlayerId): OfferBlockReason | null {
  if (state.phase.kind === 'preRoll') return 'rollFirst'
  if (state.phase.kind !== 'main') return 'notMain'
  if (state.current !== human) return 'notMain'
  if (state.offersThisTurn >= MAX_OFFERS_PER_TURN) return 'noOffers'
  if (totalCards(state.players[human].resources) === 0) return 'noCards'
  return null
}

/** Whether `proposeTrade` would be legal for these terms and recipients. */
export function canOffer(
  state: GameState,
  human: PlayerId,
  give: ResourceCounts,
  get: ResourceCounts,
  to: PlayerId[],
): boolean {
  if (offerBlockReason(state, human) !== null) return false
  if (totalCards(give) === 0 || totalCards(get) === 0) return false
  if (RESOURCES.some((r) => give[r] > 0 && get[r] > 0)) return false
  if (!hasResources(state.players[human].resources, give)) return false
  if (to.length === 0 || new Set(to).size !== to.length) return false
  return to.every((p) => Number.isInteger(p) && p >= 0 && p < state.players.length && p !== human)
}

/** Terms rewritten from the viewer's side: `give` leaves the viewer, `get` reaches the viewer. */
export function offerFromMySide(offer: TradeOffer, me: PlayerId): TradeTerms {
  if (me === offer.from) return { give: { ...offer.give }, get: { ...offer.get } }
  return { give: { ...offer.get }, get: { ...offer.give } }
}

export interface ReplyRow {
  player: PlayerId
  name: string
  color: PlayerColor
  reply: TradeReply
  /** Counter terms from the proposer's side, null unless `reply` is 'counter'. */
  counter: TradeTerms | null
}

/** One row per recipient, for the proposer's pending-offer view. */
export function replyRows(state: GameState, offer: TradeOffer): ReplyRow[] {
  return offer.to.map((player) => {
    const p = state.players[player]
    return {
      player,
      name: p.name,
      color: p.color,
      reply: offer.replies[player],
      counter: offer.counters[player] ? { ...offer.counters[player] } : null,
    }
  })
}

export interface TradeSides {
  give: ResourceCounts
  get: ResourceCounts
}

/**
 * Bump one side of a player offer by +/-1. Adding a resource clears it on the
 * other side, so the two sides never share a resource.
 */
export function stepTradeTerms(
  terms: TradeSides,
  side: 'give' | 'get',
  resource: Resource,
  delta: 1 | -1,
  max: number,
): TradeSides {
  const give = { ...terms.give }
  const get = { ...terms.get }
  const current = side === 'give' ? give : get
  current[resource] = Math.max(0, Math.min(max, current[resource] + delta))
  if (delta === 1) {
    const other = side === 'give' ? get : give
    other[resource] = 0
  }
  return { give, get }
}
