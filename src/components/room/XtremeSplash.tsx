'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

const TOTAL_FRAMES = 28
const FRAME_MS = 120
const FIRST_HOLD_MS = 1500
const LAST_HOLD_MS = 1500
const DISPLAY_SIZE = 512

const FRAMES = Array.from({ length: TOTAL_FRAMES }, (_, i) => `/room/xtreme-${i + 1}.png`)

interface Props { children: ReactNode }

export function XtremeSplash({ children }: Props) {
  const [phase, setPhase] = useState<'firstFrame' | 'playing' | 'holding' | 'done'>('firstFrame')
  const [frame, setFrame] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reduce = useReducedMotion()

  // Hold first frame for FIRST_HOLD_MS before playing
  useEffect(() => {
    if (phase !== 'firstFrame') return
    timerRef.current = setTimeout(() => setPhase('playing'), FIRST_HOLD_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase])

  // Play through frames 1..N-1
  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setTimeout(() => {
      if (frame < TOTAL_FRAMES - 1) {
        setFrame((f) => f + 1)
      } else {
        setPhase('holding')
      }
    }, FRAME_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, frame])

  // Hold last frame for LAST_HOLD_MS, then finish
  useEffect(() => {
    if (phase !== 'holding') return
    timerRef.current = setTimeout(() => setPhase('done'), LAST_HOLD_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase])

  // Preload all frames
  useEffect(() => {
    for (const src of FRAMES) {
      const img = new window.Image()
      img.src = src
    }
  }, [])

  // Reduced-motion visitors skip the splash entirely.
  useEffect(() => {
    if (reduce) setPhase('done')
  }, [reduce])

  // Any key or pointer press skips the splash. Escape and pointer presses stop
  // here (Escape would leave the desk); other keys go on, so the skip key still
  // counts as the gesture that unlocks the room's music (RoomAudioProvider).
  useEffect(() => {
    if (phase === 'done') return
    const skip = (e: Event) => {
      if (e.type === 'pointerdown' || (e as KeyboardEvent).key === 'Escape') e.stopPropagation()
      setPhase('done')
    }
    window.addEventListener('keydown', skip, true)
    window.addEventListener('pointerdown', skip, true)
    return () => {
      window.removeEventListener('keydown', skip, true)
      window.removeEventListener('pointerdown', skip, true)
    }
  }, [phase])

  const showSplash = phase !== 'done'

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: '#e8d5b0' }}
            // The fading overlay must not eat clicks meant for the revealed room.
            exit={{ opacity: 0, pointerEvents: 'none' }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FRAMES[frame]}
              alt=""
              draggable={false}
              width={DISPLAY_SIZE}
              height={DISPLAY_SIZE}
              style={{ imageRendering: 'pixelated', width: 'min(512px, 88vw)', height: 'min(512px, 88vw)' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Children always mounted so the room preloads in the background */}
      <div style={{ visibility: showSplash ? 'hidden' : 'visible' }}>
        {children}
      </div>
    </>
  )
}
