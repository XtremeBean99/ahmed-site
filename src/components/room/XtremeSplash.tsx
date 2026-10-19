'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'
import { loadPrefs, savePrefs } from '@/lib/room/storage'
import {
  splashPlan,
  SPLASH_FRAME_MS,
  SPLASH_READY_CAP_MS,
  SPLASH_TOTAL_FRAMES,
  type SplashPlan,
} from '@/lib/room/splash'

// One sheet of 128 px frames, COLS wide, built by scripts/extract-xtreme.mjs.
const COLS = 10
const ROWS = Math.ceil(SPLASH_TOTAL_FRAMES / COLS)
const DISPLAY_SIZE = 512
const SHEET = '/room/xtreme-sheet.png'
const READY_POLL_MS = 100

type Phase = 'loading' | 'firstFrame' | 'playing' | 'holding' | 'done'

interface Props { children: ReactNode }

/**
 * True once the room behind the splash has painted its art: every eager <img> inside
 * `root` has finished (loaded or failed) and the pixel font is in.
 */
function roomReady(root: HTMLElement | null): boolean {
  if (!root) return false
  if (document.fonts && document.fonts.status !== 'loaded') return false
  for (const img of root.querySelectorAll('img')) {
    if (img.loading !== 'lazy' && img.getAttribute('src') && !img.complete) return false
  }
  return true
}

export function XtremeSplash({ children }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [plan, setPlan] = useState<SplashPlan | null>(null)
  const [sheetLoaded, setSheetLoaded] = useState(false)
  const [frame, setFrame] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sheetRef = useRef<HTMLImageElement>(null)
  const roomRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()

  // Full animation on the first visit and once a day, the short cut otherwise.
  useEffect(() => {
    const now = Date.now()
    const next = splashPlan(loadPrefs().splashAt, now)
    if (next.kind === 'full') savePrefs({ splashAt: now })
    setPlan(next)
    setFrame(next.startFrame)
  }, [])

  // A cached sheet can finish before hydration, so onLoad alone may never fire.
  useEffect(() => {
    if (sheetRef.current?.complete) setSheetLoaded(true)
  }, [])

  useEffect(() => {
    if (phase === 'loading' && plan && sheetLoaded) setPhase('firstFrame')
  }, [phase, plan, sheetLoaded])

  // A sheet that never arrives must not keep the room covered.
  useEffect(() => {
    if (phase !== 'loading') return
    const t = setTimeout(() => setPhase('done'), SPLASH_READY_CAP_MS)
    return () => clearTimeout(t)
  }, [phase])

  // Hold the first frame for the plan's minimum, then on until the room has loaded
  // behind it (so it is never revealed half-drawn), but never past the cap.
  useEffect(() => {
    if (phase !== 'firstFrame' || !plan) return
    const started = performance.now()
    const tick = () => {
      const elapsed = performance.now() - started
      if (elapsed >= SPLASH_READY_CAP_MS || (elapsed >= plan.firstHoldMs && roomReady(roomRef.current))) {
        setPhase('playing')
        return
      }
      timerRef.current = setTimeout(tick, READY_POLL_MS)
    }
    timerRef.current = setTimeout(tick, plan.firstHoldMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, plan])

  // Play through to the last frame
  useEffect(() => {
    if (phase !== 'playing') return
    timerRef.current = setTimeout(() => {
      if (frame < SPLASH_TOTAL_FRAMES - 1) {
        setFrame((f) => f + 1)
      } else {
        setPhase('holding')
      }
    }, SPLASH_FRAME_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, frame])

  // Hold the last frame, then finish
  useEffect(() => {
    if (phase !== 'holding' || !plan) return
    timerRef.current = setTimeout(() => setPhase('done'), plan.lastHoldMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, plan])

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
            <div
              aria-hidden
              style={{
                position: 'relative',
                overflow: 'hidden',
                width: 'min(512px, 88vw)',
                height: 'min(512px, 88vw)',
                // Blank until the plan is known, so a returning visitor never sees frame 0 flash.
                visibility: phase === 'loading' ? 'hidden' : 'visible',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={sheetRef}
                src={SHEET}
                alt=""
                draggable={false}
                fetchPriority="high"
                onLoad={() => setSheetLoaded(true)}
                onError={() => setPhase('done')}
                width={DISPLAY_SIZE * COLS}
                height={DISPLAY_SIZE * ROWS}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  maxWidth: 'none',
                  imageRendering: 'pixelated',
                  width: `${COLS * 100}%`,
                  height: `${ROWS * 100}%`,
                  transform: `translate(${(-(frame % COLS) * 100) / COLS}%, ${(-Math.floor(frame / COLS) * 100) / ROWS}%)`,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Children always mounted so the room loads in the background */}
      <div ref={roomRef} style={{ visibility: showSplash ? 'hidden' : 'visible' }}>
        {children}
      </div>
    </>
  )
}
