'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { useLighting, lightingSrc } from '@/lib/room/lighting'
import { CAT_FRAMES, CAT_SIZE, type CatSpot } from '@/lib/room/objects'

/** How long a click keeps the cat awake before it curls back up. */
const AWAKE_MS = 3500
/** One breath, in or out. */
const BREATH_MS = 1300

interface RoomCatProps {
  label: string
  spot: CatSpot
  /** Woken by a click or Enter: Room plays the sound and counts the discovery. */
  onWake: () => void
}

/**
 * The cat asleep on the bed (art from scripts/draw-cat.mjs). It breathes in a
 * slow two-frame loop with a few Zs drifting up, wakes for a few seconds when
 * clicked, and sleeps somewhere else on the bed from one visit to the next.
 * Hover and focus show the room's highlight outline, like every other object.
 */
export function RoomCat({ label, spot, onWake }: RoomCatProps) {
  const lighting = useLighting()
  const reduce = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [awake, setAwake] = useState(false)
  const [breath, setBreath] = useState(0)
  const wakeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (awake || reduce) return
    const id = setInterval(() => setBreath((b) => 1 - b), BREATH_MS)
    return () => clearInterval(id)
  }, [awake, reduce])

  // Warm every frame for the current lighting so a swap never flashes.
  useEffect(() => {
    for (const f of [...CAT_FRAMES.sleep, CAT_FRAMES.awake]) {
      for (const src of [f.rest, f.hover]) {
        const img = new window.Image()
        img.src = lightingSrc(src, lighting)
      }
    }
  }, [lighting])

  useEffect(() => () => clearTimeout(wakeTimer.current), [])

  const wake = useCallback(() => {
    setAwake(true)
    clearTimeout(wakeTimer.current)
    wakeTimer.current = setTimeout(() => setAwake(false), AWAKE_MS)
    onWake()
  }, [onWake])

  const frame = awake ? CAT_FRAMES.awake : CAT_FRAMES.sleep[breath]
  const src = lightingSrc(hovered ? frame.hover : frame.rest, lighting)

  return (
    <div
      style={{ position: 'absolute', left: spot.x, top: spot.y, width: CAT_SIZE.w, height: CAT_SIZE.h }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false) }}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <RoomObject
        label={label}
        showTooltip={hovered}
        onActivate={() => setHovered(true)}
        onDeactivate={() => setHovered(false)}
        onClick={wake}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          width={CAT_SIZE.w}
          height={CAT_SIZE.h}
          style={{ display: 'block', imageRendering: 'pixelated' }}
        />
      </RoomObject>
      {/* Zs drift up from the head while it sleeps (emissive, never graded). */}
      {!awake && !reduce && (
        <div aria-hidden className="absolute pointer-events-none" style={{ left: 18, top: -6, width: 30, height: 40 }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="cat-z absolute"
              style={{
                left: i * 6,
                bottom: 0,
                fontSize: 9 + i * 2,
                animationDelay: `${i * 1.1}s`,
                fontFamily: 'var(--font-pixel), "Courier New", monospace',
                color: '#e8d5b0',
                textShadow: '1px 1px 0 #3d2e1e',
              }}
            >
              z
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
