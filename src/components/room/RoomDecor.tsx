'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RoomObject } from './RoomObject'
import { useLighting } from '@/lib/room/lighting'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { calendarDate } from '@/lib/room/calendar'
import {
  COBWEB_RECT,
  GARLAND_RECT,
  PUMPKIN_RECT,
  decorFor,
  decorOverride,
  type DecorId,
} from '@/lib/room/seasonal'
import { drawCobweb, drawFairyLights, drawHeartGarland, drawPumpkin } from '@/lib/room/decor-art'

type Rect = { x: number; y: number; w: number; h: number }

/** A canvas at a stage rect, one canvas pixel per stage pixel, redrawn when `draw` changes. */
function PixelCanvas({ rect, draw }: { rect: Rect; draw: () => Uint8ClampedArray<ArrayBuffer> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) ctx.putImageData(new ImageData(draw(), rect.w, rect.h), 0, 0)
  }, [draw, rect.w, rect.h])
  return (
    <canvas
      ref={ref}
      width={rect.w}
      height={rect.h}
      aria-hidden
      className="block"
      style={{ width: rect.w, height: rect.h, imageRendering: 'pixelated' }}
    />
  )
}

/** A frame counter ticking every `ms`, or null under reduced motion (hold still). */
function useTicker(ms: number, enabled: boolean): number | null {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => setFrame((f) => f + 1), ms)
    return () => clearInterval(id)
  }, [ms, enabled])
  return enabled ? frame : null
}

function Decorative({ rect, children }: { rect: Rect; children: React.ReactNode }) {
  return (
    <div aria-hidden className="pointer-events-none" style={{ position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h }}>
      {children}
    </div>
  )
}

function FairyLights({ lampOn }: { lampOn: boolean }) {
  const light = useLighting()
  const reduce = useReducedMotion()
  const frame = useTicker(650, !reduce)
  const draw = useCallback(() => drawFairyLights({ frame, light, lampOff: !lampOn }), [frame, light, lampOn])
  return <Decorative rect={GARLAND_RECT}><PixelCanvas rect={GARLAND_RECT} draw={draw} /></Decorative>
}

function HeartGarland({ lampOn }: { lampOn: boolean }) {
  const light = useLighting()
  const draw = useCallback(() => drawHeartGarland({ light, lampOff: !lampOn }), [light, lampOn])
  return <Decorative rect={GARLAND_RECT}><PixelCanvas rect={GARLAND_RECT} draw={draw} /></Decorative>
}

function Cobweb({ lampOn }: { lampOn: boolean }) {
  const light = useLighting()
  const draw = useCallback(() => drawCobweb({ light, lampOff: !lampOn }), [light, lampOn])
  return <Decorative rect={COBWEB_RECT}><PixelCanvas rect={COBWEB_RECT} draw={draw} /></Decorative>
}

function Pumpkin({ label, lampOn, onToggle }: { label: string; lampOn: boolean; onToggle: (lit: boolean) => void }) {
  const light = useLighting()
  const reduce = useReducedMotion()
  const [lit, setLit] = useState(true)
  const [hovered, setHovered] = useState(false)
  const [highlight, setHighlight] = useState<0 | 1 | 2>(0)
  const frame = useTicker(170, lit && !reduce)

  // The hover outline grows 1 px, then 2, like the sprites' highlight frames.
  useEffect(() => {
    if (!hovered) { setHighlight(0); return }
    setHighlight(1)
    const id = setTimeout(() => setHighlight(2), 70)
    return () => clearTimeout(id)
  }, [hovered])

  // The flicker wanders rather than cycling, so it never reads as a loop.
  const flicker = frame === null ? 0 : (frame * 7 + (frame >> 2)) % 3
  const draw = useCallback(
    () => drawPumpkin({ lit, frame: flicker, highlight, light, lampOff: !lampOn }),
    [lit, flicker, highlight, light, lampOn],
  )
  const dark = light === 'night' || !lampOn

  return (
    <RoomObject
      label={label}
      showTooltip={hovered}
      onActivate={() => setHovered(true)}
      onDeactivate={() => setHovered(false)}
      onClick={() => { const next = !lit; setLit(next); onToggle(next) }}
      tabIndex={0}
      style={{ position: 'absolute', left: PUMPKIN_RECT.x, top: PUMPKIN_RECT.y, width: PUMPKIN_RECT.w, height: PUMPKIN_RECT.h }}
    >
      {/* Candlelight spilling onto the sill and the window frame. */}
      {lit && (
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{
            left: -30, top: -26, width: PUMPKIN_RECT.w + 60, height: PUMPKIN_RECT.h + 44,
            background: 'radial-gradient(closest-side, rgba(255,170,60,0.55), rgba(255,140,40,0.18) 55%, transparent)',
            mixBlendMode: 'screen',
            opacity: (dark ? 0.85 : light === 'day' ? 0.25 : 0.5) * (flicker === 1 ? 0.85 : 1),
            transition: reduce ? 'none' : 'opacity 0.15s linear',
          }}
        />
      )}
      <div className="relative">
        <PixelCanvas rect={PUMPKIN_RECT} draw={draw} />
      </div>
    </RoomObject>
  )
}

interface RoomDecorProps {
  lampOn: boolean
  pumpkinLabel: string
  onPumpkin: (lit: boolean) => void
}

/**
 * The seasonal decorations up on the visitor's date (seasonal.ts): Halloween's
 * jack-o'-lantern and cobweb, Christmas fairy lights, Valentine's hearts.
 * Nothing renders until mount, so SSR and hydration agree.
 */
export function RoomDecor({ lampOn, pumpkinLabel, onPumpkin }: RoomDecorProps) {
  const [decor, setDecor] = useState<DecorId | null>(null)

  useEffect(() => {
    const refresh = () => {
      const forced = decorOverride(window.location.search)
      setDecor(forced !== undefined ? forced : decorFor(calendarDate(new Date())))
    }
    refresh()
    // A tab left open across a season boundary catches up on return.
    const onVis = () => { if (!document.hidden) refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (decor === 'halloween') {
    return (
      <>
        <Cobweb lampOn={lampOn} />
        <Pumpkin label={pumpkinLabel} lampOn={lampOn} onToggle={onPumpkin} />
      </>
    )
  }
  if (decor === 'christmas') return <FairyLights lampOn={lampOn} />
  if (decor === 'valentines') return <HeartGarland lampOn={lampOn} />
  return null
}
