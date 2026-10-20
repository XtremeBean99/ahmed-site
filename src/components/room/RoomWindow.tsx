'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { mapWeather, type Weather } from '@/lib/room/weather'
import type { LightingState } from '@/lib/room/lighting'
import {
  WINDOW_VIEW,
  PRECIP_FRAMES,
  PRECIP_FRAME_MS,
  TWINKLE_FRAMES,
  TWINKLE_FRAME_MS,
  precipSrcs,
  twinkleSrc,
  viewSrc,
  weatherFromSearch,
} from '@/lib/room/window-view'

const layer = { position: 'absolute', inset: 0, width: '100%', height: '100%', imageRendering: 'pixelated' } as const

/**
 * The city through the window, in pixel art for the current lighting state and the
 * (cached, fail-soft) Canberra weather: a still view, then rain or snow and the night's
 * twinkle as looping sprite frames. When the lighting changes, the old view fades out
 * over the new one with the room's `lighting-fade`. Reduced motion holds every layer on
 * its first frame. Decorative: aria-hidden, no pointer events; renders before the bonsai.
 */
export function RoomWindow({ light, prevLight }: { light: LightingState; prevLight: LightingState | null }) {
  const [weather, setWeather] = useState<Weather>({ kind: 'clear', heavy: false })
  const [precipFrame, setPrecipFrame] = useState(0)
  const [twinkleFrame, setTwinkleFrame] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const forced = weatherFromSearch(window.location.search)
    if (forced) { setWeather(forced); return }
    let cancelled = false
    fetch('/api/weather')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setWeather(mapWeather(Number(d?.code) || 0, Number(d?.precip) || 0))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (reduce || weather.kind === 'clear') return
    const n = PRECIP_FRAMES[weather.kind]
    const id = setInterval(() => setPrecipFrame((f) => (f + 1) % n), PRECIP_FRAME_MS[weather.kind])
    return () => clearInterval(id)
  }, [reduce, weather.kind])

  const twinkling = light === 'night' && weather.kind === 'clear'
  useEffect(() => {
    if (reduce || !twinkling) return
    const id = setInterval(() => setTwinkleFrame((f) => (f + 1) % TWINKLE_FRAMES), TWINKLE_FRAME_MS)
    return () => clearInterval(id)
  }, [reduce, twinkling])

  // Warm the cache for the looping frames so the first loop does not stutter.
  useEffect(() => {
    const srcs = weather.kind === 'clear' ? [] : Array.from({ length: PRECIP_FRAMES[weather.kind] }, (_, f) => precipSrcs(weather, f)).flat()
    if (twinkling) srcs.push(twinkleSrc(1))
    for (const src of srcs) new window.Image().src = src
  }, [weather, twinkling])

  return (
    <div
      aria-hidden
      className="absolute pointer-events-none"
      style={{ left: WINDOW_VIEW.x, top: WINDOW_VIEW.y, width: WINDOW_VIEW.w, height: WINDOW_VIEW.h }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={viewSrc(light, weather.kind)} alt="" draggable={false} style={layer} />
      {prevLight && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={viewSrc(prevLight, weather.kind)} alt="" draggable={false} className="lighting-fade" style={layer} />
      )}
      {twinkling && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={twinkleSrc(twinkleFrame)} alt="" draggable={false} style={layer} />
      )}
      {precipSrcs(weather, precipFrame).map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt="" draggable={false} style={layer} />
      ))}
    </div>
  )
}
