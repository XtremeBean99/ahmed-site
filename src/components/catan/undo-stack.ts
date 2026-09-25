import { isUndoable } from '@/lib/games/catan/engine'
import type { Action, GameState, PlayerId } from '@/lib/games/catan/types'

/**
 * Undo rules as a pure reducer. The stack holds states from before each human
 * undoable action; anything else clears it so an undo can never rewind past a
 * bot action, a turn change, or a non-undoable action.
 */
export function nextUndoStack(
  stack: readonly GameState[],
  before: GameState,
  after: GameState,
  action: Action,
  human: PlayerId,
): GameState[] {
  const actor = 'player' in action && typeof action.player === 'number' ? action.player : before.current
  if (actor !== human) return []
  if (!isUndoable(action)) return []
  if (after.turn !== before.turn) return []
  return [...stack, before]
}

export function popUndoStack(stack: readonly GameState[]): { state: GameState | null; rest: GameState[] } {
  if (stack.length === 0) return { state: null, rest: [] }
  return { state: stack[stack.length - 1], rest: stack.slice(0, -1) }
}
