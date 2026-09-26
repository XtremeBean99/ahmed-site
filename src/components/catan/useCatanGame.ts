'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createGame } from '@/lib/games/catan/board'
import { applyAction, humanPlayer } from '@/lib/games/catan/engine'
import { clearGame, loadGame, saveGame, saveKeyFor } from '@/lib/games/catan/save'
import type { Action, GameState } from '@/lib/games/catan/types'
import { getCatanPrefsStorage, readPrefs, writePrefs, type CatanPrefs, type NewGameSetup } from './prefs'
import { nextUndoStack, popUndoStack } from './undo-stack'

export type ApplyResult = { ok: true; state: GameState } | { ok: false; error: string }

export interface UseCatanGameOptions {
  /** 'game' uses the versioned normal save; 'tutorial' uses the tutorial's own key. */
  mode?: 'game' | 'tutorial'
  /** When provided, start from this state instead of loading a save (tutorial mode). */
  initialState?: GameState | null
  /** When false the undo stack never grows and undo() is a no-op (tutorial mode). */
  undoEnabled?: boolean
}

function readTutorialSave(key: string): GameState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed as GameState
  } catch {
    return null
  }
}

function writeTutorialSave(key: string, state: GameState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // ignore quota / privacy-mode failures
  }
}

function clearTutorialSave(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore storage failures
  }
}

/** Keys removed when the tutorial exits; never the normal game save. */
export function tutorialExitClearKeys(): readonly string[] {
  return [saveKeyFor('tutorial')]
}

export function useCatanGame(options: UseCatanGameOptions = {}) {
  const mode = options.mode ?? 'game'
  const saveKey = saveKeyFor(mode)
  const initialState = options.initialState
  const undoEnabled = options.undoEnabled ?? true

  const [mounted, setMounted] = useState(false)
  const [game, setGame] = useState<GameState | null>(null)
  const [showNewGame, setShowNewGame] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [undoStack, setUndoStack] = useState<GameState[]>([])
  const [prefs, setPrefs] = useState<CatanPrefs>(() => readPrefs(getCatanPrefsStorage()))
  const gameRef = useRef<GameState | null>(null)
  const undoStackRef = useRef<GameState[]>([])

  useEffect(() => {
    setMounted(true)
    setPrefs(readPrefs(getCatanPrefsStorage()))
    if (initialState) {
      gameRef.current = initialState
      setGame(initialState)
      return
    }
    const saved = mode === 'game' ? loadGame() : readTutorialSave(saveKey)
    if (saved) {
      gameRef.current = saved
      setGame(saved)
    } else {
      setShowNewGame(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    gameRef.current = game
    if (game) {
      if (mode === 'game') saveGame(game)
      else writeTutorialSave(saveKey, game)
    }
  }, [game, mode, saveKey])

  const updatePrefs = useCallback((patch: Partial<CatanPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      writePrefs(getCatanPrefsStorage(), next)
      return next
    })
  }, [])

  const replaceGame = useCallback((next: GameState): void => {
    gameRef.current = next
    setGame(next)
    undoStackRef.current = []
    setUndoStack([])
  }, [])

  const apply = useCallback(
    (action: Action): ApplyResult => {
      const prev = gameRef.current
      if (!prev) return { ok: false, error: 'No game in progress' }
      try {
        const next = applyAction(prev, action)
        gameRef.current = next
        setGame(next)
        if (undoEnabled) {
          const stack = nextUndoStack(undoStackRef.current, prev, next, action, humanPlayer(prev))
          undoStackRef.current = stack
          setUndoStack(stack)
        }
        return { ok: true, state: next }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
    [undoEnabled],
  )

  const undo = useCallback((): boolean => {
    if (!undoEnabled) return false
    const { state, rest } = popUndoStack(undoStackRef.current)
    if (state === null) return false
    undoStackRef.current = rest
    setUndoStack(rest)
    gameRef.current = state
    setGame(state)
    return true
  }, [undoEnabled])

  const startNewGame = useCallback(
    (setup: NewGameSetup) => {
      if (mode === 'game') clearGame()
      else clearTutorialSave(saveKey)
      const seed = crypto.getRandomValues(new Uint32Array(1))[0]
      const fresh = createGame({
        seed,
        playerCount: setup.playerCount,
        humanName: setup.name || 'You',
        humanColor: setup.color,
        botLevel: setup.botLevel,
        settings: setup.settings,
      })
      updatePrefs({ lastSetup: setup })
      gameRef.current = fresh
      setGame(fresh)
      undoStackRef.current = []
      setUndoStack([])
      setShowNewGame(false)
    },
    [mode, saveKey, updatePrefs],
  )

  const startNewFromGameOver = useCallback(() => {
    if (mode === 'game') clearGame()
    else clearTutorialSave(saveKey)
    gameRef.current = null
    setGame(null)
    undoStackRef.current = []
    setUndoStack([])
    setShowNewGame(true)
  }, [mode, saveKey])

  return {
    mounted,
    game,
    gameRef,
    showNewGame,
    setShowNewGame,
    resetKey,
    setResetKey,
    prefs,
    updatePrefs,
    apply,
    replaceGame,
    startNewGame,
    startNewFromGameOver,
    undoStackSize: undoStack.length,
    canUndo: undoEnabled && undoStack.length > 0,
    undo,
    saveKey,
  }
}

export type CatanGameCore = ReturnType<typeof useCatanGame>
