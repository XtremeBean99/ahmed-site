'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion } from 'framer-motion'
import { motion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { DURATION } from '@/lib/motion'

interface MonitorProps {
  label: string
  x: number
  y: number
  w: number
  h: number
  frames: string[]
  href: string
  /** Called when user clicks the monitor (for transition animation) */
  onEnter?: () => void
}

export function Monitor({ label, x, y, w, h, frames, href, onEnter }: MonitorProps) {
  const [active, setActive] = useState(false)
  const router = useRouter()
  const reduce = useReducedMotion()

  useEffect(() => {
    router.prefetch(href)
  }, [router, href])

  const handleClick = useCallback(() => {
    if (reduce) {
      router.push(href)
      return
    }
    onEnter?.()
  }, [reduce, router, href, onEnter])

  const sprite = frames[0]

  return (
    <RoomObject
      label={label}
      active={active}
      onActivate={() => setActive(true)}
      onDeactivate={() => setActive(false)}
      onClick={handleClick}
      href={reduce ? href : undefined}
      tabIndex={0}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
      }}
    >
      <motion.img
        src={sprite}
        alt=""
        draggable={false}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated' }}
        animate={
          active && !reduce
            ? { y: -2 }
            : { y: 0 }
        }
        transition={{ duration: DURATION.fast }}
      />
    </RoomObject>
  )
}
