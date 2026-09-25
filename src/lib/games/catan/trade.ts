import type { HandlerMap } from './types'

// Contract stubs: CAT31 implements the trade-offer phase (see todo.md).
const NOT_YET = 'Trade offers are not available yet'

export const tradeHandlers: HandlerMap<'proposeTrade' | 'respondTrade' | 'confirmTrade' | 'cancelTrade'> = {
  proposeTrade: { validate: () => NOT_YET, apply: () => {} },
  respondTrade: { validate: () => NOT_YET, apply: () => {} },
  confirmTrade: { validate: () => NOT_YET, apply: () => {} },
  cancelTrade: { validate: () => NOT_YET, apply: () => {} },
}
