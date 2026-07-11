'use client'

import { useMemo } from 'react'
import { WINDOW_GLASS } from '@/lib/room/objects'
import type { LightingState } from '@/lib/room/lighting'

// Star positions as fractions of the glass (kept in the upper pane).
const STARS = [
  { x: 0.14, y: 0.10 },
  { x: 0.30, y: 0.24 },
  { x: 0.52, y: 0.08 },
  { x: 0.68, y: 0.20 },
  { x: 0.82, y: 0.13 },
  { x: 0.42, y: 0.32 },
]

/**
 * Emissive moon + a few twinkling stars in the window, shown only at the `night`
 * lighting state. Never lighting-graded (plain positioned divs). Decorative.
 */
export function RoomNightSky({ light }: { light: LightingState }) {
  const stars = useMemo(() => STARS.map((s, i) => ({ ...s, delay: -i * 0.7 })), [])
  if (light !== 'night') return null

  return (
    <div
      aria-hidden
      className="absolute pointer-events-none overflow-hidden"
      style={{ left: WINDOW_GLASS.x, top: WINDOW_GLASS.y, width: WINDOW_GLASS.w, height: WINDOW_GLASS.h }}
    >
      {/* Moon */}
      <div
        className="absolute rounded-full"
        style={{
          right: 26,
          top: 16,
          width: 32,
          height: 32,
          background: 'radial-gradient(circle at 38% 38%, #fdf6d8 0%, #e9e2c0 55%, #cfc79f 100%)',
          boxShadow: '0 0 16px 5px rgba(245,240,210,0.35)',
        }}
      />
      {/* Stars */}
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.x * 100}%`,
            top: `${s.y * 100}%`,
            width: 2,
            height: 2,
            background: '#fffbe8',
            boxShadow: '0 0 3px 1px rgba(255,251,232,0.8)',
            animation: `room-twinkle ${2.4 + (i % 3) * 0.6}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
