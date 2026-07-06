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

const FRAME_DURATION = 120 // ms between each frame

export function Bonsai({ label, x, y, w, h, frames }: BonsaiProps) {
  const [active, setActive] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const reduce = useReducedMotion()
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const startAnimation = useCallback(() => {
    setActive(true)
    if (reduce || frames.length <= 1) return

    let idx = 0
    timerRef.current = setInterval(() => {
      idx = (idx + 1) % frames.length
      setFrameIndex(idx)
    }, FRAME_DURATION)
  }, [reduce, frames.length])

  const stopAnimation = useCallback(() => {
    setActive(false)
    setFrameIndex(0)
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return (
    <RoomObject
      label={label}
      active={active}
      onActivate={startAnimation}
      onDeactivate={stopAnimation}
      tabIndex={0}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
      }}
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
  )
}
