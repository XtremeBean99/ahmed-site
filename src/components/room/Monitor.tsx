'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { DURATION } from '@/lib/motion'

/** One clock drives both the highlight steps and the loading sequence. */
const FRAME_MS = 80

interface MonitorProps {
  label: string
  x: number
  y: number
  w: number
  h: number
  /** Hover frames: index 0 = rest art, 1..n = highlight steps (holds on last) */
  frames: string[]
  /** Loading-screen frames shown over the glass while hovered (holds on last) */
  loadingFrames: string[]
  /** Stage-space rect of the monitor glass the loading frames cover */
  loadingRect: { x: number; y: number; w: number; h: number }
  href: string
  onEnter?: () => void
}

export function Monitor({
  label,
  x,
  y,
  w,
  h,
  frames,
  loadingFrames,
  loadingRect,
  href,
  onEnter,
}: MonitorProps) {
  const [hovered, setHovered] = useState(false)
  const [tick, setTick] = useState(0)
  const router = useRouter()
  const reduce = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const tickRef = useRef(0)

  useEffect(() => {
    router.prefetch(href)
  }, [router, href])

  // Warm the browser cache for the highlight + loading frames so the first
  // hover doesn't skip frames while 21 images stream in.
  useEffect(() => {
    for (const src of [...frames.slice(1), ...loadingFrames]) {
      const img = new window.Image()
      img.src = src
    }
  }, [frames, loadingFrames])

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startHover = useCallback(() => {
    setHovered(true)
    if (reduce) return
    clearTimer()
    tickRef.current = 0
    setTick(0)
    // Highlight needs frames.length - 1 ticks; the loading overlay appears on
    // tick 1 and needs loadingFrames.length ticks. Each clamps to its own
    // last frame; the timer stops once the longer sequence finishes.
    const maxTick = Math.max(frames.length - 1, loadingFrames.length)
    timerRef.current = setInterval(() => {
      tickRef.current = Math.min(tickRef.current + 1, maxTick)
      setTick(tickRef.current)
      if (tickRef.current >= maxTick) clearTimer()
    }, FRAME_MS)
  }, [reduce, frames.length, loadingFrames.length, clearTimer])

  const stopHover = useCallback(() => {
    setHovered(false)
    clearTimer()
    tickRef.current = 0
    setTick(0)
  }, [clearTimer])

  useEffect(() => {
    return () => clearTimer()
  }, [clearTimer])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Middle-click, ctrl+click, etc. — let the browser handle natively
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return

      if (reduce) {
        // Reduced motion: navigate immediately (the <a> handles it natively)
        return
      }

      e.preventDefault()
      onEnter?.()
    },
    [reduce, onEnter],
  )

  const frameSrc = frames[Math.min(tick, frames.length - 1)]
  const loadingSrc =
    tick >= 1 ? loadingFrames[Math.min(tick, loadingFrames.length) - 1] : null

  return (
    <RoomObject
      label={label}
      showTooltip={hovered}
      onActivate={startHover}
      onDeactivate={stopHover}
      onClick={handleClick}
      href={href}
      tabIndex={0}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        zIndex: 1,
      }}
    >
      {/* Lift wrapper: the sprite and the glass overlay rise together. The
          transform makes this div the containing block for the overlay, so
          the overlay's offsets stay relative to the monitor rect. */}
      <motion.div
        className="w-full h-full"
        animate={hovered && !reduce ? { y: -2 } : { y: 0 }}
        transition={{ duration: DURATION.fast }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frameSrc}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
        {loadingSrc && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={loadingSrc}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              left: loadingRect.x - x,
              top: loadingRect.y - y,
              width: loadingRect.w,
              height: loadingRect.h,
              imageRendering: 'pixelated',
            }}
          />
        )}
      </motion.div>
    </RoomObject>
  )
}
