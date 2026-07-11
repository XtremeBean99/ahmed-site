'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { DURATION } from '@/lib/motion'
import { useLighting, lightingSrc } from '@/lib/room/lighting'
import { useAnimationTimer } from '@/lib/room/useAnimationTimer'

export type SpriteMode = 'loop' | 'play-once-hold' | 'play-all-loop-last-two'

interface AnimatedSpriteProps {
  label: string
  x: number
  y: number
  w: number
  h: number
  frames: string[]
  frameDuration: number
  mode: SpriteMode
  onClick?: () => void
  /** Tooltip alignment, forwarded to RoomObject (use 'right' near the stage edge) */
  tooltipAlign?: 'center' | 'right'
}

export function AnimatedSprite({
  label,
  x,
  y,
  w,
  h,
  frames,
  frameDuration,
  mode,
  onClick,
  tooltipAlign,
}: AnimatedSpriteProps) {
  const [hovered, setHovered] = useState(false)
  const lighting = useLighting()
  const reduce = useReducedMotion()
  const { tick, tickRef, advanceTo, clearTimer, start, stop } = useAnimationTimer(frameDuration, reduce)

  // Touch devices: track whether a tap-triggered animation is running
  const touchActiveRef = useRef(false)
  const touchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [isTouchDevice] = useState(() => typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches)

  // Continuous modes (loop, play-all-loop-last-two) run on their own from mount;
  // play-once-hold plays on hover/tap only. `runAnimation` starts the timer per
  // mode WITHOUT touching hover state (hover only drives the -2px lift + tooltip).
  const isAutoplay = mode !== 'play-once-hold'

  const runAnimation = useCallback(() => {
    if (reduce || frames.length <= 1) return

    if (mode === 'play-once-hold') {
      start(() => {
        const next = tickRef.current + 1
        if (next >= frames.length) {
          advanceTo(frames.length - 1)
          clearTimer()
          return
        }
        advanceTo(next)
      })
    } else if (mode === 'play-all-loop-last-two') {
      start(() => {
        let next = tickRef.current + 1
        if (next >= frames.length) next = frames.length - 2
        advanceTo(next)
      })
    } else {
      // Loop continuously
      start(() => {
        advanceTo((tickRef.current + 1) % frames.length)
      })
    }
  }, [reduce, frames.length, mode, start, advanceTo, clearTimer, tickRef])

  const startAnimation = useCallback(() => {
    setHovered(true)
    if (isAutoplay) return // already running from mount; hover only lifts
    runAnimation()
  }, [isAutoplay, runAnimation])

  const stopAnimation = useCallback(() => {
    setHovered(false)
    if (isAutoplay) return // keep looping when the pointer leaves
    stop()
  }, [isAutoplay, stop])

  // Autoplay continuous modes on mount (saitama's play-all-loop-last-two, bonsai's
  // loop). This mount-autoplay was dropped in the Spec 1 refactor, which is why
  // saitama stopped animating.
  useEffect(() => {
    if (!isAutoplay) return
    runAnimation()
    return () => stop()
  }, [isAutoplay, runAnimation, stop])

  // Cleanup touch timer on unmount (interval is handled by useAnimationTimer)
  useEffect(() => {
    return () => {
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    }
  }, [])

  // Warm the browser cache for the frames AT THE CURRENT LIGHTING STATE so the
  // first play does not skip while images stream in. Preloading only the base
  // (dusk) paths missed the graded dawn/day/night variants (lightingSrc) — that
  // was the "delayed on first play" bug. Re-runs when the lighting state changes.
  useEffect(() => {
    if (frames.length <= 1) return
    for (const src of frames) {
      const img = new window.Image()
      img.src = lightingSrc(src, lighting)
    }
  }, [frames, lighting])

  // Touch tap handler: on coarse-pointer devices, a tap starts the animation
  // and auto-stops after the full sequence completes (or on a second tap).
  const handleTouch = useCallback(() => {
    if (!isTouchDevice || reduce) return
    if (touchActiveRef.current) {
      stopAnimation()
      touchActiveRef.current = false
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
      return
    }
    touchActiveRef.current = true
    startAnimation()
    if (onClick) onClick()
    const totalMs = frames.length * frameDuration + 200
    touchTimerRef.current = setTimeout(() => {
      stopAnimation()
      touchActiveRef.current = false
    }, totalMs)
  }, [isTouchDevice, reduce, startAnimation, stopAnimation, onClick, frames.length, frameDuration])

  return (
    <RoomObject
      label={label}
      showTooltip={hovered}
      onActivate={startAnimation}
      onDeactivate={stopAnimation}
      onClick={isTouchDevice ? handleTouch : onClick}
      tabIndex={0}
      tooltipAlign={tooltipAlign}
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
          src={lightingSrc(frames[tick], lighting)}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </motion.div>
    </RoomObject>
  )
}
