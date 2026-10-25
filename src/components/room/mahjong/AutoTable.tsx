// src/components/room/mahjong/AutoTable.tsx
'use client'

/**
 * The automatic mahjong table, played before each 4-player hand, drawn as pixel
 * art: a 132x132 canvas scaled up with nearest-neighbour sampling, every sprite
 * drawn in code on the art grid and the clock stepped at 20 frames a second, so
 * things hop from pixel to pixel the way the rest of the room moves.
 *
 * Last hand's tiles tumble into the centre hatch while its lid turns, the four
 * walls pop up two high around the felt, the dealer rolls the dice, and the deal
 * comes off the wall at the break in blocks of four (then one each) to the four
 * racks, yours face up with tiny pixel faces. Seen from above with the near edge
 * of every tile showing, like the table below it.
 *
 * Decorative (aria-hidden) apart from its status line. A click, Enter, Space or
 * Escape skips it; with reduced motion the hand starts at once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import { ArcadeButton, ARCADE, PIXEL_FONT } from '../DeskArcade'
import { useSfx } from '../RoomSfxProvider'
import { ALL_KINDS, compareTiles, mulberry32, tileCode } from '@/lib/games/mahjong-tiles'
import { MUTED, TABLE_BG } from './chrome'

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
/** The art grid: the table is N x N art pixels. */
const N = 132
/** One frame every 50 ms: positions snap to whole art pixels at 20 fps. */
const FRAME = 50
const HATCH_R = 13
const CX = 64
const CY = 64

const C = {
  rimOut: '#24160c',
  rim: '#4a3222',
  rimHi: '#6a4a32',
  felt: '#2f5a3c',
  feltDot: '#2b5437',
  slot: '#244632',
  back: '#3f7a4a',
  backHi: '#5c9a64',
  backLo: '#2a5634',
  side: '#ece2c8',
  sideLo: '#b8a682',
  face: '#f6efdc',
  faceEdge: '#cfc2a2',
  ink: '#2a2520',
  red: '#c0392b',
  blue: '#2e5aa8',
  green: '#2e7d4a',
  hatch: '#16201a',
  lidA: '#3a5846',
  lidB: '#2c4535',
  lidRim: '#5a7a64',
  shadow: 'rgba(0,0,0,0.35)',
}

type Pt = { x: number; y: number }
type Ctx = CanvasRenderingContext2D

const clamp01 = (p: number) => (p < 0 ? 0 : p > 1 ? 1 : p)
const easeOut = (p: number) => 1 - (1 - p) * (1 - p)
const easeIn = (p: number) => p * p
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p))

/* ---------- Sprites, all drawn on the art grid ---------- */

function px(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

/** A face-down tile lying in a horizontal wall: 4 wide, a 3-row back, its ivory near edge and the shadow under it. */
function tileH(ctx: Ctx, x: number, y: number, dark = false) {
  px(ctx, x, y, 4, 3, dark ? C.backLo : C.back)
  px(ctx, x, y, 4, 1, dark ? C.back : C.backHi)
  px(ctx, x, y + 3, 4, 1, C.side)
  px(ctx, x, y + 4, 4, 1, C.sideLo)
}

/** The same tile in a side wall: 6 wide (its long side across the wall), 2-row back. */
function tileV(ctx: Ctx, x: number, y: number, dark = false) {
  px(ctx, x, y, 6, 2, dark ? C.backLo : C.back)
  px(ctx, x, y, 6, 1, dark ? C.back : C.backHi)
  px(ctx, x, y + 2, 6, 1, C.side)
  px(ctx, x, y + 3, 6, 1, C.sideLo)
}

function tile(ctx: Ctx, vertical: boolean, x: number, y: number, dark = false) {
  if (vertical) tileV(ctx, x, y, dark)
  else tileH(ctx, x, y, dark)
}

/** 5x5 letters for the winds, a row per string. */
const GLYPHS: Record<string, string[]> = {
  w1: ['11111', '10000', '11110', '10000', '11111'],
  w2: ['01111', '10000', '01110', '00001', '11110'],
  w3: ['10001', '10001', '10101', '10101', '01010'],
  w4: ['10001', '11001', '10101', '10011', '10001'],
  r1: ['00100', '11111', '10101', '11111', '00100'],
  r2: ['10101', '01110', '11111', '01110', '10101'],
}

/** Pip spots on a 3x3 grid for 1 to 9, read left to right, top to bottom. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
  7: [0, 2, 3, 4, 5, 6, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
}

function glyph(ctx: Ctx, rows: string[], x: number, y: number, c: string) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '1') px(ctx, x + i, y + j, 1, 1, c)
  })
}

/** A tiny face on the 5x7 inside of a face-up tile. */
function face(ctx: Ctx, code: string, x: number, y: number) {
  const suit = code[0]
  const n = Number(code.slice(1))
  if (suit === 'd') {
    for (const p of PIPS[n] ?? []) {
      const row = Math.floor(p / 3)
      const c = n === 1 ? C.red : row === 0 ? C.blue : row === 1 ? C.red : C.green
      px(ctx, x + (p % 3) * 2, y + 1 + row * 2, 1, 1, c)
    }
  } else if (suit === 'b') {
    if (n === 1) {
      glyph(ctx, ['01100', '11110', '01100', '00110', '01110'], x, y + 1, C.green)
      px(ctx, x + 1, y + 1, 1, 1, C.red)
      return
    }
    for (const p of PIPS[n] ?? []) {
      const row = Math.floor(p / 3)
      px(ctx, x + (p % 3) * 2, y + [0, 3, 5][row], 1, 2, row === 1 && n % 2 === 1 ? C.red : C.green)
    }
  } else if (suit === 'c') {
    // The number in ink on top (strokes for 1 to 3, a mark above that), the red 萬 underneath.
    if (n <= 3) for (let i = 0; i < n; i++) px(ctx, x + 1, y + (n === 1 ? 1 : i * (n === 2 ? 2 : 1)), 3, 1, C.ink)
    else glyph(ctx, [n % 2 ? '111' : '101', n > 6 ? '010' : '111', n % 3 ? '101' : '111'], x + 1, y, C.ink)
    glyph(ctx, ['10101', '11111', '10101'], x, y + 4, C.red)
  } else if (suit === 'w') {
    glyph(ctx, GLYPHS[code], x, y + 1, C.ink)
  } else if (code === 'r1') {
    glyph(ctx, GLYPHS.r1, x, y + 1, C.red)
  } else if (code === 'r2') {
    glyph(ctx, GLYPHS.r2, x, y + 1, C.green)
  } else if (code === 'r3') {
    px(ctx, x, y + 1, 5, 1, C.blue)
    px(ctx, x, y + 5, 5, 1, C.blue)
    px(ctx, x, y + 1, 1, 5, C.blue)
    px(ctx, x + 4, y + 1, 1, 5, C.blue)
  } else {
    // Flowers and seasons: a little bloom.
    glyph(ctx, ['01010', '11111', '01010', '00100', '01100'], x, y + 1, suit === 'f' ? C.red : C.blue)
    px(ctx, x + 2, y + 2, 1, 1, '#e8a83a')
  }
}

/** Your rack tile: a 7x9 ivory face with a back-coloured base row. */
function rackFace(ctx: Ctx, code: string, x: number, y: number) {
  px(ctx, x, y, 7, 9, C.faceEdge)
  px(ctx, x + 1, y, 5, 9, C.face)
  px(ctx, x, y + 1, 7, 7, C.face)
  px(ctx, x, y + 9, 7, 1, C.back)
  face(ctx, code, x + 1, y + 1)
}

/** An opponent's rack tile standing on edge: the ivory top and the green back. */
function rackBack(ctx: Ctx, seat: number, x: number, y: number) {
  if (seat === 2) {
    px(ctx, x, y, 7, 1, C.side)
    px(ctx, x, y + 1, 7, 3, C.back)
    px(ctx, x, y + 1, 7, 1, C.backHi)
  } else {
    px(ctx, x, y, 4, 6, C.back)
    px(ctx, seat === 1 ? x : x + 3, y, 1, 6, C.side)
    px(ctx, x, y + 6, 4, 1, C.sideLo)
  }
}

/** A 9x9 die. */
function die(ctx: Ctx, n: number, x: number, y: number) {
  px(ctx, x + 1, y + 1, 9, 9, C.shadow)
  px(ctx, x, y, 9, 9, C.ink)
  px(ctx, x + 1, y + 1, 7, 7, C.face)
  px(ctx, x + 1, y + 7, 7, 1, C.faceEdge)
  for (const p of PIPS[n] ?? []) px(ctx, x + 2 + (p % 3) * 2, y + 2 + Math.floor(p / 3) * 2, 1, 1, n === 1 || n === 4 ? C.red : C.ink)
}

/* ---------- The scene ---------- */

interface Stack { pos: Pt; vertical: boolean }

interface Plan {
  dice: [number, number]
  tumble: [number, number][]
  swept: { code: string; x: number; y: number; spin: number; delay: number; up: boolean }[]
  removed: Map<string, number>
  flights: { from: Pt; seat: number; at: number; n: number; first: number }[]
  end: number
}

/** The 72 stacks counter-clockwise from your left: your wall, the right player's, the top's, the left's. A pinwheel. */
function buildStacks(): Stack[] {
  const out: Stack[] = []
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < STACKS; i++) {
      if (side === 0) out.push({ pos: { x: 21 + 5 * i, y: 108 }, vertical: false })
      else if (side === 1) out.push({ pos: { x: 108, y: 106 - 5 * i }, vertical: true })
      else if (side === 2) out.push({ pos: { x: 104 - 5 * i, y: 17 }, vertical: false })
      else out.push({ pos: { x: 15, y: 21 + 5 * i }, vertical: true })
    }
  }
  return out
}

const RACK0 = Math.floor((N - (13 * 8 - 1)) / 2)

/** Where seat's i-th dealt tile sits on its rack. */
function rackPos(seat: number, i: number): Pt {
  const along = RACK0 + i * 8
  if (seat === 0) return { x: along, y: N - 15 }
  if (seat === 1) return { x: N - 9, y: N - along - 7 }
  if (seat === 2) return { x: N - along - 7, y: 5 }
  return { x: 5, y: along }
}

function buildPlan(seed: number, dealer: number, stacks: Stack[]): Plan {
  const rng = mulberry32(seed ^ 0x5bd1e995)
  const roll = (): [number, number] => [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)]
  const dice = roll()
  const tumble = Array.from({ length: 7 }, roll)
  const swept = Array.from({ length: SWEPT }, () => ({
    code: tileCode(ALL_KINDS[Math.floor(rng() * ALL_KINDS.length)]),
    x: 30 + Math.floor(rng() * 66),
    y: 30 + Math.floor(rng() * 66),
    spin: Math.floor(rng() * 4),
    delay: rng() * 380,
    up: rng() < 0.5,
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
  const flights: Plan['flights'] = []
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
}

function drawScene(ctx: Ctx, t: number, stacks: Stack[], plan: Plan, yours: string[]) {
  const frame = Math.floor(t / FRAME)

  // Rim: a dark outline, wood, a lit inner bevel. Felt with a sparse dither.
  px(ctx, 0, 0, N, N, C.rimOut)
  px(ctx, 1, 1, N - 2, N - 2, C.rim)
  px(ctx, 3, 3, N - 6, N - 6, C.rimHi)
  px(ctx, 4, 4, N - 8, N - 8, C.felt)
  ctx.fillStyle = C.feltDot
  for (let y = 5; y < N - 5; y += 4) for (let x = 5 + ((y >> 2) % 2) * 2; x < N - 5; x += 4) ctx.fillRect(x, y, 1, 1)

  // Wall slots: darker felt under each wall.
  for (let side = 0; side < 4; side++) {
    const a = stacks[side * STACKS].pos
    const b = stacks[side * STACKS + STACKS - 1].pos
    const v = stacks[side * STACKS].vertical
    const x = Math.min(a.x, b.x) - 1
    const y = Math.min(a.y, b.y) - 3
    px(ctx, x, y, Math.abs(b.x - a.x) + (v ? 6 : 4) + 2, Math.abs(b.y - a.y) + (v ? 4 : 5) + 4, C.slot)
  }

  // Centre console: the hatch, its lid turning in steps, a lit rim.
  const turn = easeInOut(clamp01(t / T.dice)) * Math.PI * 3
  const quarter = Math.PI / 2
  for (let y = -HATCH_R; y <= HATCH_R; y++) {
    for (let x = -HATCH_R; x <= HATCH_R; x++) {
      const r = Math.sqrt(x * x + y * y)
      if (r > HATCH_R + 0.3) continue
      let c = C.hatch
      if (r <= HATCH_R - 2.5) {
        const a = Math.atan2(y, x) + Math.PI * 4 - turn
        c = Math.floor(a / quarter) % 2 === 0 ? C.lidA : C.lidB
      } else if (r <= HATCH_R - 1.5) c = C.lidRim
      ctx.fillStyle = c
      ctx.fillRect(CX + x, CY + y, 1, 1)
    }
  }

  // Last hand's tiles tumble into the hatch, spinning a quarter turn every few frames, shrinking as they drop.
  for (const s of plan.swept) {
    const p = clamp01((t - s.delay) / 520)
    if (p >= 1) continue
    const e = easeIn(p)
    const x = s.x + (CX - s.x) * e
    const y = s.y + (CY - s.y) * e
    if (p > 0.8) {
      px(ctx, x, y, 1, 1, C.backHi)
    } else if (p > 0.55) {
      px(ctx, x - 1, y - 1, 3, 3, s.up ? C.face : C.back)
    } else {
      const v = (s.spin + (p > 0 ? Math.floor((t - s.delay) / 100) : 0)) % 2 === 1
      if (s.up) {
        const w = v ? 6 : 4
        const h = v ? 4 : 6
        px(ctx, x - w / 2, y - h / 2, w, h, C.face)
        px(ctx, x - w / 2, y + h / 2, w, 1, C.sideLo)
        px(ctx, x, y - 1, 1, 1, s.code[0] === 'b' ? C.green : s.code[0] === 'd' ? C.blue : C.red)
      } else tile(ctx, v, x - (v ? 3 : 2), y - 2)
    }
  }

  // Dice under the dome, tumbling through faces, a pixel of jitter while they roll.
  if (t >= T.dice - 120) {
    const rolled = t >= T.dice + 440
    const idx = Math.min(plan.tumble.length - 1, Math.max(0, Math.floor((t - T.dice) / 60)))
    const f = rolled ? plan.dice : plan.tumble[idx]
    const j = rolled ? 0 : frame % 2
    die(ctx, f[0], CX - 10, CY - 5 - j)
    die(ctx, f[1], CX + 1, CY - 4 + j)
  }

  // The walls, two high, front stacks painted over the ones behind. Each tile pops up from the slot.
  const order = stacks.map((s, i) => i).sort((a, b) => stacks[a].pos.y - stacks[b].pos.y || stacks[a].pos.x - stacks[b].pos.x)
  for (const i of order) {
    const st = stacks[i]
    const along = i % STACKS
    for (const layer of [0, 1]) {
      const at = T.walls + along * 22 + layer * 110
      if (t < at) continue
      const gone = plan.removed.get(`${i}-${layer}`)
      if (gone !== undefined && t >= gone) continue
      const rising = t < at + 100
      tile(ctx, st.vertical, st.pos.x, st.pos.y - layer * 2 + (rising ? 1 : 0), rising)
    }
  }

  // Racks: the dealt hands land here, yours face up.
  for (const f of plan.flights) {
    if (t < f.at + T.fly * 0.8) continue
    for (let j = 0; j < f.n; j++) {
      const idx = f.first + j
      if (idx >= 13) continue
      const p = rackPos(f.seat, idx)
      if (f.seat === 0) {
        const settle = t < f.at + T.fly * 0.8 + 60 ? 1 : 0
        rackFace(ctx, yours[idx] ?? 'r3', p.x, p.y + settle)
      } else rackBack(ctx, f.seat, p.x, p.y)
    }
  }

  // The deal: each block hops from the break to its rack, two stacks of two (or one tile on the last pass).
  for (const f of plan.flights) {
    const p = (t - f.at) / T.fly
    if (p < 0 || p >= 0.85) continue
    const to = rackPos(f.seat, f.first + (f.n > 1 ? 1.5 : 0))
    const e = easeOut(clamp01(p / 0.85))
    const x = f.from.x + (to.x - f.from.x) * e
    const y = f.from.y + (to.y - f.from.y) * e - Math.round(Math.sin(e * Math.PI) * 6)
    px(ctx, x + 1, y + 6, f.n > 1 ? 9 : 4, 2, C.shadow)
    if (f.n > 1) {
      tileH(ctx, x, y + 2)
      tileH(ctx, x + 5, y + 2)
      tileH(ctx, x, y)
      tileH(ctx, x + 5, y)
    } else tileH(ctx, x, y)
  }
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

  const stacks = useMemo(buildStacks, [])
  const plan = useMemo(() => buildPlan(seed, dealer, stacks), [seed, dealer, stacks])
  const yours = useMemo(() => [...hand].sort(compareTiles).slice(0, 13), [hand])

  /* ---------- Clock: stage label, sounds, the end ---------- */
  const [stage, setStage] = useState<'shuffling' | 'walls' | 'dice' | 'dealing'>('shuffling')

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
    at(T.dice + 440, () => tone('flip'))
    at(T.deal, () => setStage('dealing'))
    for (let i = 0; i < plan.flights.length; i += 2) at(plan.flights[i].at, () => tone('deal', 0.9 + (i % 4) * 0.05))
    at(plan.end + T.fade, finish)
    return () => ids.forEach((id) => window.clearTimeout(id))
  }, [reduce, k, plan, tone, finish])

  /* ---------- The canvas, redrawn once per frame step ---------- */
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (reduce) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    let raf = 0
    let last = -1
    const t0 = performance.now()
    const loop = (now: number) => {
      const t = (now - t0) / k
      const f = Math.floor(t / FRAME)
      if (f !== last) {
        last = f
        drawScene(ctx, f * FRAME, stacks, plan, yours)
      }
      if (t < plan.end + T.fade) raf = requestAnimationFrame(loop)
    }
    drawScene(ctx, 0, stacks, plan, yours)
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [reduce, k, stacks, plan, yours])

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
  // Whole art pixels where there is room for them, else whatever fits.
  const avail = Math.max(200, Math.floor(portrait ? Math.min(w - 12, h - 76) : Math.min(h - 10, w - 220)))
  const size = avail >= N * 2 ? Math.floor(avail / N) * N : avail
  const font = portrait ? 12 : 10
  const end = plan.end + T.fade

  const status = (
    <div className="flex flex-col items-center" style={{ gap: 8, minWidth: 0 }}>
      <span role="status" style={{ ...PIXEL_FONT, fontSize: font, color: ARCADE.amber, textAlign: 'center' }}>{labels[stage]}</span>
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
      animate={{ opacity: 0 }}
      // Holds, then fades out in four hard steps.
      transition={{ duration: s(end), ease: (p: number) => Math.floor(clamp01((p * end - plan.end) / T.fade) * 4) / 4 }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        finish()
      }}
    >
      {!portrait && <div style={{ width: 96 }} />}
      <canvas
        ref={canvasRef}
        aria-hidden
        width={N}
        height={N}
        className="flex-shrink-0"
        style={{ width: size, height: size, imageRendering: 'pixelated', boxShadow: '3px 3px 0 rgba(0,0,0,0.35)' }}
      />
      <div style={{ width: portrait ? undefined : 96 }}>{status}</div>
    </motion.div>
  )
}
