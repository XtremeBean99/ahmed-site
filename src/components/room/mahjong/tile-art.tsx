// src/components/room/mahjong/tile-art.tsx
'use client'

/**
 * Mahjong tiles drawn in code: an ivory face with a green side, faces as SVG on a 20x28 grid so every
 * size stays crisp (and simplified below 17 px wide). Used by both Mahjong modes.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { parseTile } from '@/lib/games/mahjong-tiles'
import { useTileTipApi } from './tip-context'

const FACE = '#f6efd6'
const FACE_HI = '#fffdf2'
const SIDE = '#3b7a5a'
const OUTLINE = '#1f3d2e'
const INK = '#23201c'
const RED = '#c0392b'
const GREEN = '#1f8a4a'
const BLUE = '#2a5aa0'
export const CJK = '"Noto Sans CJK SC","Noto Sans SC","PingFang SC","Microsoft YaHei","Hiragino Sans GB","WenQuanYi Micro Hei","SimHei",sans-serif'

const NUMERALS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const WIND_CHARS = ['', '東', '南', '西', '北']
const DRAGON_CHARS = ['', '中', '發', '']
const SEASON_CHARS = ['', '春', '夏', '秋', '冬']
const FLOWER_COLORS = ['', '#d85a8a', '#8a5ac0', '#e0a020', '#3a9a50']
const SEASON_COLORS = ['', '#3a9a50', RED, '#d9791a', BLUE]

type Dot = [number, number, string]
const D_G = GREEN
const D_R = RED
const D_B = BLUE
const DOT_LAYOUT: Record<number, Dot[]> = {
  1: [[10, 14, D_R]],
  2: [[10, 8, D_G], [10, 20, D_B]],
  3: [[5, 6, D_B], [10, 14, D_R], [15, 22, D_G]],
  4: [[6, 8, D_B], [14, 8, D_G], [6, 20, D_G], [14, 20, D_B]],
  5: [[6, 7, D_B], [14, 7, D_G], [10, 14, D_R], [6, 21, D_G], [14, 21, D_B]],
  6: [[6, 6, D_G], [14, 6, D_G], [6, 14, D_R], [14, 14, D_R], [6, 22, D_R], [14, 22, D_R]],
  7: [[5, 5, D_G], [10, 8, D_G], [15, 11, D_G], [6, 17, D_R], [14, 17, D_R], [6, 23, D_R], [14, 23, D_R]],
  8: [[6, 5, D_B], [14, 5, D_B], [6, 11, D_B], [14, 11, D_B], [6, 17, D_B], [14, 17, D_B], [6, 23, D_B], [14, 23, D_B]],
  9: [[5, 6, D_G], [10, 6, D_R], [15, 6, D_B], [5, 14, D_G], [10, 14, D_R], [15, 14, D_B], [5, 22, D_G], [10, 22, D_R], [15, 22, D_B]],
}

/** [x, y, colour] sticks, 2.6 wide and 7 tall. */
type Stick = [number, number, string]
const S_G = GREEN
const S_R = RED
const STICK_LAYOUT: Record<number, Stick[]> = {
  2: [[10, 8, S_G], [10, 20, S_G]],
  3: [[10, 8, S_G], [6, 20, S_G], [14, 20, S_G]],
  4: [[6, 8, S_G], [14, 8, S_G], [6, 20, S_G], [14, 20, S_G]],
  5: [[5, 8, S_G], [15, 8, S_G], [10, 14, S_R], [5, 20, S_G], [15, 20, S_G]],
  6: [[5, 8, S_G], [10, 8, S_G], [15, 8, S_G], [5, 20, S_G], [10, 20, S_G], [15, 20, S_G]],
  7: [[10, 5, S_R], [5, 14, S_G], [10, 14, S_G], [15, 14, S_G], [5, 23, S_G], [10, 23, S_G], [15, 23, S_G]],
  8: [[4, 8, S_G], [8, 8, S_G], [12, 8, S_G], [16, 8, S_G], [4, 20, S_G], [8, 20, S_G], [12, 20, S_G], [16, 20, S_G]],
  9: [[5, 5, S_G], [10, 5, S_R], [15, 5, S_G], [5, 14, S_G], [10, 14, S_R], [15, 14, S_G], [5, 23, S_G], [10, 23, S_R], [15, 23, S_G]],
}

function Stick({ x, y, color, h }: { x: number; y: number; color: string; h: number }) {
  const w = 2.8
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill={color} />
      <rect x={x - w / 2} y={y - 0.4} width={w} height={0.8} fill={FACE} />
      <rect x={x - w / 2 + 0.5} y={y - h / 2} width={0.7} height={h} fill="rgba(255,255,255,0.28)" />
    </g>
  )
}

function Bird() {
  return (
    <g>
      <rect x={4} y={22} width={12} height={1.4} fill={RED} />
      <rect x={2} y={15.5} width={6} height={2} fill={RED} />
      <rect x={3} y={18} width={6} height={2} fill={BLUE} />
      <ellipse cx={10.5} cy={15} rx={5} ry={4.2} fill={GREEN} />
      <circle cx={14.5} cy={9} r={3} fill={GREEN} />
      <rect x={12.4} y={3.5} width={1.4} height={3.4} fill={RED} />
      <rect x={14.3} y={2.6} width={1.4} height={4.3} fill={RED} />
      <rect x={15} y={8.2} width={1.1} height={1.1} fill={FACE} />
      <rect x={17} y={9} width={2.6} height={1.5} fill={RED} />
      <rect x={9} y={18.6} width={1.1} height={3.4} fill={INK} />
      <rect x={12.4} y={18.6} width={1.1} height={3.4} fill={INK} />
    </g>
  )
}

function Petals({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  const pts = [0, 1, 2, 3, 4].map((i) => {
    const a = (-90 + i * 72) * (Math.PI / 180)
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const
  })
  return (
    <g>
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={r * 0.75} fill={color} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.5} fill="#f6d36a" />
    </g>
  )
}

function Glyph({ x, y, size, fill, ch, bold = true }: { x: number; y: number; size: number; fill: string; ch: string; bold?: boolean }) {
  return (
    <text x={x} y={y} textAnchor="middle" fontSize={size} fontWeight={bold ? 700 : 400} fill={fill} fontFamily={CJK}>
      {ch}
    </text>
  )
}

function faceContent(code: string, simple: boolean): ReactNode {
  const k = parseTile(code)
  if (!k) return null
  switch (k.suit) {
    case 'dots': {
      if (k.rank === 1) {
        return (
          <g>
            <circle cx={10} cy={14} r={7.6} fill={D_G} />
            <circle cx={10} cy={14} r={5.6} fill={FACE} />
            <circle cx={10} cy={14} r={4.4} fill={D_R} />
            <circle cx={10} cy={14} r={1.8} fill={FACE} />
          </g>
        )
      }
      const r = k.rank >= 8 ? 2.3 : k.rank === 2 ? 3.4 : 2.9
      return (
        <g>
          {DOT_LAYOUT[k.rank].map(([x, y, c], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill={c} />
              <circle cx={x} cy={y} r={r * 0.4} fill={FACE} />
            </g>
          ))}
        </g>
      )
    }
    case 'bamboo': {
      if (k.rank === 1) return <Bird />
      const h = k.rank >= 7 ? 7 : 8
      return (
        <g>
          {STICK_LAYOUT[k.rank].map(([x, y, c], i) => (
            <Stick key={i} x={x} y={y} color={c} h={h} />
          ))}
        </g>
      )
    }
    case 'characters':
      return simple ? (
        <g>
          <Glyph x={10} y={17} size={17} fill={INK} ch={String(k.rank)} />
          <Glyph x={10} y={26} size={10} fill={RED} ch="萬" />
        </g>
      ) : (
        <g>
          <Glyph x={10} y={12.5} size={11.5} fill={INK} ch={NUMERALS[k.rank]} />
          <Glyph x={10} y={25} size={11.5} fill={RED} ch="萬" />
        </g>
      )
    case 'winds':
      return <Glyph x={10} y={20} size={19} fill={INK} ch={WIND_CHARS[k.rank]} />
    case 'dragons':
      if (k.rank === 3) {
        return (
          <g fill="none" stroke={BLUE}>
            <rect x={4.2} y={5.2} width={11.6} height={17.6} strokeWidth={1.8} />
            <rect x={6.6} y={7.6} width={6.8} height={12.8} strokeWidth={0.8} />
          </g>
        )
      }
      return <Glyph x={10} y={20.5} size={19} fill={k.rank === 1 ? RED : GREEN} ch={DRAGON_CHARS[k.rank]} />
    case 'flowers':
      return (
        <g>
          <Petals cx={10} cy={10} r={4.2} color={FLOWER_COLORS[k.rank]} />
          <Glyph x={10} y={25.5} size={13} fill={FLOWER_COLORS[k.rank]} ch={String(k.rank)} />
        </g>
      )
    case 'seasons':
      return (
        <g>
          <Glyph x={10} y={15} size={14} fill={SEASON_COLORS[k.rank]} ch={SEASON_CHARS[k.rank]} />
          <Glyph x={10} y={25.5} size={10} fill={SEASON_COLORS[k.rank]} ch={String(k.rank)} />
        </g>
      )
  }
}

/** Thickness shadow: `depth` px of green side, then a dark outline. */
function sideShadow(depth: number, color = SIDE): string {
  const parts: string[] = []
  for (let i = 1; i <= depth; i++) parts.push(`${i}px ${i}px 0 ${color}`)
  parts.push(`${depth + 1}px ${depth + 1}px 0 ${OUTLINE}`)
  return parts.join(',')
}

export interface TileViewProps {
  /** Tile code, or null for the back. */
  code: string | null
  w: number
  h: number
  /** Side thickness in px (default 2). */
  depth?: number
  selected?: boolean
  highlight?: boolean
  dim?: boolean
  /** Tint for a tile that will be claimed or just played. */
  accent?: string
  style?: CSSProperties
  className?: string
  title?: string
  /** False keeps this tile out of the hover tooltips (a TileTipLayer shows them for every face otherwise). */
  tip?: boolean
}

/** One tile. Position it from the outside (absolute left/top in `style`). */
export function TileView({ code, w, h, depth = 2, selected, highlight, dim, accent, style, className, title, tip = true }: TileViewProps) {
  const tips = useTileTipApi()
  const ref = useRef<HTMLDivElement>(null)
  // A tile that is matched away or discarded unmounts under the pointer and never sees pointerleave.
  useEffect(() => {
    const el = ref.current
    return () => {
      if (el) tips?.leave(el)
    }
  }, [tips])
  const tipFor = tips && code !== null && tip ? code : null
  const back = code === null
  const simple = w < 17
  const face = back ? SIDE : selected ? '#ffe7a0' : highlight ? '#bfe8e0' : FACE
  const edge = back ? '#d9cfa8' : SIDE
  const ring = accent ? `0 0 0 2px ${accent},` : ''
  return (
    <div
      ref={ref}
      className={className}
      title={title}
      onPointerEnter={tipFor ? (e) => { if (e.pointerType === 'mouse') tips!.enter(tipFor, e.currentTarget) } : undefined}
      onPointerLeave={tipFor ? (e) => tips!.leave(e.currentTarget) : undefined}
      style={{
        width: w,
        height: h,
        boxSizing: 'border-box',
        position: 'relative',
        flexShrink: 0,
        background: face,
        border: `1px solid ${OUTLINE}`,
        boxShadow: `${ring}${back ? sideShadow(depth, edge) : `inset 1px 1px 0 ${FACE_HI},${sideShadow(depth)}`}`,
        ...style,
      }}
    >
      {back ? (
        <div style={{ position: 'absolute', inset: Math.max(2, Math.round(w * 0.14)), border: '1px solid #8fc79c', opacity: 0.7 }} />
      ) : (
        <svg width="100%" height="100%" viewBox="0 0 20 28" preserveAspectRatio="xMidYMid meet" shapeRendering="geometricPrecision" aria-hidden style={{ display: 'block' }}>
          {faceContent(code, simple)}
        </svg>
      )}
      {dim && <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(36,26,12,0.26)' }} />}
    </div>
  )
}
