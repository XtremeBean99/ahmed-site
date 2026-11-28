'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'

/** Art size of every frame (scripts/draw-gurtle.mjs). */
export const GURTLE_W = 44
export const GURTLE_H = 30

export type GurtleMood = 'idle' | 'happy' | 'worried' | 'hide' | 'walk'

const FRAMES = ['idle', 'blink', 'happy', 'worried', 'hide', 'walk-1', 'walk-2'] as const
const src = (f: (typeof FRAMES)[number]) => `/gurtle/gurtle-${f}.png`

/**
 * Gurtle the turtle: the word game's mascot, drawn by scripts/draw-gurtle.mjs.
 * Idle blinks now and then, walk steps in place, happy hops (again each time
 * `beat` changes), worried wobbles, hide is tucked into the shell. Decorative:
 * the game says everything Gurtle "says" in its own live region. Reduced motion
 * keeps the expressions and drops the movement.
 */
export function GurtleMascot({ mood, scale = 2, beat = 0 }: { mood: GurtleMood; scale?: number; beat?: number }) {
  const reduce = useReducedMotion()
  const [blink, setBlink] = useState(false)
  const [step, setStep] = useState(0)

  // Load every frame up front so a change of mood never flashes empty.
  useEffect(() => {
    for (const f of FRAMES) {
      const img = new Image()
      img.src = src(f)
    }
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

  return (
    <div aria-hidden className="relative flex-shrink-0 pointer-events-none" style={{ width: w, height: h + scale * 2 }}>
      {/* A soft shadow on the ground, under the feet */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{
        bottom: 0, width: w * 0.62, height: scale * 3, borderRadius: '50%', backgroundColor: 'rgba(58,48,40,0.18)',
      }} />
      <motion.div key={`${mood}-${beat}`} className="absolute left-0" style={{ top: 0 }} {...motionProps}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src(frame)} alt="" width={w} height={h} draggable={false} style={{ imageRendering: 'pixelated', display: 'block', width: w, height: h }} />
      </motion.div>
    </div>
  )
}
