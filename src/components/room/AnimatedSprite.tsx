'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'

export type SpriteMode = 'loop' | 'play-once-hold'

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
  const [frameIndex, setFrameIndex] = useState(0)
  const reduce = useReducedMotion()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(0)

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
    return () => clearTimer()
  }, [clearTimer])

  const handleActivate = useCallback(() => {
    startAnimation()
  }, [startAnimation])

  const handleDeactivate = useCallback(() => {
    stopAnimation()
  }, [stopAnimation])

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
      }}
      onMouseEnter={handleActivate}
      onMouseLeave={handleDeactivate}
      onFocus={handleActivate}
      onBlur={handleDeactivate}
    >
      <RoomObject
        label={label}
        showTooltip={hovered}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        onClick={onClick}
        tabIndex={0}
        tooltipAlign={tooltipAlign}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frames[frameIndex]}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </RoomObject>
    </div>
  )
}
