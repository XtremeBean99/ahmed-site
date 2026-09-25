'use client'

import { useEffect, type RefObject } from 'react'
import { intentForKey, type ShortcutIntent } from './shortcut-map'
import type { BoardView } from './BoardCanvas'

export type BoardViewHandle = BoardView

export interface ShortcutFlags {
  roll: boolean
  endTurn: boolean
  road: boolean
  settlement: boolean
  city: boolean
  buyDev: boolean
  trade: boolean
  playCard: boolean
  undo: boolean
  hint: boolean
  log: boolean
}

export interface ShortcutHandlers {
  roll: () => void
  endTurn: () => void
  toggleRoad: () => void
  toggleSettlement: () => void
  toggleCity: () => void
  buyDev: () => void
  trade: () => void
  playCard: () => void
  undo: () => void
  hint: () => void
  log: () => void
  cancel: () => void
  help: () => void
}

const ZOOM_INTENTS = new Set<ShortcutIntent>(['zoomIn', 'zoomOut', 'zoomFit'])

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable
}

export function useShortcuts(opts: {
  enabled: boolean
  dialogOpen: boolean
  flags: ShortcutFlags
  handlers: ShortcutHandlers
  viewRef: RefObject<BoardViewHandle | null>
}): void {
  const { enabled, dialogOpen, flags, handlers, viewRef } = opts

  useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (dialogOpen) return
      if (isTypingTarget(event.target)) return
      const intent = intentForKey(event)
      if (!intent) return
      if (event.repeat && !ZOOM_INTENTS.has(intent)) return

      const run = (handler: () => void): boolean => {
        event.preventDefault()
        handler()
        return true
      }

      switch (intent) {
        case 'roll':
          if (flags.roll) run(handlers.roll)
          break
        case 'endTurn':
          if (flags.endTurn) run(handlers.endTurn)
          break
        case 'buildRoad':
          if (flags.road) run(handlers.toggleRoad)
          break
        case 'buildSettlement':
          if (flags.settlement) run(handlers.toggleSettlement)
          break
        case 'buildCity':
          if (flags.city) run(handlers.toggleCity)
          break
        case 'buyDev':
          if (flags.buyDev) run(handlers.buyDev)
          break
        case 'trade':
          if (flags.trade) run(handlers.trade)
          break
        case 'playCard':
          if (flags.playCard) run(handlers.playCard)
          break
        case 'undo':
          if (flags.undo) run(handlers.undo)
          break
        case 'hint':
          if (flags.hint) run(handlers.hint)
          break
        case 'log':
          if (flags.log) run(handlers.log)
          break
        case 'zoomIn':
          event.preventDefault()
          viewRef.current?.zoomIn()
          break
        case 'zoomOut':
          event.preventDefault()
          viewRef.current?.zoomOut()
          break
        case 'zoomFit':
          event.preventDefault()
          viewRef.current?.fit()
          break
        case 'cancel':
          run(handlers.cancel)
          break
        case 'help':
          run(handlers.help)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, dialogOpen, flags, handlers, viewRef])
}
