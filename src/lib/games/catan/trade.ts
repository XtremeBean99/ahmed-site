import { MAX_OFFERS_PER_TURN, RESOURCES } from './constants'
import { hasResources, isPlayerId, isResourceCounts, pushEvent, totalCards } from './helpers'
import type { HandlerMap, TradeOffer, TradeReply, TradeTerms } from './types'

function termsAreValid(give: unknown, get: unknown): string | null {
  if (!isResourceCounts(give) || !isResourceCounts(get)) return 'Invalid trade counts'
  if (totalCards(give) === 0 || totalCards(get) === 0) return 'Both sides must give at least one card'
  if (RESOURCES.some((r) => give[r] > 0 && get[r] > 0)) return 'No resource may appear on both sides'
  return null
}

export const tradeHandlers: HandlerMap<'proposeTrade' | 'respondTrade' | 'confirmTrade' | 'cancelTrade'> = {
  proposeTrade: {
    validate(state, action) {
      if (state.phase.kind !== 'main') return 'Trade offers can only be proposed in the main phase'
      if (state.offersThisTurn >= MAX_OFFERS_PER_TURN) return 'No more trade offers this turn'
      const shape = termsAreValid(action.give, action.get)
      if (shape !== null) return shape
      if (!hasResources(state.players[state.current].resources, action.give)) return 'You do not have the cards to give'
      if (!Array.isArray(action.to) || action.to.length === 0) return 'Choose at least one partner'
      if (new Set(action.to).size !== action.to.length) return 'Duplicate partners'
      for (const to of action.to) {
        if (!isPlayerId(state, to)) return 'Invalid partner'
        if (to === state.current) return 'Cannot trade with yourself'
      }
      return null
    },
    apply(state, action) {
      if (state.phase.kind !== 'main') return
      state.tradeSeq += 1
      state.offersThisTurn += 1
      const to = [...action.to].sort((a, b) => a - b)
      const replies: TradeReply[] = state.players.map(() => 'decline')
      for (const p of to) replies[p] = 'pending'
      const counters: (TradeTerms | null)[] = state.players.map(() => null)
      const offer: TradeOffer = {
        id: state.tradeSeq,
        from: state.current,
        to,
        replies,
        counters,
        give: { ...action.give },
        get: { ...action.get },
      }
      state.phase = { kind: 'trade', offer }
      pushEvent(state, {
        type: 'tradeProposed',
        player: state.current,
        offerId: offer.id,
        to: [...to],
        give: { ...action.give },
        get: { ...action.get },
      })
    },
  },
  respondTrade: {
    validate(state, action) {
      if (state.phase.kind !== 'trade') return 'No trade offer to answer'
      const { offer } = state.phase
      if (!isPlayerId(state, action.player)) return 'Invalid player'
      if (!offer.to.includes(action.player)) return 'You are not part of this offer'
      if (offer.replies[action.player] !== 'pending') return 'You already answered this offer'
      if (action.reply === 'accept') {
        if (!hasResources(state.players[action.player].resources, offer.get)) return 'You do not have the cards to give'
        return null
      }
      if (action.reply === 'decline') return null
      if (action.reply === 'counter') {
        const counter = action.counter
        if (counter === undefined) return 'A counter needs terms'
        const shape = termsAreValid(counter.give, counter.get)
        if (shape !== null) return shape
        if (!hasResources(state.players[action.player].resources, counter.get)) return 'You do not have the cards to give'
        if (!hasResources(state.players[offer.from].resources, counter.give)) return 'Partner does not have the cards to give'
        return null
      }
      return 'Invalid reply'
    },
    apply(state, action) {
      if (state.phase.kind !== 'trade') return
      const { offer } = state.phase
      offer.replies[action.player] = action.reply
      const counter = action.reply === 'counter' && action.counter !== undefined ? { give: { ...action.counter.give }, get: { ...action.counter.get } } : null
      if (counter !== null) offer.counters[action.player] = counter
      pushEvent(state, {
        type: 'tradeReplied',
        player: action.player,
        offerId: offer.id,
        reply: action.reply,
        counter,
      })
    },
  },
  confirmTrade: {
    validate(state, action) {
      if (state.phase.kind !== 'trade') return 'No trade offer to confirm'
      const { offer } = state.phase
      if (state.current !== offer.from) return 'Only the proposer can confirm the trade'
      if (!isPlayerId(state, action.partner)) return 'Invalid partner'
      if (!offer.to.includes(action.partner)) return 'That player is not part of this offer'
      const reply = offer.replies[action.partner]
      if (reply === 'accept') {
        if (!hasResources(state.players[offer.from].resources, offer.give)) return 'You do not have the cards to give'
        if (!hasResources(state.players[action.partner].resources, offer.get)) return 'Partner does not have the cards to give'
        return null
      }
      if (reply === 'counter') {
        const terms = offer.counters[action.partner]
        if (terms === null) return 'No counter from that player'
        if (!hasResources(state.players[offer.from].resources, terms.give)) return 'You do not have the cards to give'
        if (!hasResources(state.players[action.partner].resources, terms.get)) return 'Partner does not have the cards to give'
        return null
      }
      return 'That player has not accepted'
    },
    apply(state, action) {
      if (state.phase.kind !== 'trade') return
      const { offer } = state.phase
      const reply = offer.replies[action.partner]
      const terms = reply === 'counter' ? offer.counters[action.partner] : reply === 'accept' ? { give: offer.give, get: offer.get } : null
      if (terms === null) return
      const proposer = state.players[offer.from]
      const partner = state.players[action.partner]
      const give = { ...terms.give }
      const get = { ...terms.get }
      for (const r of RESOURCES) {
        proposer.resources[r] -= give[r]
        partner.resources[r] += give[r]
        partner.resources[r] -= get[r]
        proposer.resources[r] += get[r]
      }
      pushEvent(state, { type: 'domesticTrade', player: offer.from, partner: action.partner, give, get })
      state.phase = { kind: 'main' }
    },
  },
  cancelTrade: {
    validate(state) {
      if (state.phase.kind !== 'trade') return 'No trade offer to cancel'
      if (state.current !== state.phase.offer.from) return 'Only the proposer can cancel the trade'
      return null
    },
    apply(state) {
      if (state.phase.kind !== 'trade') return
      pushEvent(state, { type: 'tradeCancelled', player: state.current, offerId: state.phase.offer.id })
      state.phase = { kind: 'main' }
    },
  },
}
