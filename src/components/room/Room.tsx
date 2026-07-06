'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { ROOM_OBJECTS } from '@/lib/room/objects'
import { RoomStage } from './RoomStage'
import { RoomHud } from './RoomHud'
import { RoomAudio } from './RoomAudio'
import { Monitor } from './Monitor'
import { Poster } from './Poster'
import { EASE_OUT_EXPO } from '@/lib/motion'

const STAGE_W = 1408
const STAGE_H = 768
const MOBILE_BREAKPOINT = 700

interface RoomProps {
  dict: {
    room: {
      navLabel: string
      monitorLabel: string
      posterLabel: string
      enterSite: string
      hint: string
      skip: string
    }
  }
}

export function Room({ dict }: RoomProps) {
  const t = dict
  const router = useRouter()
  const reduce = useReducedMotion()
  const [scale, setScale] = useState(1)
  const [fitWidth, setFitWidth] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  // Guard to prevent re-triggering navigation
  const navigatingRef = useRef(false)

  // Compute scale on resize
  const updateScale = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight

    if (vw < MOBILE_BREAKPOINT) {
      setFitWidth(true)
      setScale(vw / STAGE_W)
    } else {
      setFitWidth(false)
      setScale(Math.max(vw / STAGE_W, vh / STAGE_H))
    }
  }, [])

  useEffect(() => {
    updateScale()
    const onResize = () => updateScale()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateScale])

  // Monitor click → transition animation
  const handleEnter = useCallback(() => {
    if (reduce || navigatingRef.current) {
      router.push('/home')
      return
    }
    navigatingRef.current = true
    setTransitioning(true)

    // Safety timeout: force navigation after 1.5s if animation callback never fires
    const safetyTimeout = setTimeout(() => {
      router.push('/home')
    }, 1500)

    // Navigate after zoom + overlay animation completes (~800 ms)
    const navTimeout = setTimeout(() => {
      router.push('/home')
    }, 800)

    return () => {
      clearTimeout(safetyTimeout)
      clearTimeout(navTimeout)
    }
  }, [reduce, router])

  // Cancel transition on Escape (before navigation fires)
  useEffect(() => {
    if (!transitioning) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTransitioning(false)
        navigatingRef.current = false
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [transitioning])

  const monitorObj = ROOM_OBJECTS.find((o) => o.id === 'monitor')!
  const posterObj = ROOM_OBJECTS.find((o) => o.id === 'poster')!

  // Monitor screen centre in stage coords (for transform-origin)
  const screenCenterX = monitorObj.x + monitorObj.w / 2
  const screenCenterY = monitorObj.y + monitorObj.h * 0.35 // upper portion (screen area)

  // Screen glow position (in viewport percentage, approximate based on stage layout)
  // The screen is roughly at monitorObj.x+22 to monitorObj.x+218, monitorObj.y+12 to monitorObj.y+128
  const glowX = ((monitorObj.x + 22 + 109) / STAGE_W) * 100 // screen centre x as % of stage
  const glowY = ((monitorObj.y + 12 + 58) / STAGE_H) * 100 // screen centre y as % of stage

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a1210]">
      {/* Skip link + HUD */}
      <RoomHud
        enterLabel={t.room.enterSite}
        hintLabel={t.room.hint}
        skipLabel={t.room.skip}
      />

      {/* Background music toggle (hidden on reduced motion) */}
      <RoomAudio />

      {/* Room nav landmark */}
      <nav aria-label={t.room.navLabel}>
        {/* Zoom container */}
        <motion.div
          className="w-full h-full"
          animate={
            transitioning && !reduce
              ? {
                  scale: 3.2,
                }
              : {
                  scale: 1,
                }
          }
          style={{
            transformOrigin: `${screenCenterX}px ${screenCenterY}px`,
          }}
          transition={{
            duration: transitioning ? 0.6 : 0,
            ease: EASE_OUT_EXPO,
          }}
        >
          <RoomStage scale={scale} fitWidth={fitWidth}>
            {/* Background image (LCP) — raw <img> required for pixel-art rendering */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/room/background.png"
              alt=""
              fetchPriority="high"
              draggable={false}
              className="absolute inset-0 w-full h-full"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Monitor */}
            <Monitor
              label={t.room.monitorLabel}
              x={monitorObj.x}
              y={monitorObj.y}
              w={monitorObj.w}
              h={monitorObj.h}
              frames={monitorObj.frames}
              href={monitorObj.href!}
              onEnter={handleEnter}
            />

            {/* Poster */}
            <Poster
              label={t.room.posterLabel}
              x={posterObj.x}
              y={posterObj.y}
              w={posterObj.w}
              h={posterObj.h}
              frames={posterObj.frames}
            />
          </RoomStage>
        </motion.div>
      </nav>

      {/* Screen-coloured glow bloom (radial gradient from screen centre) */}
      <AnimatePresence>
        {transitioning && !reduce && (
          <motion.div
            className="fixed inset-0 z-40 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{
              background: `radial-gradient(ellipse 300px 200px at ${glowX}% ${glowY}%, rgba(100,120,180,0.35) 0%, rgba(60,80,140,0.15) 40%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* White overlay fade-in (final 250ms of zoom) */}
      <AnimatePresence>
        {transitioning && !reduce && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, delay: 0.35, ease: 'easeOut' }}
            style={{ background: '#faf8f5' }}
          />
        )}
      </AnimatePresence>

      {/* Ambient lamp glow pulse (CSS only, not during transition) */}
      {!reduce && !transitioning && (
        <div
          className="fixed pointer-events-none z-0"
          style={{
            left: '8.5%',
            top: '12%',
            width: '15%',
            height: '15%',
            background: 'radial-gradient(ellipse, rgba(200,160,100,0.12) 0%, transparent 70%)',
            animation: 'lamp-glow 6s ease-in-out infinite',
          }}
        />
      )}
    </div>
  )
}
