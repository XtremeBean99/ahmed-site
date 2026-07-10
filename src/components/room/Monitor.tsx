'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { DURATION } from '@/lib/motion'
import { useLighting, lightingSrc } from '@/lib/room/lighting'
import { SPRITE_FRAME_MS } from '@/lib/room/objects'
import { useAnimationTimer } from '@/lib/room/useAnimationTimer'

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
  const router = useRouter()
  const reduce = useReducedMotion()
  const lighting = useLighting()
  const { tick, tickRef, advanceTo, clearTimer, start, stop } = useAnimationTimer(SPRITE_FRAME_MS.monitor, reduce)

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

  const startHover = useCallback(() => {
    setHovered(true)
    if (reduce) return
    const maxTick = Math.max(frames.length - 1, loadingFrames.length)
    start(() => {
      const next = Math.min(tickRef.current + 1, maxTick)
      advanceTo(next)
      if (next >= maxTick) clearTimer()
    })
  }, [reduce, frames.length, loadingFrames.length, start, advanceTo, clearTimer, tickRef])

  const stopHover = useCallback(() => {
    setHovered(false)
    stop()
  }, [stop])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (onEnter) onEnter()
    },
    [onEnter],
  )

  const frameSrc = lightingSrc(frames[Math.min(tick, frames.length - 1)], lighting)
  const loadingSrc =
    tick >= 1 ? loadingFrames[Math.min(tick, loadingFrames.length) - 1] : null

  return (
    <RoomObject
      label={label}
      showTooltip={hovered}
      href={href}
      onActivate={startHover}
      onDeactivate={stopHover}
      onClick={handleClick}
      tabIndex={0}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
      }}
    >
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
      </motion.div>

      {/* Loading-screen overlay */}
      {hovered && loadingSrc && (
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: loadingRect.x - x,
            top: loadingRect.y - y,
            width: loadingRect.w,
            height: loadingRect.h,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={loadingSrc}
            alt=""
            draggable={false}
            className="block w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      )}
    </RoomObject>
  )
}
