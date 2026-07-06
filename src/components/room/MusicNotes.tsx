'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useRoomAudio } from './RoomAudioProvider'

const NOTES = ['/room/note-1.png', '/room/note-2.png', '/room/note-3.png']
/** Constant emission rate (ms between notes) and constant float duration. */
const SPAWN_INTERVAL = 1100
const NOTE_DURATION_MS = 2000
const POOL_SIZE = 4

/** A circular speaker driver (tweeter/woofer) in stage coordinates. */
export interface SpeakerHole {
  cx: number
  cy: number
  r: number
}

interface MusicNotesProps {
  /** Driver holes of this speaker; notes spawn on random points around their rims. */
  holes: readonly SpeakerHole[]
  /** Initial delay before the first note, so the two speakers do not sync. */
  startDelay?: number
}

/**
 * Floating music notes for one speaker. Notes emit at a constant rate while
 * music plays, each spawning at a random point around the rim of a random
 * driver hole and drifting outward/upward. Pooled <img> elements recycled via
 * CSS keyframes; no per-frame React state.
 */
export function MusicNotes({ holes, startDelay = 0 }: MusicNotesProps) {
  const { playing } = useRoomAudio()
  const reduce = useReducedMotion()
  const poolRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const slotRef = useRef(0)

  useEffect(() => {
    if (reduce || !playing) {
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    const pool = poolRef.current
    if (!pool) return

    const spawn = () => {
      const imgs = pool.querySelectorAll<HTMLImageElement>('img')
      const img = imgs[slotRef.current % POOL_SIZE]
      slotRef.current++

      if (img) {
        // Random point on (or just inside) the rim of a random driver hole
        const hole = holes[Math.floor(Math.random() * holes.length)]
        const angle = Math.random() * Math.PI * 2
        const dist = hole.r * (0.7 + Math.random() * 0.3)
        const sx = hole.cx + Math.cos(angle) * dist
        const sy = hole.cy + Math.sin(angle) * dist

        // Drift: continue outward from the hole centre, then up
        const dx = Math.round(Math.cos(angle) * 14 + (Math.random() - 0.5) * 12)
        const dy = Math.round(-46 - Math.random() * 16)

        img.src = NOTES[Math.floor(Math.random() * NOTES.length)]
        img.style.left = `${Math.round(sx)}px`
        img.style.top = `${Math.round(sy)}px`
        img.style.setProperty('--dx', `${dx}px`)
        img.style.setProperty('--dy', `${dy}px`)
        img.style.setProperty('--dur', `${NOTE_DURATION_MS}ms`)
        // Restart the CSS animation
        img.classList.remove('note-float')
        void img.offsetWidth
        img.classList.add('note-float')
      }

      timerRef.current = setTimeout(spawn, SPAWN_INTERVAL)
    }

    timerRef.current = setTimeout(spawn, startDelay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [playing, reduce, holes, startDelay])

  if (reduce) return null

  return (
    <div ref={poolRef} aria-hidden className="absolute inset-0 pointer-events-none">
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={i}
          src=""
          alt=""
          className="absolute opacity-0"
          style={{ imageRendering: 'pixelated' }}
        />
      ))}
    </div>
  )
}
