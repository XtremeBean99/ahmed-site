'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'

interface BonsaiProps {
  label: string
  x: number
  y: number
  w: number
  h: number
  frames: string[]
}

const FRAME_DURATION = 120

export function Bonsai({ label, x, y, w, h, frames }: BonsaiProps) {
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

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    if (reduce || frames.length <= 1) return

    idxRef.current = 0
    setFrameIndex(0)

    intervalRef.current = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % frames.length
      setFrameIndex(idxRef.current)
    }, FRAME_DURATION)
  }, [reduce, frames.length])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    setFrameIndex(0)
    idxRef.current = 0
    clearAnimation()
  }, [clearAnimation])

  // Ensure cleanup on unmount
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
