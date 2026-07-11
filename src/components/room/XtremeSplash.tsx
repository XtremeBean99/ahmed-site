'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ReactNode } from 'react'

const TOTAL_FRAMES = 28
const FRAME_MS = 120 // ~8.3 fps — fast enough to read as motion, slow enough for pixel art
const HOLD_MS = 3000
const DISPLAY_SIZE = 512 // 4x the 128x128 source

const FRAMES = Array.from({ length: TOTAL_FRAMES }, (_, i) => `/room/xtreme-${i + 1}.png`)

interface Props { children: ReactNode }

export function XtremeSplash({ children }: Props) {
  const [phase, setPhase] = useState<'playing' | 'holding' | 'done'>('playing')
  const [frame, setFrame] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Play through frames
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

  // Hold last frame for HOLD_MS, then finish
  useEffect(() => {
    if (phase !== 'holding') return
    timerRef.current = setTimeout(() => setPhase('done'), HOLD_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase])

  // Preload all frames
  useEffect(() => {
    for (const src of FRAMES) {
      const img = new window.Image()
      img.src = src
    }
  }, [])

  const showSplash = phase !== 'done'

  return (
    <>
      <AnimatePresence>
        {showSplash && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: '#e8d5b0' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FRAMES[frame]}
              alt=""
              draggable={false}
              width={DISPLAY_SIZE}
              height={DISPLAY_SIZE}
              style={{ imageRendering: 'pixelated' }}
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
