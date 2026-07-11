'use client'

import { useEffect, useMemo, useState } from 'react'
import { WINDOW_GLASS } from '@/lib/room/objects'
import { mapWeather, type Weather } from '@/lib/room/weather'

/**
 * Decorative precipitation over the room window. Fetches the (cached, fail-soft)
 * Canberra weather once, maps it to rain/snow/clear, and renders a CSS particle
 * field clipped to the window glass. Always visible when it is precipitating.
 * aria-hidden + pointer-events:none; sits behind the bonsai in Room's z-order.
 */
export function RoomWeather() {
  const [weather, setWeather] = useState<Weather>({ kind: 'clear', heavy: false })

  useEffect(() => {
    let cancelled = false
    fetch('/api/weather')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setWeather(mapWeather(Number(d?.code) || 0, Number(d?.precip) || 0))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const count = weather.kind === 'clear' ? 0 : weather.heavy ? 42 : 18

  // Generated once per (kind,count) so the field is stable across re-renders.
  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        delay: -Math.random() * 4,
        dur: weather.kind === 'snow' ? 4 + Math.random() * 4 : 0.6 + Math.random() * 0.5,
        size: 2 + Math.random() * 2,
      })),
    [count, weather.kind],
  )

  if (weather.kind === 'clear') return null

  return (
    <div
      aria-hidden
      className="absolute pointer-events-none overflow-hidden"
      style={{ left: WINDOW_GLASS.x, top: WINDOW_GLASS.y, width: WINDOW_GLASS.w, height: WINDOW_GLASS.h }}
    >
      {particles.map((p, i) =>
        weather.kind === 'rain' ? (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${p.left}%`,
              top: -12,
              width: 1,
              height: 12,
              background: 'linear-gradient(rgba(200,210,230,0), rgba(200,210,230,0.45))',
              animation: `room-rain ${p.dur}s linear ${p.delay}s infinite`,
            }}
          />
        ) : (
          <span
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${p.left}%`,
              top: -6,
              width: p.size,
              height: p.size,
              background: 'rgba(240,240,250,0.85)',
              animation: `room-snow ${p.dur}s linear ${p.delay}s infinite`,
            }}
          />
        ),
      )}
    </div>
  )
}
