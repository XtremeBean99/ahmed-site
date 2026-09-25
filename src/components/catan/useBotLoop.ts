'use client'

import { useCallback, useEffect, useRef } from 'react'
import { chooseBotAction, fallbackAction } from '@/lib/games/catan/ai'
import { applyAction, playersToAct } from '@/lib/games/catan/engine'
import type { Action, GameState, PlayerId } from '@/lib/games/catan/types'

export interface UseBotLoopOptions {
  game: GameState | null
  human: PlayerId
  botSpeed: number
  animations: boolean
  /** True while any human modal, answer, tutorial step or stall is holding the bots. */
  paused: boolean
  /** Bot stall flag owned by the controller; while set the loop does nothing. */
  stalled: boolean
  apply: (action: Action) => boolean
  onStalled: () => void
  /** Replaces the game with the fast-forwarded state after skipToMyTurn. */
  onSkip: (state: GameState) => void
}

const MAX_SKIP_STEPS = 500
/** After a roll, give the dice time to land before the next bot moves. */
const POST_ROLL_PAUSE = 900

export function useBotLoop({ game, human, botSpeed, animations, paused, stalled, apply, onStalled, onSkip }: UseBotLoopOptions) {
  const gameRef = useRef<GameState | null>(null)
  gameRef.current = game

  const runBotAction = useCallback(
    (state: GameState, bot: PlayerId): boolean => {
      try {
        const action = chooseBotAction(state, bot)
        if (apply(action)) return true
        console.error('Bot action failed validation', action)
      } catch (err) {
        console.error('Bot could not choose an action', err)
      }
      try {
        const fallback = fallbackAction(state, bot)
        if (apply(fallback)) return true
        console.error('Bot fallback action failed validation', fallback)
      } catch (err) {
        console.error('Bot fallback action failed', err)
      }
      onStalled()
      return false
    },
    [apply, onStalled],
  )

  useEffect(() => {
    if (!game || paused || stalled) return
    const bot = playersToAct(game).find((p) => game.players[p].isBot)
    if (bot === undefined) return
    const lastEvent = game.events[game.events.length - 1]
    const afterRoll = lastEvent?.type === 'roll'
    let delay = game.phase.kind === 'setup' ? Math.min(botSpeed, 200) : botSpeed
    if (animations && afterRoll) delay = Math.max(delay, POST_ROLL_PAUSE)
    const timer = setTimeout(() => {
      const state = gameRef.current
      if (!state) return
      runBotAction(state, bot)
    }, delay)
    return () => clearTimeout(timer)
  }, [game, paused, stalled, botSpeed, animations, runBotAction])

  const skipToMyTurn = useCallback(() => {
    const initial = gameRef.current
    if (!initial) return
    let state: GameState = initial
    let steps = 0
    while (steps < MAX_SKIP_STEPS) {
      if (state.phase.kind === 'gameOver') break
      const actors = playersToAct(state)
      if (actors.length === 0 || actors.includes(human)) break
      const bot = actors.find((p) => state.players[p].isBot)
      if (bot === undefined) break
      let action: Action | null = null
      try {
        action = chooseBotAction(state, bot)
      } catch (err) {
        console.error('Bot could not choose an action while skipping', err)
      }
      if (action) {
        try {
          state = applyAction(state, action)
          steps += 1
          continue
        } catch (err) {
          console.error('Bot action failed validation while skipping', err)
        }
      }
      try {
        state = applyAction(state, fallbackAction(state, bot))
        steps += 1
      } catch (err) {
        console.error('Bot fallback action failed while skipping', err)
        onStalled()
        return
      }
    }
    onSkip(state)
  }, [human, onSkip, onStalled])

  return { skipToMyTurn }
}
