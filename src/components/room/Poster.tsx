'use client'

import { useState, useCallback } from 'react'
import { useReducedMotion, AnimatePresence, motion } from 'framer-motion'
import { RoomObject } from './RoomObject'

interface PosterProps {
  label: string
  x: number
  y: number
  w: number
  h: number
  frames: string[]
}

export function Poster({ label, x, y, w, h, frames }: PosterProps) {
  const [active, setActive] = useState(false)
  const [frameIndex, setFrameIndex] = useState(0)
  const reduce = useReducedMotion()

  const cycleFrame = useCallback(() => {
    setFrameIndex((prev) => (prev + 1) % frames.length)
  }, [frames.length])

  return (
    <RoomObject
      label={label}
      active={active}
      onActivate={() => setActive(true)}
      onDeactivate={() => setActive(false)}
      onClick={cycleFrame}
      tabIndex={0}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.img
          key={frameIndex}
          src={frames[frameIndex]}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{ imageRendering: 'pixelated' }}
          initial={reduce ? undefined : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.12 }}
        />
      </AnimatePresence>
    </RoomObject>
  )
}
