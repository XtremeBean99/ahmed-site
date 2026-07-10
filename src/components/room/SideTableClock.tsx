'use client'

import { useState, useEffect, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'

interface SideTableClockProps {
  label: string
  /** Sprite rect in stage coords (from the ROOM_OBJECTS 'clock' entry) */
  x: number
  y: number
  w: number
  h: number
  frame: string
  /** Digit plane in stage coords (CLOCK_FACE_RECT) */
  faceRect: { x: number; y: number; w: number; h: number }
  /** skewY angle matching the face's isometric plane (CLOCK_FACE_SKEW_DEG) */
  faceSkewDeg: number
  is24h: boolean
  lampOn: boolean
  onToggle: () => void
}

function getTimeParts(is24h: boolean) {
  const now = new Date()
  const hours = now.getHours()
  const mins = now.getMinutes().toString().padStart(2, '0')
  if (is24h) {
    return { hh: hours.toString().padStart(2, '0'), mm: mins, suffix: '' }
  }
  const h12 = hours % 12 || 12
  return { hh: h12.toString(), mm: mins, suffix: hours >= 12 ? 'PM' : 'AM' }
}

export function SideTableClock({
  label,
  x,
  y,
  w,
  h,
  frame,
  faceRect,
  faceSkewDeg,
  is24h,
  lampOn,
  onToggle,
}: SideTableClockProps) {
  const [hovered, setHovered] = useState(false)
  const [time, setTime] = useState(() => getTimeParts(is24h))
  const reduce = useReducedMotion()

  const activate = useCallback(() => setHovered(true), [])
  const deactivate = useCallback(() => setHovered(false), [])

  // Update the clock every 10 seconds
  useEffect(() => {
    setTime(getTimeParts(is24h))
    const id = setInterval(() => setTime(getTimeParts(is24h)), 10_000)
    return () => clearInterval(id)
  }, [is24h])

  return (
    <RoomObject
      label={label}
      showTooltip={hovered}
      onActivate={activate}
      onDeactivate={deactivate}
      onClick={onToggle}
      tabIndex={0}
      style={{ position: 'absolute', left: x, top: y, width: w, height: h }}
    >
        {/* Plain <img>, NOT motion.img; the clock must not lift on hover. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frame}
          alt=""
          draggable={false}
          className="block w-full h-full"
          style={{
            imageRendering: 'pixelated',
            filter: lampOn ? 'none' : 'brightness(0.72)',
            transition: reduce ? 'none' : 'filter 0.4s ease',
          }}
        />
        {/* LED digits, skewed onto the face plane. Emissive, not dimmed by
            the lamp. aria-hidden: the time is decoration; the button label
            carries the accessible meaning. */}
        <div
          aria-hidden
          className="absolute flex items-center justify-center"
          style={{
            left: faceRect.x - x,
            top: faceRect.y - y,
            width: faceRect.w,
            height: faceRect.h,
            transform: `skewY(${faceSkewDeg}deg)`,
            transformOrigin: 'top left',
            pointerEvents: 'none',
            fontFamily: 'var(--font-pixel), "Courier New", monospace',
            fontSize: '11px',
            lineHeight: 1,
            color: '#35e65c',
            textShadow: '0 0 3px rgba(53,230,92,0.55)',
          }}
        >
          {time.hh}
          <span className={reduce ? undefined : 'clock-colon'} style={{ position: 'relative', top: '-1px' }}>
            :
          </span>
          {time.mm}
          {time.suffix && <span style={{ fontSize: '6px', marginLeft: '2px' }}>{time.suffix}</span>}
        </div>
      </RoomObject>
  )
}
