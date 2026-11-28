'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { GURTLE_LOOKS, useGurtleLook, type GurtleLook } from '@/lib/games/gurtle-look'
import { loadSprites, spriteSrc } from '@/lib/room/sprites'

/** Art size of every frame (scripts/draw-gurtle.mjs). */
export const GURTLE_W = 44
export const GURTLE_H = 30

export type GurtleMood = 'idle' | 'happy' | 'worried' | 'hide' | 'walk'

const FRAMES = ['idle', 'blink', 'happy', 'worried', 'hide', 'walk-1', 'walk-2'] as const
const src = (look: GurtleLook, f: (typeof FRAMES)[number]) => `/gurtle/${look}-${f}.png`

interface GurtleMascotProps {
  mood: GurtleMood
  scale?: number
  /** Bump to play the mood's reaction again. */
  beat?: number
  /** Makes the mascot a button (the game's own mascot: a tap swaps Gurtle and Jurtle). */
  onTap?: () => void
  tapLabel?: string
}

/**
 * Gurtle the turtle (or Jurtle, the pink look, whichever the visitor last
 * clicked into: lib/games/gurtle-look): the word game's mascot, drawn by
 * scripts/draw-gurtle.mjs. Idle blinks now and then, walk steps in place, happy
 * hops (again each time `beat` changes), worried wobbles, hide is tucked into
 * the shell. Decorative unless `onTap` is given: the game says everything the
 * mascot "says" in its own live region. Reduced motion keeps the expressions
 * and drops the movement.
 */
export function GurtleMascot({ mood, scale = 2, beat = 0, onTap, tapLabel }: GurtleMascotProps) {
  const reduce = useReducedMotion()
  const look = useGurtleLook()
  const [blink, setBlink] = useState(false)
  const [step, setStep] = useState(0)

  // Load every frame of both looks: a change never flashes empty or refetches.
  useEffect(() => {
    loadSprites(GURTLE_LOOKS.flatMap((l) => FRAMES.map((f) => src(l, f))))
  }, [])

  useEffect(() => {
    if (reduce || mood !== 'idle') return
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true)
        t = setTimeout(() => { setBlink(false); loop() }, 140)
      }, 2200 + Math.random() * 2600)
    }
    loop()
    return () => { clearTimeout(t); setBlink(false) }
  }, [mood, reduce])

  useEffect(() => {
    if (reduce || mood !== 'walk') return
    const id = setInterval(() => setStep((s) => 1 - s), 200)
    return () => clearInterval(id)
  }, [mood, reduce])

  const frame =
    mood === 'walk' ? (reduce ? 'idle' : step ? 'walk-2' : 'walk-1')
      : mood === 'idle' ? (blink ? 'blink' : 'idle')
        : mood

  const w = GURTLE_W * scale
  const h = GURTLE_H * scale
  const motionProps = reduce
    ? {}
    : mood === 'happy'
      ? { animate: { y: [0, -4 * scale, 0, -2 * scale, 0] }, transition: { duration: 0.7, ease: 'easeOut' as const } }
      : mood === 'worried'
        ? { animate: { x: [0, -scale, scale, -scale, 0] }, transition: { duration: 0.4 } }
        : mood === 'walk'
          ? { animate: { y: [0, -scale, 0] }, transition: { duration: 0.4, repeat: Infinity } }
          : { animate: { x: 0, y: 0 } }

  const body = (
    <>
      {/* A soft shadow on the ground, under the feet */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{
        bottom: 0, width: w * 0.62, height: scale * 3, borderRadius: '50%', backgroundColor: 'rgba(58,48,40,0.18)',
      }} />
      <motion.div key={`${mood}-${beat}`} className="absolute left-0" style={{ top: 0 }} {...motionProps}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={spriteSrc(src(look, frame))} alt="" width={w} height={h} draggable={false} style={{ imageRendering: 'pixelated', display: 'block', width: w, height: h }} />
      </motion.div>
    </>
  )
  const size = { width: w, height: h + scale * 2 }

  if (!onTap) {
    return <div aria-hidden className="relative flex-shrink-0 pointer-events-none" style={size}>{body}</div>
  }
  return (
    <button
      type="button"
      aria-label={tapLabel}
      title={tapLabel}
      onClick={(e) => { if (e.detail > 0) e.currentTarget.blur(); onTap() }}
      className="relative flex-shrink-0 cursor-pointer outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#3a2820]"
      style={{ ...size, padding: 0, border: 'none', background: 'none', touchAction: 'manipulation' }}
    >
      {body}
    </button>
  )
}
