import { RESOURCES } from '../constants'
import { emptyResources, hasResources, maritimeRate, totalCards } from '../helpers'
import {
  deficitToBuild,
  estimatePlayerHold,
  givesOnlySurplus,
  publicVp,
  receivesLackingResource,
  targetBuild,
} from './evaluate'
import { levelOf, maxProposalsFor } from './levels'
import type { Action, BotLevel, GameState, PlayerId, ResourceCounts, TradeOffer, TradeTerms } from '../types'

export function termsEqual(a: ResourceCounts, b: ResourceCounts): boolean {
  return RESOURCES.every((r) => a[r] === b[r])
}

function proposedIdenticalThisTurn(
  state: GameState,
  bot: PlayerId,
  to: PlayerId,
  give: ResourceCounts,
  get: ResourceCounts,
): boolean {
  for (const event of state.events) {
    if (event.type !== 'tradeProposed' || event.player !== bot || event.turn !== state.turn) continue
    if (!event.to.includes(to)) continue
    if (termsEqual(event.give, give) && termsEqual(event.get, get)) return true
  }
  return false
}

/** Share of each requested card the human must be estimated to hold before a bot asks them. */
const HUMAN_HOLD_CONFIDENCE = 0.75

/**
 * Every bot offer to the human pauses the game for an answer, so bots ask sparingly: at most once per
 * bot turn, only for cards the human probably holds (public information), and not again within a round
 * of the human declining this bot.
 */
export function offerToHumanAllowed(state: GameState, bot: PlayerId, human: PlayerId, get: ResourceCounts): boolean {
  for (const r of RESOURCES) {
    if (get[r] > 0 && estimatePlayerHold(state, human, r) < get[r] * HUMAN_HOLD_CONFIDENCE) return false
  }
  const since = state.turn - state.players.length
  const recentOffers = new Set<number>()
  for (const event of state.events) {
    if (event.type === 'tradeProposed' && event.player === bot) {
      if (event.turn === state.turn && event.to.includes(human)) return false
      if (event.turn >= since) recentOffers.add(event.offerId)
    } else if (event.type === 'tradeReplied' && event.player === human && event.reply === 'decline' && recentOffers.has(event.offerId)) {
      return false
    }
  }
  return true
}

/**
 * A bot trade proposal in the main phase, made when the target build is one or
 * two cards short and the bot holds surplus cards it does not need for it.
 */
export function proposeTradeAction(state: GameState, bot: PlayerId, level: BotLevel): Action | null {
  if (!state.settings.botTrades) return null
  if (state.phase.kind !== 'main' || state.current !== bot) return null
  if (state.offersThisTurn >= maxProposalsFor(level)) return null

  const target = targetBuild(state, bot)
  const hand = state.players[bot].resources
  const cost = target.cost
  const needed: ResourceCounts = emptyResources()
  const surplus: Array<{ r: (typeof RESOURCES)[number]; amount: number }> = []
  let deficit = 0
  for (const r of RESOURCES) {
    const d = Math.max(0, cost[r] - hand[r])
    needed[r] = d
    deficit += d
    const extra = hand[r] - cost[r]
    if (extra > 0) surplus.push({ r, amount: extra })
  }
  if (deficit !== 1 && deficit !== 2) return null
  if (surplus.length === 0) return null
  surplus.sort((a, b) => b.amount - a.amount || RESOURCES.indexOf(a.r) - RESOURCES.indexOf(b.r))

  const available = surplus.filter((s) => needed[s.r] === 0)
  if (available.length === 0) return null

  const give = emptyResources()
  const get = emptyResources()
  if (deficit === 1) {
    const giver = available[0]
    const largeSurplus = giver.amount >= 3
    give[giver.r] = largeSurplus ? 2 : 1
    const want = RESOURCES.find((r) => needed[r] === 1)
    if (want === undefined) return null
    get[want] = 1
    if (largeSurplus && maritimeRate(state, bot, giver.r) <= 2) return null
  } else {
    const double = available.find((s) => s.amount >= 2)
    if (double) {
      give[double.r] = 2
    } else if (available.length >= 2) {
      give[available[0].r] = 1
      give[available[1].r] = 1
    } else {
      return null
    }
    const want = RESOURCES.filter((r) => needed[r] > 0)
    for (const r of want) get[r] = needed[r]
  }

  if (totalCards(give) === 0 || totalCards(get) === 0) return null
  if (RESOURCES.some((r) => give[r] > 0 && get[r] > 0)) return null
  if (!hasResources(hand, give)) return null

  const limit = state.settings.vpToWin - 2
  const to: PlayerId[] = []
  for (let p = 0; p < state.players.length; p++) {
    if (p === bot) continue
    if (publicVp(state, p) >= limit) continue
    if (totalCards(state.players[p].resources) === 0) continue
    if (proposedIdenticalThisTurn(state, bot, p, give, get)) continue
    if (!state.players[p].isBot && !offerToHumanAllowed(state, bot, p, get)) continue
    to.push(p)
  }
  if (to.length === 0) return null
  return { type: 'proposeTrade', to, give, get }
}

/**
 * Whether `bot` accepts a trade in which it RECEIVES `offer.give` from
 * `offer.from` and GIVES `offer.get`.
 */
export function botAcceptsTrade(
  state: GameState,
  bot: PlayerId,
  offer: { from: PlayerId; give: ResourceCounts; get: ResourceCounts },
  opts?: { level?: BotLevel },
): boolean {
  const level = levelOf(state, bot, opts)
  const proposer = offer.from
  const proposerPublicVp = publicVp(state, proposer)
  if (proposerPublicVp >= state.settings.vpToWin - 2) return false

  const give = offer.give // bot receives
  const get = offer.get // bot gives
  const hand = state.players[bot].resources

  if (totalCards(give) === 0 || totalCards(get) === 0) return false
  if (RESOURCES.some((r) => give[r] > 0 && get[r] > 0)) return false
  if (!hasResources(hand, get)) return false

  const target = targetBuild(state, bot)
  const before = deficitToBuild(hand, target.cost)
  const afterHand = emptyResources()
  for (const r of RESOURCES) afterHand[r] = hand[r] - get[r] + give[r]
  const after = deficitToBuild(afterHand, target.cost)

  if (level === 'easy') {
    if (totalCards(get) - totalCards(give) > 2) return false
    return after <= before + 1
  }

  if (level === 'hard') {
    if (totalCards(get) - totalCards(give) > 1) return false
    if (after < before) return true
    return (
      after === before &&
      totalCards(get) <= totalCards(give) &&
      givesOnlySurplus(hand, target.cost, get) &&
      receivesLackingResource(hand, give)
    )
  }

  // normal
  if (totalCards(get) - totalCards(give) > 1) return false
  if (after < before) return true
  return after === before && givesOnlySurplus(hand, target.cost, get) && receivesLackingResource(hand, give)
}

function bestConfirmPartner(state: GameState, bot: PlayerId, level: BotLevel): PlayerId | null {
  if (state.phase.kind !== 'trade') return null
  const { offer } = state.phase
  let best: PlayerId | null = null
  let bestVp = Number.POSITIVE_INFINITY
  for (const p of offer.to) {
    const reply = offer.replies[p]
    let acceptable = false
    if (reply === 'accept') {
      acceptable = true
    } else if (reply === 'counter') {
      const terms = offer.counters[p]
      if (terms !== null) {
        acceptable =
          hasResources(state.players[bot].resources, terms.give) &&
          botAcceptsTrade(state, bot, { from: p, give: terms.get, get: terms.give }, { level })
      }
    }
    if (!acceptable) continue
    const vp = publicVp(state, p)
    if (best === null || vp < bestVp || (vp === bestVp && p < best)) {
      best = p
      bestVp = vp
    }
  }
  return best
}

function counterTerms(state: GameState, bot: PlayerId, offer: TradeOffer, level: BotLevel): TradeTerms | null {
  const hand = state.players[bot].resources
  const proposer = offer.from
  if (publicVp(state, proposer) >= state.settings.vpToWin - 2) return null

  // Ask for one more card of a resource the human already offered.
  for (const r of RESOURCES) {
    if (offer.give[r] === 0) continue
    if (estimatePlayerHold(state, proposer, r) < offer.give[r] + 1) continue
    const give = { ...offer.give }
    give[r] += 1
    const get = { ...offer.get }
    if (RESOURCES.some((x) => give[x] > 0 && get[x] > 0)) continue
    if (hasResources(hand, get) && botAcceptsTrade(state, bot, { from: proposer, give, get }, { level })) {
      return { give, get }
    }
  }

  // Swap the requested resource for one the bot holds in surplus.
  const target = targetBuild(state, bot)
  for (const r of RESOURCES) {
    if (offer.get[r] === 0) continue
    for (const s of RESOURCES) {
      if (s === r || offer.give[s] > 0) continue
      if (hand[s] <= target.cost[s]) continue
      const give = { ...offer.give }
      const get = { ...offer.get }
      get[r] = 0
      get[s] = offer.get[r]
      if (RESOURCES.some((x) => give[x] > 0 && get[x] > 0)) continue
      if (hasResources(hand, get) && botAcceptsTrade(state, bot, { from: proposer, give, get }, { level })) {
        return { give, get }
      }
    }
  }
  return null
}

export function chooseTradePhase(state: GameState, bot: PlayerId, level: BotLevel): Action {
  if (state.phase.kind !== 'trade') throw new Error('not in trade phase')
  const { offer } = state.phase
  if (offer.from === bot) {
    const partner = bestConfirmPartner(state, bot, level)
    return partner === null ? { type: 'cancelTrade' } : { type: 'confirmTrade', partner }
  }
  if (offer.replies[bot] !== 'pending') throw new Error('bot is not pending on this offer')
  if (botAcceptsTrade(state, bot, { from: offer.from, give: offer.give, get: offer.get }, { level })) {
    return { type: 'respondTrade', player: bot, reply: 'accept' }
  }
  if (level !== 'easy' && !state.players[offer.from].isBot) {
    const counter = counterTerms(state, bot, offer, level)
    if (counter) return { type: 'respondTrade', player: bot, reply: 'counter', counter }
  }
  return { type: 'respondTrade', player: bot, reply: 'decline' }
}
