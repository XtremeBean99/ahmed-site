'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import type { GameState } from '@/lib/games/catan/types'
import { collapseAnnouncements, makeAnnounceSummary } from './announcer'
import { formatEventText, playerPossessive } from './event-text'

const SPEAK_INTERVAL = 600

/** Queues every new engine event and reads it out at most once per 600 ms. */
export function useEventAnnouncer(game: GameState | null, t: Dictionary): string {
  const [announcement, setAnnouncement] = useState('')
  const lastSeq = useRef(0)
  const queue = useRef<string[]>([])
  const lastSpokenAt = useRef(0)
  const gameRef = useRef<GameState | null>(null)
  gameRef.current = game

  useEffect(() => {
    if (!game) return
    if (game.eventSeq < lastSeq.current) {
      // Undo or a new game: resume from the restored log instead of reading all of it out again.
      lastSeq.current = game.eventSeq
      queue.current = []
      setAnnouncement('')
      return
    }
    const fresh = game.events.filter((e) => e.seq > lastSeq.current)
    if (fresh.length === 0) return
    lastSeq.current = game.events[game.events.length - 1]?.seq ?? lastSeq.current
    for (const event of fresh) queue.current.push(formatEventText(game, event, t))
  }, [game, t])

  useEffect(() => {
    const id = setInterval(() => {
      if (queue.current.length === 0) return
      const now = Date.now()
      if (now - lastSpokenAt.current < SPEAK_INTERVAL) return
      const state = gameRef.current
      if (!state) return
      const summary = makeAnnounceSummary(
        t.catan.layout.announceSummary,
        playerPossessive(state, state.current),
        queue.current.length,
      )
      const next = collapseAnnouncements(queue.current, summary)
      setAnnouncement(next[0])
      queue.current = next.slice(1)
      lastSpokenAt.current = now
    }, 250)
    return () => clearInterval(id)
  }, [t])

  return announcement
}
