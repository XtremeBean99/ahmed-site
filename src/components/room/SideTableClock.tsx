'use client'

import { useState, useCallback } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'

/**
 * Static "photograph" time — the room is frozen at dusk, so the clock shows a
 * fixed 21:07 (a 7/7 nod), not the visitor's live time. The wall clock bubble
 * next to the posters already shows real time.
 */
const TIME_24 = '21:07'
const TIME_12 = '9:07'
const TIME_12_SUFFIX = 'PM'

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
  const reduce = useReducedMotion()

  const activate = useCallback(() => setHovered(true), [])
  const deactivate = useCallback(() => setHovered(false), [])

  const [hh, mm] = (is24h ? TIME_24 : TIME_12).split(':')

  return (
    <div
      style={{ position: 'absolute', left: x, top: y, width: w, height: h }}
      onMouseEnter={activate}
      onMouseLeave={deactivate}
      onFocus={activate}
      onBlur={deactivate}
    >
      <RoomObject
        label={label}
        showTooltip={hovered}
        onActivate={activate}
        onDeactivate={deactivate}
        onClick={onToggle}
        tabIndex={0}
      >
        {/* Plain <img>, NOT motion.img — the clock must not lift on hover. */}
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
        {/* LED digits, skewed onto the face plane. Emissive — not dimmed by
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
          {hh}
          <span className={reduce ? undefined : 'clock-colon'} style={{ position: 'relative', top: '-1px' }}>
            :
          </span>
          {mm}
          {!is24h && <span style={{ fontSize: '6px', marginLeft: '2px' }}>{TIME_12_SUFFIX}</span>}
        </div>
      </RoomObject>
    </div>
  )
}
