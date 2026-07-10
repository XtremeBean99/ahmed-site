'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { DURATION } from '@/lib/motion'
import { useLighting, lightingSrc } from '@/lib/room/lighting'

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
  const [frameIndex, setFrameIndex] = useState(0)
  const reduce = useReducedMotion()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(0)
  // Touch devices: track whether a tap-triggered animation is running
  const touchActiveRef = useRef(false)
  const touchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isTouchDevice = typeof window !== 'undefined' && matchMedia('(pointer: coarse)').matches

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startAnimation = useCallback(() => {
    setHovered(true)
    if (reduce || frames.length <= 1) return

    // Always kill any running timer first
    clearTimer()
    setFrameIndex(0)
    idxRef.current = 0

    if (mode === 'play-once-hold') {
      // Step through frames 0→1→2→...→last, then hold
      intervalRef.current = setInterval(() => {
        idxRef.current++
        if (idxRef.current >= frames.length) {
          setFrameIndex(frames.length - 1)
          clearTimer()
          return
        }
        setFrameIndex(idxRef.current)
      }, frameDuration)
    } else if (mode === 'play-all-loop-last-two') {
      // Play all frames 0→...→last, then loop the last two indefinitely
      intervalRef.current = setInterval(() => {
        idxRef.current++
        if (idxRef.current >= frames.length) {
          // Bounce between last two: frames.length-2 and frames.length-1
          idxRef.current = frames.length - 2
        }
        setFrameIndex(idxRef.current)
      }, frameDuration)
    } else {
      // Loop continuously
      intervalRef.current = setInterval(() => {
        idxRef.current = (idxRef.current + 1) % frames.length
        setFrameIndex(idxRef.current)
      }, frameDuration)
    }
  }, [reduce, frames.length, mode, frameDuration, clearTimer])

  const stopAnimation = useCallback(() => {
    setHovered(false)
    clearTimer()
    setFrameIndex(0)
  }, [clearTimer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer()
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    }
  }, [clearTimer])

  // Touch tap handler: on coarse-pointer devices, a tap starts the animation
  // and auto-stops after the full sequence completes (or on a second tap).
  const handleTouch = useCallback(() => {
    if (!isTouchDevice || reduce) return
    if (touchActiveRef.current) {
      // Second tap: stop early
      stopAnimation()
      touchActiveRef.current = false
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
      return
    }
    touchActiveRef.current = true
    startAnimation()
    if (onClick) onClick()
    // Auto-stop after the full animation plays through
    const totalMs = frames.length * frameDuration + 200
    touchTimerRef.current = setTimeout(() => {
      stopAnimation()
      touchActiveRef.current = false
    }, totalMs)
  }, [isTouchDevice, reduce, startAnimation, stopAnimation, onClick, frames.length, frameDuration])

  // Aligned with Monitor: events are registered ONLY on RoomObject (no outer
  // div with duplicate handlers), and the hover lift is on a motion.div
  // wrapper around a plain <img> so the transform never displaces the hit area.
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
          src={lightingSrc(frames[frameIndex], lighting)}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </motion.div>
    </RoomObject>
  )
}
