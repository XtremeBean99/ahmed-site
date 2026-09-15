import { VP_TO_WIN } from './constants'
import { devCardHandlers, updateLargestArmy } from './devcards'
import { pushEvent, victoryPoints } from './helpers'
import { updateLongestRoad } from './longest-road'
import { robberHandlers } from './robber'
import { setupHandlers } from './setup'
import { turnHandlers } from './turn'
import type { Action, ActionType, GameState, Handler, HandlerMap, PlayerId } from './types'

export { createGame } from './board'

const HANDLERS: HandlerMap<ActionType> = {
  ...setupHandlers,
  ...turnHandlers,
  ...robberHandlers,
  ...devCardHandlers,
}

function handlerFor(action: Action): Handler<ActionType> | undefined {
  if (typeof action !== 'object' || action === null) return undefined
  if (!Object.prototype.hasOwnProperty.call(HANDLERS, action.type)) return undefined
  return HANDLERS[action.type] as Handler<ActionType>
}

/** Why `action` is illegal in `state`, or null when it may be applied. */
export function validateAction(state: GameState, action: Action): string | null {
  if (state.phase.kind === 'gameOver') return 'The game is over'
  const handler = handlerFor(action)
  if (!handler) return 'Unknown action'
  return handler.validate(state, action)
}

/** Returns the next state; the input is never mutated. Throws on an illegal action. */
export function applyAction(state: GameState, action: Action): GameState {
  const reason = validateAction(state, action)
  if (reason !== null) throw new Error(reason)
  const next = structuredClone(state)
  handlerFor(action)!.apply(next, action)
  updateLongestRoad(next)
  updateLargestArmy(next)
  checkVictory(next)
  return next
}

/** Only the player whose turn it is can win, so a player pushed to 10 elsewhere wins when their turn starts. */
function checkVictory(state: GameState): void {
  if (state.phase.kind === 'setup' || state.phase.kind === 'gameOver') return
  if (victoryPoints(state, state.current) >= VP_TO_WIN) {
    state.phase = { kind: 'gameOver', winner: state.current }
    pushEvent(state, { type: 'gameOver', winner: state.current })
  }
}

/** Players who must act before the game can continue (several at once only while discarding). */
export function playersToAct(state: GameState): PlayerId[] {
  switch (state.phase.kind) {
    case 'gameOver':
      return []
    case 'discard':
      return state.phase.discards.flatMap((n, p) => (n > 0 ? [p] : []))
    default:
      return [state.current]
  }
}

export function humanPlayer(state: GameState): PlayerId {
  return state.players.findIndex((p) => !p.isBot)
}
