'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'

interface PosterProps {
  label: string
  x: number
  y: number
  w: number
  h: number
  frames: string[]
}

const FRAME_DURATION = 100

export function Poster({ label, x, y, w, h, frames }: PosterProps) {
  const [hovered, setHovered] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const reduce = useReducedMotion()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const idxRef = useRef(1) // start from frame 2 for step-through

  const clearAnimation = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    if (reduce || frames.length <= 1) return

    // Start at frame 1, then step through to last frame and hold
    idxRef.current = 1 // frame 2 (index 1)
    setFrameIndex(0) // start at frame 1

    intervalRef.current = setInterval(() => {
      if (idxRef.current >= frames.length) {
        // Reached last frame — hold
        setFrameIndex(frames.length - 1)
        clearAnimation()
        return
      }
      setFrameIndex(idxRef.current)
      idxRef.current++
    }, FRAME_DURATION)
  }, [reduce, frames.length, clearAnimation])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    setFrameIndex(0)
    idxRef.current = 1
    clearAnimation()
  }, [clearAnimation])

  useEffect(() => {
    return () => clearAnimation()
  }, [clearAnimation])

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <RoomObject
        label={label}
        showTooltip={hovered}
        onActivate={() => {}}
        onDeactivate={() => {}}
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
