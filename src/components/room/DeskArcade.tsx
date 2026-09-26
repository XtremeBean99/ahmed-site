// src/components/room/DeskArcade.tsx
'use client'

/**
 * Shared kit for the desk games (Blackjack, Solitaire, Pong, Breakout, Paint,
 * Minesweeper, Snake): the full-screen frame, the canvas scale hook, the
 * palette and the room-style controls, so the games read as one set.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { CardNameLabels } from '@/lib/games/cards'
import { useT } from '@/lib/i18n/client'
import { ScreenStrip } from './ScreenStrip'
import { NowPlaying } from './NowPlaying'
import { ARCADE, PIXEL_FONT } from './pixel-ui'

export { ARCADE, ArcadeButton, PIXEL_FONT } from './pixel-ui'

/** The desk monitor glass, in CSS pixels before the stage scale. */
export const SCREEN_W = 536
export const SCREEN_H = 308
/** Height under the 28px ScreenStrip. */
export const APP_H = SCREEN_H - 28
/** The music bar under a full-screen app. */
const FS_BAR_H = 52
const FS_BG = '#0e0a08'

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
      setScale(on ? Math.min(window.innerWidth / SCREEN_W, (window.innerHeight - FS_BAR_H) / SCREEN_H) : 1)
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
 * the full-screen element, scales its fixed 536x308 content into the space above
 * a music bar (the page's own player is outside the full-screen element, so it
 * would vanish), and the tree stays the same so the app keeps its state.
 */
export function ArcadeFrame({ fs, background = ARCADE.paper, children }: { fs: Fullscreen; background?: string; children: ReactNode }) {
  const t = useT()
  return (
    <div
      ref={fs.ref}
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ backgroundColor: fs.active ? FS_BG : background }}
    >
      <div className="flex-1 min-h-0 flex items-center justify-center">
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
      {fs.active && (
        <div
          className="flex items-center justify-between gap-4 flex-shrink-0 px-4"
          style={{ height: FS_BAR_H, backgroundColor: FS_BG, borderTop: `1px solid ${ARCADE.panelBorder}` }}
        >
          <NowPlaying labels={t.room.audio} embedded />
          <span className="flex-shrink-0" style={{ ...PIXEL_FONT, fontSize: 10, color: ARCADE.inkSoft }}>
            {t.desk.arcade.escHint}
          </span>
        </div>
      )}
    </div>
  )
}

/** The strip for an app with full screen: ScreenStrip with the Full screen button. */
export function ArcadeStrip({
  time,
  title,
  fs,
  arcade,
  desktopLabel,
  backLabel,
  onDesktop,
  onBack,
  children,
}: {
  time: string
  title?: string
  fs: Fullscreen
  arcade: ArcadeLabels
  desktopLabel: string
  backLabel: string
  onDesktop: () => void
  onBack: (e: React.MouseEvent) => void
  children?: ReactNode
}) {
  return (
    <ScreenStrip
      time={time}
      title={title}
      fs={fs}
      fsLabels={arcade}
      desktopLabel={desktopLabel}
      onDesktop={onDesktop}
      backLabel={backLabel}
      onBack={onBack}
    >
      {children}
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
