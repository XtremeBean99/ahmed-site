'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { RoomObject } from './RoomObject'
import { useLighting, lightingSrc } from '@/lib/room/lighting'
import { TURTLE_RECT } from '@/lib/room/objects'
import { GURTLE_LOOKS, toggleLook, useGurtleLook, type GurtleLook } from '@/lib/games/gurtle-look'

type Frame = 'idle' | 'blink' | 'happy' | 'hide'
const FRAMES: readonly Frame[] = ['idle', 'blink', 'happy', 'hide']
const art = (look: GurtleLook, frame: Frame, hover: boolean) => `/room/turtle-${look}-${frame}${hover ? '-hover' : ''}.png`

/** Into the shell, then out as the other turtle. */
const TUCK_MS = 280
const HAPPY_MS = 1000

/** A 7x6 pixel heart, drawn at 2 stage px a pixel like the room art. */
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...']
const HEART_COLOUR: Record<GurtleLook, string> = { gurtle: '#8ac25a', jurtle: '#f0679a' }

function Heart({ colour }: { colour: string }) {
  return (
    <svg width={14} height={12} viewBox="0 0 7 6" shapeRendering="crispEdges" style={{ display: 'block', filter: 'drop-shadow(1px 1px 0 #3d2e1e)' }}>
      {HEART.flatMap((row, y) => row.split('').map((c, x) => (c === 'X' ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={colour} /> : null)))}
    </svg>
  )
}

interface RoomGurtleProps {
  /** The hotspot's name, per look ("Gurtle the turtle, give him a tap"). */
  labels: Record<GurtleLook, string>
  /** After a swap: Room plays the twinkle and shows a line. */
  onSwap: (look: GurtleLook) => void
}

/**
 * Gurtle, the word game's mascot, on the rug (art from scripts/draw-gurtle.mjs).
 * He blinks now and then; a click tucks him into his shell and he comes out as
 * Jurtle (pink shell, bow), or back again. The look is shared with the desk
 * icon and the game (lib/games/gurtle-look). Reduced motion keeps the swap and
 * drops the hop and the hearts. Renders after mount, so the stored look shows
 * from the first frame.
 */
export function RoomGurtle({ labels, onSwap }: RoomGurtleProps) {
  const look = useGurtleLook()
  const lighting = useLighting()
  const reduce = useReducedMotion()
  const [mounted, setMounted] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pose, setPose] = useState<Exclude<Frame, 'blink'>>('idle')
  const [blink, setBlink] = useState(false)
  const [swaps, setSwaps] = useState(0)
  const busy = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    setMounted(true)
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  // Warm every frame of both looks for the current lighting, so a swap never flashes.
  useEffect(() => {
    for (const l of GURTLE_LOOKS) for (const f of FRAMES) for (const h of [false, true]) new window.Image().src = lightingSrc(art(l, f, h), lighting)
  }, [lighting])

  useEffect(() => {
    if (reduce || pose !== 'idle') return
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true)
        t = setTimeout(() => { setBlink(false); loop() }, 150)
      }, 2600 + Math.random() * 3200)
    }
    loop()
    return () => { clearTimeout(t); setBlink(false) }
  }, [pose, reduce])

  const swap = useCallback(() => {
    if (busy.current) return
    busy.current = true
    setPose('hide')
    timers.current.push(setTimeout(() => {
      const next = toggleLook()
      setPose('happy')
      setSwaps((n) => n + 1)
      onSwap(next)
      timers.current.push(setTimeout(() => { setPose('idle'); busy.current = false }, HAPPY_MS))
    }, reduce ? 0 : TUCK_MS))
  }, [onSwap, reduce])

  if (!mounted) return null
  const frame: Frame = pose === 'idle' && blink ? 'blink' : pose

  return (
    <div
      style={{ position: 'absolute', left: TURTLE_RECT.x, top: TURTLE_RECT.y, width: TURTLE_RECT.w, height: TURTLE_RECT.h }}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true) }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false) }}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <RoomObject
        label={labels[look]}
        showTooltip={hovered}
        onActivate={() => setHovered(true)}
        onDeactivate={() => setHovered(false)}
        onClick={swap}
      >
        <motion.div
          key={swaps}
          animate={reduce || swaps === 0 ? { y: 0 } : { y: [0, -12, 0, -4, 0] }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightingSrc(art(look, frame, hovered), lighting)}
            alt=""
            draggable={false}
            width={TURTLE_RECT.w}
            height={TURTLE_RECT.h}
            // Drawn facing right; on the rug he faces into the room.
            style={{ display: 'block', imageRendering: 'pixelated', transform: 'scaleX(-1)' }}
          />
        </motion.div>
      </RoomObject>
      {/* Hearts float up from the head after a swap (emissive, never graded). */}
      {swaps > 0 && !reduce && (
        <div key={swaps} aria-hidden className="absolute pointer-events-none" style={{ left: 2, top: -6, width: 48, height: 40 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ left: i * 14, bottom: 0 }}
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: [0, 1, 1, 0], y: -34 - i * 4 }}
              transition={{ duration: 1.1, delay: 0.05 + i * 0.12, ease: 'easeOut' }}
            >
              <Heart colour={HEART_COLOUR[look]} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
