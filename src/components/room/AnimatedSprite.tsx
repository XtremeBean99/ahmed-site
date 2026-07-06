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
}: AnimatedSpriteProps) {
  const [hovered, setHovered] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const reduce = useReducedMotion()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(0)

  const clearAnimation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startAnimation = useCallback(() => {
    setHovered(true)
    if (reduce || frames.length <= 1) return

    if (mode === 'play-once-hold') {
      // Start at frame 0, step through to last, hold
      idxRef.current = 1
      setFrameIndex(0)

      intervalRef.current = setInterval(() => {
        if (idxRef.current >= frames.length) {
          setFrameIndex(frames.length - 1)
          clearAnimation()
          return
        }
        setFrameIndex(idxRef.current)
        idxRef.current++
      }, frameDuration)
    } else {
      // Loop
      idxRef.current = 0
      setFrameIndex(0)

      intervalRef.current = setInterval(() => {
        idxRef.current = (idxRef.current + 1) % frames.length
        setFrameIndex(idxRef.current)
      }, frameDuration)
    }
  }, [reduce, frames.length, mode, frameDuration, clearAnimation])

  const stopAnimation = useCallback(() => {
    setHovered(false)
    setFrameIndex(0)
    idxRef.current = 0
    clearAnimation()
  }, [clearAnimation])

  useEffect(() => {
    return () => clearAnimation()
  }, [clearAnimation])

  // Shared handler used by both mouse and focus
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
