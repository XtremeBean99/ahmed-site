'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { ROOM_OBJECTS } from '@/lib/room/objects'
import { RoomStage } from './RoomStage'
import { RoomHud } from './RoomHud'
import { RoomAudio } from './RoomAudio'
import { Monitor } from './Monitor'
import { AnimatedSprite } from './AnimatedSprite'

const STAGE_W = 1408
const STAGE_H = 768

interface RoomProps {
  dict: {
    room: {
      navLabel: string
      monitorLabel: string
      posterLabel: string
      bonsaiLabel: string
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
  const [transitioning, setTransitioning] = useState(false)
  const navigatingRef = useRef(false)
  // Store timeout ids in refs so Escape/unmount can clear them
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Compute scale — always fit (letterbox with black bars)
  const updateScale = useCallback(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    setScale(Math.min(vw / STAGE_W, vh / STAGE_H))
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

    // Safety timeout: force navigation after 1.5s
    safetyRef.current = setTimeout(() => {
      router.push('/home')
    }, 1500)

    // Navigate after zoom + overlay completes (~800 ms)
    navRef.current = setTimeout(() => {
      router.push('/home')
    }, 800)
  }, [reduce, router])

  // Cancel transition on Escape
  const cancelTransition = useCallback(() => {
    setTransitioning(false)
    navigatingRef.current = false
    if (safetyRef.current) { clearTimeout(safetyRef.current); safetyRef.current = null }
    if (navRef.current) { clearTimeout(navRef.current); navRef.current = null }
  }, [])

  useEffect(() => {
    if (!transitioning) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelTransition()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Cleanup timeouts on unmount
      if (safetyRef.current) clearTimeout(safetyRef.current)
      if (navRef.current) clearTimeout(navRef.current)
    }
  }, [transitioning, cancelTransition])

  const monitorObj = ROOM_OBJECTS.find((o) => o.id === 'monitor')!
  const posterObj = ROOM_OBJECTS.find((o) => o.id === 'poster')!
  const bonsaiObj = ROOM_OBJECTS.find((o) => o.id === 'bonsai')!

  // Monitor screen centre in stage coords (for zoom origin on inner stage div)
  // Screen area within monitor-desk.png: sprite-local x 22-218, y 12-128
  const screenCenterX = monitorObj.x + 22 + 98 // (218-22)/2 ≈ 98, screen centre in stage coords
  const screenCenterY = monitorObj.y + 12 + 58 // (128-12)/2 ≈ 58

  // Screen glow position (in viewport percentage)
  const glowX = ((monitorObj.x + 22 + 98) / STAGE_W) * 100
  const glowY = ((monitorObj.y + 12 + 58) / STAGE_H) * 100

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#1a1210]">
      {/* Skip link + HUD */}
      <RoomHud
        enterLabel={t.room.enterSite}
        hintLabel={t.room.hint}
        skipLabel={t.room.skip}
      />

      {/* Background music toggle */}
      <RoomAudio />

      {/* Room nav landmark */}
      <nav aria-label={t.room.navLabel}>
        <RoomStage
          scale={scale}
          zoomScale={transitioning && !reduce ? 3.2 : 1}
          zoomOriginX={screenCenterX}
          zoomOriginY={screenCenterY}
        >
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
          <AnimatedSprite
            label={t.room.posterLabel}
            x={posterObj.x}
            y={posterObj.y}
            w={posterObj.w}
            h={posterObj.h}
            frames={posterObj.frames}
            frameDuration={100}
            mode="play-once-hold"
          />

          {/* Bonsai */}
          <AnimatedSprite
            label={t.room.bonsaiLabel}
            x={bonsaiObj.x}
            y={bonsaiObj.y}
            w={bonsaiObj.w}
            h={bonsaiObj.h}
            frames={bonsaiObj.frames}
            frameDuration={120}
            mode="loop"
          />
        </RoomStage>
      </nav>

      {/* Screen-coloured glow bloom */}
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

      {/* Ambient lamp glow pulse */}
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
