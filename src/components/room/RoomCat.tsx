'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { RoomObject } from './RoomObject'
import { useLighting, lightingSrc } from '@/lib/room/lighting'
import { CAT_FRAMES, CAT_SIZE, type CatSpot } from '@/lib/room/objects'
import { CAT_BOWL, feedingPose, feedingTimeline, timelineMs, type CatSprite } from '@/lib/room/cat-feeding'

/** How long a click keeps the cat awake before it curls back up. */
const AWAKE_MS = 3500
/** One breath, in or out. */
const BREATH_MS = 1300
/** Between filling the bowl and the cat getting up. */
const NOTICE_MS = 500
const TICK_MS = 40

const SPRITES: Record<Exclude<CatSprite, 'awake'>, string> = {
  'walk-1': '/room/cat-walk-1.png',
  'walk-2': '/room/cat-walk-2.png',
  'walk-3': '/room/cat-walk-3.png',
  'walk-4': '/room/cat-walk-4.png',
  crouch: '/room/cat-crouch.png',
  leap: '/room/cat-leap.png',
  'eat-1': '/room/cat-eat-1.png',
  'eat-2': '/room/cat-eat-2.png',
}
const BOWL_ART = ['empty', 'half', 'full'].map((s) => ({ rest: `/room/cat-bowl-${s}.png`, hover: `/room/cat-bowl-${s}-hover.png` }))

type Phase =
  | { kind: 'sleep' }
  | { kind: 'awake' }
  | { kind: 'noticed' }
  | { kind: 'out'; started: number }

interface RoomCatProps {
  label: string
  bowlLabel: string
  spot: CatSpot
  /** Woken by a click or Enter: Room plays the sound and counts the discovery. */
  onWake: () => void
  /** The bowl was filled: Room plays the kibble sound. */
  onFeed: () => void
  /** The cat reached the bowl and started eating: Room purrs, toasts and counts it. */
  onEat: () => void
}

/**
 * The cat asleep on the bed (art from scripts/draw-cat.mjs). It breathes in a
 * slow two-frame loop with a few Zs drifting up, wakes for a few seconds when
 * clicked, and sleeps somewhere else on the bed from one visit to the next.
 * Hover and focus show the room's highlight outline, like every other object.
 *
 * Its bowl sits on the floor by the bed. Filling it brings the cat down: it sits up,
 * walks to the edge of the mattress, jumps down, walks over and eats (the bowl empties
 * as it goes), then jumps back up and curls up where it was (lib/room/cat-feeding.ts).
 * Reduced motion skips the walking and jumping.
 */
export function RoomCat({ label, bowlLabel, spot, onWake, onFeed, onEat }: RoomCatProps) {
  const lighting = useLighting()
  const reduce = useReducedMotion()
  const [hovered, setHovered] = useState(false)
  const [bowlHovered, setBowlHovered] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'sleep' })
  const [breath, setBreath] = useState(0)
  const [now, setNow] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const asleep = phase.kind === 'sleep'
  const away = phase.kind === 'out'
  const timeline = useMemo(() => feedingTimeline(spot, !!reduce), [spot, reduce])

  useEffect(() => {
    if (!asleep || reduce) return
    const id = setInterval(() => setBreath((b) => 1 - b), BREATH_MS)
    return () => clearInterval(id)
  }, [asleep, reduce])

  // One clock drives the outing while the cat is off its spot.
  useEffect(() => {
    if (!away) return
    setNow(performance.now())
    const id = setInterval(() => setNow(performance.now()), TICK_MS)
    return () => clearInterval(id)
  }, [away])

  const pose = phase.kind === 'out' ? feedingPose(timeline, now - phase.started) : null

  // Tell Room when the eating starts, and go back to sleep when the outing is over.
  const ateRef = useRef(false)
  useEffect(() => {
    if (!pose) { ateRef.current = false; return }
    if (pose.eating && !ateRef.current) { ateRef.current = true; onEat() }
    if (pose.done || (phase.kind === 'out' && now - phase.started > timelineMs(timeline) + 200)) setPhase({ kind: 'sleep' })
  }, [pose, phase, now, timeline, onEat])

  // Warm every frame for the current lighting so a swap never flashes.
  useEffect(() => {
    const srcs = [
      ...[...CAT_FRAMES.sleep, CAT_FRAMES.awake].flatMap((f) => [f.rest, f.hover]),
      ...Object.values(SPRITES), ...BOWL_ART.flatMap((b) => [b.rest, b.hover]),
    ]
    for (const src of srcs) new window.Image().src = lightingSrc(src, lighting)
  }, [lighting])

  useEffect(() => () => clearTimeout(timer.current), [])

  const wake = useCallback(() => {
    if (phase.kind !== 'sleep' && phase.kind !== 'awake') return
    setPhase({ kind: 'awake' })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setPhase((p) => (p.kind === 'awake' ? { kind: 'sleep' } : p)), AWAKE_MS)
    onWake()
  }, [phase.kind, onWake])

  const feed = useCallback(() => {
    if (phase.kind !== 'sleep' && phase.kind !== 'awake') return
    clearTimeout(timer.current)
    setBowlHovered(false) // the tooltip would hide the cat at the bowl
    setPhase({ kind: 'noticed' })
    onFeed()
    timer.current = setTimeout(() => setPhase({ kind: 'out', started: performance.now() }), NOTICE_MS)
  }, [phase.kind, onFeed])

  // What is in the bowl: full from the moment it is filled until the meal runs it down.
  const food = phase.kind === 'noticed' ? 2 : pose ? pose.food : 0
  const bowl = BOWL_ART[food]

  // Where the cat is, which way it faces and which frame shows.
  let pos = spot
  let src: string
  let facingRight = false
  if (pose) {
    pos = pose.at
    facingRight = pose.facingRight
    src = pose.sprite === 'awake' ? CAT_FRAMES.awake.rest : SPRITES[pose.sprite]
  } else {
    const frame = phase.kind === 'sleep' ? CAT_FRAMES.sleep[breath] : CAT_FRAMES.awake
    src = hovered ? frame.hover : frame.rest
  }

  return (
    <>
      {/* The cat, on the bed or on its way. Off the bed it is scenery, not a button. */}
      <div
        style={{ position: 'absolute', left: pos.x, top: pos.y, width: CAT_SIZE.w, height: CAT_SIZE.h, zIndex: away ? 5 : undefined }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true) }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHovered(false) }}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
      >
        {away ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lightingSrc(src, lighting)}
            alt=""
            aria-hidden
            draggable={false}
            width={CAT_SIZE.w}
            height={CAT_SIZE.h}
            style={{ display: 'block', imageRendering: 'pixelated', transform: facingRight ? 'scaleX(-1)' : undefined }}
          />
        ) : (
          <RoomObject
            label={label}
            showTooltip={hovered}
            onActivate={() => setHovered(true)}
            onDeactivate={() => setHovered(false)}
            onClick={wake}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightingSrc(src, lighting)}
              alt=""
              draggable={false}
              width={CAT_SIZE.w}
              height={CAT_SIZE.h}
              style={{ display: 'block', imageRendering: 'pixelated' }}
            />
          </RoomObject>
        )}
        {/* Zs drift up from the head while it sleeps (emissive, never graded). */}
        {asleep && !reduce && (
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

      {/* The bowl, drawn over the cat so the rim sits in front of its chin. */}
      <div
        style={{ position: 'absolute', left: CAT_BOWL.x, top: CAT_BOWL.y, width: CAT_BOWL.w, height: CAT_BOWL.h, zIndex: away ? 6 : undefined }}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setBowlHovered(true) }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setBowlHovered(false) }}
        onFocus={() => setBowlHovered(true)}
        onBlur={() => setBowlHovered(false)}
      >
        <RoomObject
          label={bowlLabel}
          showTooltip={bowlHovered}
          onActivate={() => setBowlHovered(true)}
          onDeactivate={() => setBowlHovered(false)}
          onClick={feed}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightingSrc(bowlHovered && food === 0 ? bowl.hover : bowl.rest, lighting)}
            alt=""
            draggable={false}
            width={CAT_BOWL.w}
            height={CAT_BOWL.h}
            style={{ display: 'block', imageRendering: 'pixelated' }}
          />
        </RoomObject>
      </div>
    </>
  )
}
