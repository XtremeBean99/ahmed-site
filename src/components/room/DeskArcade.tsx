// src/components/room/DeskArcade.tsx
'use client'

/**
 * Shared kit for the desk arcade (Blackjack, Solitaire, Pong, Breakout): the
 * full-screen frame, the canvas scale hook, the palette and the room-style
 * controls, so the four games read as one set.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { CardNameLabels } from '@/lib/games/cards'
import { ScreenStrip, StripButton } from './ScreenStrip'

/** The desk monitor glass, in CSS pixels before the stage scale. */
export const SCREEN_W = 536
export const SCREEN_H = 308
/** Height under the 28px ScreenStrip. */
export const APP_H = SCREEN_H - 28

export const PIXEL_FONT = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

/** Room-palette retro: warm chrome, muted felt, a warm CRT. */
export const ARCADE = {
  ink: '#3a3028',
  inkSoft: '#8a7a68',
  paper: '#faf8f5',
  strip: '#e8e0d8',
  stripBorder: '#c8b8a8',
  panel: '#3d2e1e',
  panelDark: '#2d2116',
  panelBorder: '#5a4430',
  panelText: '#e8d5b0',
  panelShadow: '#1a0e04',
  felt: '#35553a',
  feltDark: '#27402c',
  feltLight: '#4a6e4e',
  feltLine: '#6f9270',
  feltText: '#cfe0c0',
  crt: '#140e0a',
  phosphor: '#f0dcb4',
  phosphorGlow: 'rgba(240,196,130,0.55)',
  phosphorDim: '#6a5a48',
  rust: '#b3372c',
  amber: '#e8a83a',
  gold: '#d8a038',
  olive: '#7a9a4a',
  teal: '#4a8a86',
  slate: '#5a6a9a',
  plum: '#8a3a5a',
} as const

export interface ArcadeLabels {
  fullscreen: string
  exitFullscreen: string
  cards: CardNameLabels
}

/** Props every arcade app receives from DeskView. */
export interface DeskGameProps<L> {
  time: string
  backLabel: string
  desktopLabel: string
  labels: L
  arcade: ArcadeLabels
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
}

export interface Fullscreen {
  ref: RefObject<HTMLDivElement | null>
  active: boolean
  /** Scale applied to the 536x308 app while full screen, else 1. */
  scale: number
  supported: boolean
  toggle: () => void
}

/** Real browser full screen for one app; the app keeps its React state across the switch. */
export function useFullscreen(): Fullscreen {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  const [scale, setScale] = useState(1)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    setSupported(Boolean(document.fullscreenEnabled))
    const update = () => {
      const on = ref.current !== null && document.fullscreenElement === ref.current
      setActive(on)
      setScale(on ? Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H) : 1)
    }
    document.addEventListener('fullscreenchange', update)
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('fullscreenchange', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void ref.current?.requestFullscreen?.().catch(() => {})
  }, [])

  return { ref, active, scale, supported, toggle }
}

/**
 * The app's root. Normally it fills the monitor glass; in full screen it becomes
 * the full-screen element and scales its fixed 536x308 content to fit.
 */
export function ArcadeFrame({ fs, background = ARCADE.paper, children }: { fs: Fullscreen; background?: string; children: ReactNode }) {
  return (
    <div
      ref={fs.ref}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: fs.active ? '#0e0a08' : background }}
    >
      <div
        className="relative flex flex-col flex-shrink-0 overflow-hidden"
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          backgroundColor: background,
          transform: fs.active ? `scale(${fs.scale})` : undefined,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/** The standard strip for an arcade app: clock, extra controls, full screen, Desktop, Room. */
export function ArcadeStrip({
  time,
  fs,
  arcade,
  desktopLabel,
  backLabel,
  onDesktop,
  onBack,
  children,
}: {
  time: string
  fs: Fullscreen
  arcade: ArcadeLabels
  desktopLabel: string
  backLabel: string
  onDesktop: () => void
  onBack: (e: React.MouseEvent) => void
  children?: ReactNode
}) {
  const leaveFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }
  return (
    <ScreenStrip time={time}>
      {children}
      {fs.supported && (
        <StripButton onClick={fs.toggle}>
          {fs.active ? arcade.exitFullscreen : arcade.fullscreen}
        </StripButton>
      )}
      <StripButton onClick={() => { leaveFullscreen(); onDesktop() }}>{desktopLabel}</StripButton>
      <StripButton onClick={(e) => { leaveFullscreen(); onBack(e) }} ariaLabel={backLabel}>← {backLabel}</StripButton>
    </ScreenStrip>
  )
}

/**
 * Device pixels per CSS pixel for a canvas, through the stage scale, full screen
 * and devicePixelRatio. Size the backing store as cssSize * k and draw with
 * ctx.setTransform(k, 0, 0, k, 0, 0) so the art stays sharp at every size.
 */
export function useCanvasScale(ref: RefObject<HTMLCanvasElement | null>, cssWidth: number): number {
  const [k, setK] = useState(1)
  useEffect(() => {
    let raf = 0
    const measure = () => {
      const el = ref.current
      if (!el) return
      const w = el.getBoundingClientRect().width
      if (w <= 0) return
      const next = Math.min(6, Math.max(1, (w / cssWidth) * window.devicePixelRatio))
      setK((prev) => (Math.abs(prev - next) < 0.01 ? prev : next))
    }
    const later = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    measure()
    later()
    window.addEventListener('resize', later)
    document.addEventListener('fullscreenchange', later)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', later)
      document.removeEventListener('fullscreenchange', later)
    }
  }, [ref, cssWidth])
  return k
}

const FELT_TEXTURE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='4' height='4' shape-rendering='crispEdges'>" +
  "<rect x='1' y='0' width='1' height='1' fill='%23ffffff' fill-opacity='0.05'/>" +
  "<rect x='3' y='2' width='1' height='1' fill='%23ffffff' fill-opacity='0.04'/>" +
  "<rect x='0' y='3' width='1' height='1' fill='%23000000' fill-opacity='0.06'/>" +
  "<rect x='2' y='1' width='1' height='1' fill='%23000000' fill-opacity='0.05'/></svg>\")"

/** Background for the card tables: muted felt, a faint weave and a soft vignette. */
export const FELT_STYLE: React.CSSProperties = {
  backgroundColor: ARCADE.felt,
  backgroundImage: `radial-gradient(ellipse 75% 70% at 50% 42%, rgba(255,240,200,0.07), rgba(0,0,0,0) 70%), ${FELT_TEXTURE}`,
  backgroundSize: 'auto, 4px 4px',
  boxShadow: 'inset 0 0 36px rgba(10,20,12,0.55)',
}

/** Scanlines and vignette laid over a CRT canvas. Decorative. */
export function CrtOverlay() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          'repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0 1px, rgba(0,0,0,0) 1px 3px), radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.5) 100%)',
        boxShadow: 'inset 0 0 18px rgba(0,0,0,0.6)',
      }}
    />
  )
}

type ButtonTone = 'cream' | 'dark'
type ButtonSize = 'sm' | 'md' | 'lg'
const SIZES: Record<ButtonSize, { font: number; padX: number; h: number; notch: number; border: number }> = {
  sm: { font: 9, padX: 6, h: 18, notch: 3, border: 2 },
  md: { font: 10, padX: 9, h: 22, notch: 4, border: 2 },
  lg: { font: 12, padX: 12, h: 28, notch: 5, border: 3 },
}

/** Pixel button in the room's style: cream bevel (like "To Room") or the dark bubble. */
export function ArcadeButton({
  onClick,
  children,
  tone = 'cream',
  size = 'md',
  disabled,
  pressed,
  ariaLabel,
  title,
  className,
}: {
  onClick: (e: React.MouseEvent) => void
  children: ReactNode
  tone?: ButtonTone
  size?: ButtonSize
  disabled?: boolean
  pressed?: boolean
  ariaLabel?: string
  title?: string
  className?: string
}) {
  const s = SIZES[size]
  const n = s.notch
  const cream = tone === 'cream'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      title={title}
      className={`relative inline-flex items-center justify-center whitespace-nowrap outline-none transition-[filter,transform] duration-75 enabled:hover:brightness-110 enabled:active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1 ${cream ? 'focus-visible:outline-[#3a2820]' : 'focus-visible:outline-[#e8d5b0]'} ${className ?? ''}`}
      style={{
        ...PIXEL_FONT,
        height: s.h,
        padding: `0 ${s.padX}px`,
        fontSize: s.font,
        lineHeight: 1,
        color: cream ? '#3a2820' : ARCADE.panelText,
        textShadow: cream ? '1px 1px 0 rgba(255,255,255,0.45)' : `1px 1px 0 ${ARCADE.panelShadow}`,
        background: cream
          ? pressed
            ? 'linear-gradient(180deg, #d8c098 0%, #e8d4b0 100%)'
            : 'linear-gradient(180deg, #fffaf0 0%, #f0e0c0 45%, #d8c098 100%)'
          : pressed
            ? ARCADE.panelDark
            : `linear-gradient(180deg, #4a3826 0%, ${ARCADE.panel} 100%)`,
        border: `${s.border}px solid ${cream ? '#3a2820' : ARCADE.panelBorder}`,
        clipPath: `polygon(${n}px 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, ${n}px 100%, 0 calc(100% - ${n}px), 0 ${n}px)`,
        boxShadow: cream
          ? 'inset 1px 1px 0 rgba(255,255,255,0.7), inset -2px -2px 0 rgba(0,0,0,0.22)'
          : 'inset 1px 1px 0 rgba(255,230,190,0.12), inset -2px -2px 0 rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </button>
  )
}

/** The dark speech-bubble panel the room uses for toasts, for banners and dialogs. */
export function ArcadePanel({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`border-2 ${className ?? ''}`}
      style={{
        ...PIXEL_FONT,
        backgroundColor: ARCADE.panel,
        borderColor: ARCADE.panelBorder,
        borderRadius: 3,
        color: ARCADE.panelText,
        textShadow: `1px 1px 0 ${ARCADE.panelShadow}`,
        boxShadow: '2px 2px 0 rgba(0,0,0,0.35)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// 5x5 block capitals for the CRT titles.
const TITLE_FONT: Record<string, string[]> = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  G: ['01111', '10000', '10011', '10001', '01110'],
  K: ['10001', '10010', '11100', '10010', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '11110', '10000', '10000'],
  R: ['11110', '10001', '11110', '10010', '10001'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '01110'],
}

/** A glowing phosphor title in 5x5 block capitals, for the CRT games' menus. Decorative; pair it with text for screen readers. */
export function BlockTitle({ text, block = 6 }: { text: string; block?: number }) {
  const letters = text.toUpperCase().split('').filter((c) => TITLE_FONT[c])
  const w = letters.length * 6 * block - block
  const rects: ReactNode[] = []
  letters.forEach((ch, li) => {
    TITLE_FONT[ch].forEach((row, r) => {
      for (let c = 0; c < 5; c++) {
        if (row[c] === '1') rects.push(<rect key={`${li}-${r}-${c}`} x={(li * 6 + c) * block} y={r * block} width={block} height={block} />)
      }
    })
  })
  return (
    <svg width={w} height={5 * block} viewBox={`0 0 ${w} ${5 * block}`} shapeRendering="crispEdges" fill={ARCADE.phosphor} aria-hidden style={{ filter: 'drop-shadow(0 0 4px rgba(240,196,130,0.55))' }}>
      {rects}
    </svg>
  )
}

/** Dims the play area and centres a panel over it (pause, game over, menus). */
export function ArcadeOverlay({ children, tint = 'rgba(12,8,6,0.55)' }: { children: ReactNode; tint?: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center" style={{ backgroundColor: tint }}>
      {children}
    </div>
  )
}
