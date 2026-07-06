'use client'

import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useRoomAudio } from './RoomAudioProvider'

const NOTES = ['/room/note-1.png', '/room/note-2.png', '/room/note-3.png']
const SPAWN_MIN = 900
const SPAWN_MAX = 1300
const POOL_SIZE = 3

interface MusicNotesProps {
  /** Stage coords of the note spawn point */
  cx: number
  cy: number
}

/** Per-speaker floating music-note animations. Pooled, CSS-keyframe driven. */
export function MusicNotes({ cx, cy }: MusicNotesProps) {
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
      const slot = slotRef.current % POOL_SIZE
      slotRef.current++
      const imgs = pool.querySelectorAll<HTMLImageElement>('img')
      const img = imgs[slot]
      if (!img) return

      const noteIdx = Math.floor(Math.random() * NOTES.length)
      img.src = NOTES[noteIdx]
      img.style.setProperty('--dx', String((Math.random() - 0.5) * 30 + 'px'))
      img.style.setProperty('--dy', String(-40 - Math.random() * 20 + 'px'))
      img.style.setProperty('--dur', String(1.8 + Math.random() * 0.6 + 's'))
      img.style.setProperty('--delay', '0s')
      // Force reflow to restart animation
      img.classList.remove('note-float')
      void img.offsetWidth
      img.classList.add('note-float')

      timerRef.current = setTimeout(spawn, SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN))
    }

    timerRef.current = setTimeout(spawn, Math.random() * 500)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [playing, reduce])

  if (reduce) return null

  return (
    <div
      ref={poolRef}
      aria-hidden
      className="absolute pointer-events-none"
      style={{ left: cx, top: cy, width: 21, height: 22 }}
    >
      {Array.from({ length: POOL_SIZE }, (_, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={i}
          src=""
          alt=""
          className="absolute opacity-0"
          style={{
            imageRendering: 'pixelated',
            animation: 'note-float var(--dur) ease-out var(--delay) forwards',
          }}
        />
      ))}
    </div>
  )
}
