// src/components/room/mahjong/AutoTable.tsx
'use client'

/**
 * The automatic mahjong table, played before each 4-player hand: last hand's
 * tiles sweep into the centre hatch while the console turns, the four walls rise
 * two tiles high from the slots along each side, the dealer rolls the dice, and
 * the deal comes off the wall at the break in blocks of four (then one each) to
 * the four racks, yours face up. Seen from above, like the table below it.
 *
 * Decorative (aria-hidden) apart from its status line. A click, Enter, Space or
 * Escape skips it; with reduced motion the hand starts at once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArcadeButton, ARCADE, PIXEL_FONT } from '../DeskArcade'
import { useSfx } from '../RoomSfxProvider'
import { ALL_KINDS, compareTiles, mulberry32, tileCode } from '@/lib/games/mahjong-tiles'
import { MUTED, TABLE_BG } from './chrome'
import { TileView } from './tile-art'

export interface AutoTableLabels {
  shuffling: string
  walls: string
  dice: string
  dealing: string
  skip: string
}

const STACKS = 18
/** Timeline in ms at normal speed: sweep and shuffle, walls rise, dice, deal, fade. */
const T = { walls: 950, dice: 1700, deal: 2250, step: 85, fly: 260, fade: 260 }
const SWEPT = 26

const RIM = '#4a3222'
const RIM_HI = '#6a4a32'
const FELT = '#2f5a3c'
const SLOT = 'rgba(0,0,0,0.28)'

type Pt = { x: number; y: number }

/** Dice faces as 3x3 pip grids. */
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }

function Die({ face, size }: { face: number; size: number }) {
  const p = Math.max(2, Math.round(size / 5))
  return (
    <div style={{ width: size, height: size, backgroundColor: '#f4ecd8', border: '1px solid #2a2520', borderRadius: 2, position: 'relative', boxShadow: '1px 1px 0 rgba(0,0,0,0.4)' }}>
      {PIPS[face].map((i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            width: p,
            height: p,
            left: ((i % 3) + 0.5) * (size / 3) - p / 2 - 1,
            top: (Math.floor(i / 3) + 0.5) * (size / 3) - p / 2 - 1,
            backgroundColor: face === 1 || face === 4 ? ARCADE.rust : '#2a2520',
          }}
        />
      ))}
    </div>
  )
}

export function AutoTable({
  seed,
  dealer,
  hand,
  speed,
  w,
  h,
  portrait,
  labels,
  onDone,
}: {
  seed: number
  /** The dealer's seat: the break is in the wall in front of them and they are dealt first. */
  dealer: number
  /** Your dealt hand, shown face up on your rack as it arrives. */
  hand: string[]
  speed: 'normal' | 'fast'
  w: number
  h: number
  portrait: boolean
  labels: AutoTableLabels
  onDone: () => void
}) {
  const reduce = useReducedMotion()
  const { tone } = useSfx()
  const k = speed === 'fast' ? 0.6 : 1
  const doneRef = useRef(false)
  // The parent passes a fresh onDone each render; the timeline must not restart for it.
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])
  const finish = useCallback(() => {
    if (doneRef.current) return
    doneRef.current = true
    onDoneRef.current()
  }, [])

  /* ---------- Geometry ---------- */
  const S = Math.max(200, Math.floor(portrait ? Math.min(w - 12, h - 76) : Math.min(h - 10, w - 220)))
  const L = Math.floor(S * 0.68)
  const tw = Math.floor(L / STACKS) - 1
  const th = Math.round(tw * 1.3)
  const pitch = tw + 1
  const r0 = 5
  const m = r0 + th + 9 + th / 2
  const start = (S - STACKS * pitch) / 2

  // The 72 stacks counter-clockwise from your left: your wall, then the right player's, the top's, the left's.
  const stacks = useMemo(() => {
    const out: { pos: Pt; vertical: boolean; side: number }[] = []
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < STACKS; i++) {
        const along = start + i * pitch
        if (side === 0) out.push({ pos: { x: along, y: S - m - th / 2 }, vertical: false, side })
        else if (side === 1) out.push({ pos: { x: S - m - th / 2, y: S - along - tw }, vertical: true, side })
        else if (side === 2) out.push({ pos: { x: S - along - tw, y: m - th / 2 }, vertical: false, side })
        else out.push({ pos: { x: m - th / 2, y: along }, vertical: true, side })
      }
    }
    return out
  }, [S, m, th, tw, pitch, start])

  /* ---------- The run: dice, break, deal order ---------- */
  const plan = useMemo(() => {
    const rng = mulberry32(seed ^ 0x5bd1e995)
    const roll = (): [number, number] => [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)]
    const dice = roll()
    // The faces the dice tumble through before they land.
    const tumble = Array.from({ length: 7 }, roll)
    const swept = Array.from({ length: SWEPT }, () => ({
      code: tileCode(ALL_KINDS[Math.floor(rng() * ALL_KINDS.length)]),
      x: 0.22 + rng() * 0.56,
      y: 0.22 + rng() * 0.56,
      rot: Math.round(rng() * 4) * 90 + (rng() - 0.5) * 30,
      delay: rng() * 380,
    }))
    // Count the dice total along the dealer's wall from its right end, and break there.
    const total = dice[0] + dice[1]
    const breakAt = dealer * STACKS + (STACKS - 1 - ((total - 1) % STACKS))
    // Layers come off clockwise from the break: [stack, layer] with layer 1 the top tile.
    const take: [number, number][] = []
    for (let i = 0; i < 40; i++) {
      const st = (breakAt - i + 72 * 4) % 72
      take.push([st, 1], [st, 0])
    }
    const removed = new Map<string, number>()
    const flights: { from: Pt; seat: number; at: number; n: number; first: number }[] = []
    const given = [0, 0, 0, 0]
    let cursor = 0
    let step = 0
    for (let round = 0; round < 4; round++) {
      for (let j = 0; j < 4; j++) {
        const seat = (dealer + j) % 4
        const n = round < 3 ? 4 : 1
        const at = T.deal + step * T.step
        const layers = take.slice(cursor, cursor + n)
        cursor += n
        for (const [st, layer] of layers) removed.set(`${st}-${layer}`, at)
        flights.push({ from: stacks[layers[0][0]].pos, seat, at, n, first: given[seat] })
        given[seat] += n
        step++
      }
    }
    return { dice, tumble, swept, removed, flights, end: T.deal + step * T.step + T.fly + 120 }
  }, [seed, dealer, stacks])

  /* ---------- Racks: where each seat's dealt tiles land ---------- */
  const rack = useCallback(
    (seat: number, i: number): Pt & { vertical: boolean } => {
      const along = (S - 13 * pitch) / 2 + i * pitch
      if (seat === 0) return { x: along, y: S - r0 - th, vertical: false }
      if (seat === 1) return { x: S - r0 - th, y: S - along - tw, vertical: true }
      if (seat === 2) return { x: S - along - tw, y: r0, vertical: false }
      return { x: r0, y: along, vertical: true }
    },
    [S, pitch, th, tw],
  )
  const yours = useMemo(() => [...hand].sort(compareTiles).slice(0, 13), [hand])

  /* ---------- Clock: stage label, dice faces, sounds, the end ---------- */
  const [stage, setStage] = useState<'shuffling' | 'walls' | 'dice' | 'dealing'>('shuffling')
  const [faces, setFaces] = useState<[number, number]>([1, 1])

  useEffect(() => {
    if (reduce) {
      finish()
      return
    }
    const ids: number[] = []
    const at = (ms: number, fn: () => void) => ids.push(window.setTimeout(fn, ms * k))
    tone('shuffle')
    at(T.walls, () => {
      setStage('walls')
      tone('chip', 0.8)
    })
    at(T.dice, () => setStage('dice'))
    plan.tumble.forEach((f, i) => at(T.dice + i * 60, () => setFaces(f)))
    at(T.dice + 440, () => {
      setFaces([plan.dice[0], plan.dice[1]])
      tone('flip')
    })
    at(T.deal, () => setStage('dealing'))
    for (let i = 0; i < plan.flights.length; i += 2) at(plan.flights[i].at, () => tone('deal', 0.9 + (i % 4) * 0.05))
    at(plan.end + T.fade, finish)
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [reduce, k, plan, tone, finish])

  // Any of the usual "go" keys skips; the game underneath hears none of them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      e.stopPropagation()
      e.stopImmediatePropagation()
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        finish()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [finish])

  if (reduce) return null

  const s = (ms: number) => (ms * k) / 1000
  const cx = S / 2
  const hatch = Math.round(S * 0.24)
  const label = labels[stage]
  const font = portrait ? 12 : 10
  const tile = (vertical: boolean) => (vertical ? { w: th, h: tw } : { w: tw, h: th })

  const table = (
    <div
      aria-hidden
      className="relative flex-shrink-0"
      style={{ width: S, height: S, backgroundColor: FELT, border: `5px solid ${RIM}`, borderRadius: 6, boxSizing: 'content-box', boxShadow: `inset 0 0 0 1px ${RIM_HI}, inset 0 0 28px rgba(0,0,0,0.45), 3px 3px 0 rgba(0,0,0,0.35)` }}
    >
      {/* Wall slots along each side */}
      {[0, 1, 2, 3].map((side) => {
        const a = stacks[side * STACKS]
        const b = stacks[side * STACKS + STACKS - 1]
        const x = Math.min(a.pos.x, b.pos.x) - 2
        const y = Math.min(a.pos.y, b.pos.y) - 2
        const { w: sw, h: sh } = tile(a.vertical)
        return (
          <div
            key={side}
            className="absolute"
            style={{ left: x, top: y, width: Math.abs(b.pos.x - a.pos.x) + sw + 4, height: Math.abs(b.pos.y - a.pos.y) + sh + 4, backgroundColor: SLOT, borderRadius: 2 }}
          />
        )
      })}

      {/* Centre console: the hatch the tiles drop into, its turning lid, the dice under the dome */}
      <div className="absolute" style={{ left: cx - hatch / 2, top: cx - hatch / 2, width: hatch, height: hatch, borderRadius: '50%', backgroundColor: '#1a241d', boxShadow: 'inset 0 0 0 2px #0e1510' }} />
      <motion.div
        className="absolute"
        style={{ left: cx - hatch / 2 + 4, top: cx - hatch / 2 + 4, width: hatch - 8, height: hatch - 8, borderRadius: '50%', border: '2px solid #4c6a56', backgroundImage: 'conic-gradient(#35503f 0 25%, #2c4535 0 50%, #35503f 0 75%, #2c4535 0)' }}
        initial={{ rotate: 0 }}
        animate={{ rotate: 540 }}
        transition={{ duration: s(T.dice), ease: [0.3, 0, 0.4, 1] }}
      />
      <motion.div
        className="absolute flex items-center justify-center"
        style={{ left: cx - hatch / 2, top: cx - hatch / 2, width: hatch, height: hatch, gap: Math.max(3, hatch / 12) }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: s(T.dice - 120), duration: s(160) }}
      >
        <Die face={faces[0]} size={Math.max(9, Math.round(hatch / 4))} />
        <Die face={faces[1]} size={Math.max(9, Math.round(hatch / 4))} />
      </motion.div>

      {/* Last hand's tiles, swept into the hatch */}
      {plan.swept.map((t, i) => (
        <motion.div
          key={`s${i}`}
          className="absolute"
          style={{ left: 0, top: 0 }}
          initial={{ x: t.x * S - tw / 2, y: t.y * S - th / 2, rotate: t.rot, scale: 1, opacity: 1 }}
          animate={{ x: cx - tw / 2, y: cx - th / 2, rotate: t.rot + 200, scale: 0.35, opacity: 0 }}
          transition={{ delay: s(t.delay), duration: s(520), ease: 'easeIn' }}
        >
          <TileView code={t.code} w={tw} h={th} depth={1} tip={false} />
        </motion.div>
      ))}

      {/* The walls, two high: the bottom tile rises from the slot, then the top one on it */}
      {stacks.map((st, i) => {
        const along = i % STACKS
        const { w: sw, h: sh } = tile(st.vertical)
        return [0, 1].map((layer) => {
          const gone = plan.removed.get(`${i}-${layer}`)
          return (
            <motion.div
              key={`w${i}-${layer}`}
              className="absolute"
              style={{ left: st.pos.x - layer, top: st.pos.y - layer * 2, zIndex: layer + 1 }}
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: s(T.walls + along * 22 + layer * 110), duration: s(200), ease: 'easeOut' }}
            >
              {/* Taken off the wall when its block is dealt */}
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: gone === undefined ? 1 : 0 }}
                transition={{ delay: s(gone ?? 0), duration: s(60) }}
              >
                <TileView code={null} w={sw} h={sh} depth={1} tip={false} />
              </motion.div>
            </motion.div>
          )
        })
      })}

      {/* The deal: blocks fly from the break to the racks */}
      {plan.flights.map((f, i) => {
        const to = rack(f.seat, f.first + (f.n > 1 ? 1.5 : 0))
        const { w: fw, h: fh } = tile(stacks[0].vertical)
        return (
          <motion.div
            key={`f${i}`}
            className="absolute"
            style={{ left: 0, top: 0, zIndex: 5 }}
            initial={{ x: f.from.x, y: f.from.y, opacity: 0 }}
            animate={{ x: [f.from.x, to.x, to.x], y: [f.from.y, to.y, to.y], opacity: [1, 1, 0] }}
            transition={{ delay: s(f.at), duration: s(T.fly), times: [0, 0.85, 1], ease: 'easeOut' }}
          >
            <div className="flex" style={{ gap: 1 }}>
              {Array.from({ length: Math.min(2, f.n) }, (_, j) => (
                <TileView key={j} code={null} w={fw} h={fh} depth={f.n > 1 ? 2 : 1} tip={false} />
              ))}
            </div>
          </motion.div>
        )
      })}

      {/* Racks: the dealt hands land here, yours face up */}
      {plan.flights.flatMap((f) =>
        Array.from({ length: f.n }, (_, j) => {
          const idx = f.first + j
          if (idx >= 13) return null
          const p = rack(f.seat, idx)
          const { w: rw, h: rh } = tile(p.vertical)
          return (
            <motion.div
              key={`r${f.seat}-${idx}`}
              className="absolute"
              style={{ left: p.x, top: p.y }}
              initial={{ opacity: 0, y: f.seat === 0 ? 3 : 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: s(f.at + T.fly * 0.8), duration: s(120) }}
            >
              <TileView code={f.seat === 0 ? (yours[idx] ?? null) : null} w={rw} h={rh} depth={1} tip={false} />
            </motion.div>
          )
        }),
      )}
    </div>
  )

  const status = (
    <div className="flex flex-col items-center" style={{ gap: 8, minWidth: 0 }}>
      <span role="status" style={{ ...PIXEL_FONT, fontSize: font, color: ARCADE.amber, textAlign: 'center' }}>{label}</span>
      {stage !== 'shuffling' && stage !== 'walls' && (
        <span aria-hidden style={{ ...PIXEL_FONT, fontSize: font, color: MUTED }}>
          {plan.dice[0]} + {plan.dice[1]} = {plan.dice[0] + plan.dice[1]}
        </span>
      )}
      <ArcadeButton size={portrait ? 'xl' : 'sm'} tone="dark" onClick={finish} title={`${labels.skip} (Enter)`}>
        {labels.skip}
      </ArcadeButton>
    </div>
  )

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      style={{ zIndex: 25, backgroundColor: TABLE_BG, gap: portrait ? 10 : 18, flexDirection: portrait ? 'column' : 'row' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: s(plan.end + T.fade), times: [0, plan.end / (plan.end + T.fade), 1] }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        finish()
      }}
    >
      {!portrait && <div style={{ width: 96 }} />}
      {table}
      <div style={{ width: portrait ? undefined : 96 }}>{status}</div>
    </motion.div>
  )
}
