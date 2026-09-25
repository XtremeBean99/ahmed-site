import assert from 'node:assert/strict'
import test from 'node:test'
import { makeTestState } from '@/lib/games/catan/test-fixtures'
import type { Action, GameState } from '@/lib/games/catan/types'
import { nextUndoStack, popUndoStack } from './undo-stack'

function clone(state: GameState): GameState {
  return structuredClone(state)
}

function undoable(action: Action): GameState[] {
  const before = makeTestState({ phase: { kind: 'main' }, current: 0 })
  const after = clone(before)
  after.eventSeq = 1
  return nextUndoStack([], before, after, action, 0)
}

test('undoable human actions push the before state', () => {
  const stack = undoable({ type: 'buildRoad', edge: 0 })
  assert.equal(stack.length, 1)
  assert.equal(stack[0].eventSeq, 0)
})

test('non-undoable human actions clear the stack', () => {
  const before = makeTestState({ phase: { kind: 'main' }, current: 0 })
  const after = clone(before)
  after.eventSeq = 1
  const prior = [clone(before)]
  const stack = nextUndoStack(prior, before, after, { type: 'endTurn' }, 0)
  assert.deepEqual(stack, [])
})

test('bot actions clear the stack even when the action is undoable', () => {
  const before = makeTestState({ phase: { kind: 'main' }, current: 0 })
  const after = clone(before)
  after.eventSeq = 1
  const stack = nextUndoStack([], before, after, { type: 'buildRoad', edge: 0 }, 0)
  assert.equal(stack.length, 1)

  const botTurn = clone(after)
  botTurn.current = 1
  const botAfter = clone(botTurn)
  botAfter.eventSeq = 2
  const botAction: Action = { type: 'buildRoad', edge: 1 }
  assert.deepEqual(nextUndoStack(stack, botTurn, botAfter, botAction, 0), [])
})

test('a turn change clears the stack', () => {
  const before = makeTestState({ phase: { kind: 'main' }, current: 0 })
  const after = clone(before)
  after.eventSeq = 1
  const prior = [clone(before)]
  after.turn = before.turn + 1
  const stack = nextUndoStack(prior, before, after, { type: 'playRoadBuilding' }, 0)
  assert.deepEqual(stack, [])
})

test('popUndoStack returns the newest state and the rest', () => {
  const a = makeTestState()
  const b = clone(a)
  b.eventSeq = 1
  const c = clone(b)
  c.eventSeq = 2
  const { state, rest } = popUndoStack([a, b, c])
  assert.equal(state, c)
  assert.deepEqual(rest, [a, b])
  assert.deepEqual(popUndoStack([]), { state: null, rest: [] })
})
