'use client'

import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { useStageScale, STAGE_W, STAGE_H } from '@/lib/room/useStageScale'
import { MUSIC_BAR_H, SCREEN_H, SCREEN_W, portraitGeometry, type PortraitGeometry } from '@/lib/room/desk-screen'
import { useT } from '@/lib/i18n/client'
import type { Dictionary } from '@/lib/i18n/dictionaries/en'
import { useRoomAudio } from './RoomAudioProvider'
import { DeskDesktop, type DesktopShortcut } from './DeskDesktop'
import { DeskClockContext, DeskScreenContext, type DeskScreen } from './ScreenStrip'
import type { PaintLabels } from './DeskPaint'
import type { MinesLabels } from './DeskMinesweeper'
import type { SnakeLabels } from './DeskSnake'
import type { BlackjackLabels } from './DeskBlackjack'
import type { SolitaireLabels } from './DeskSolitaire'
import type { PongLabels } from './DeskPong'
import type { BreakoutLabels } from './DeskBreakout'
import type { ChessLabels } from './DeskChess'
import type { ArcadeLabels } from './DeskArcade'
import { DeskReadme } from './DeskReadme'
import type { LegalLabels } from './DeskLegal'
import type { SettingsLabels } from './DeskSettings'
import { desktopFiles } from '@/lib/terminal/session'
import type { GuestbookLabels } from './DeskGuestbook'
import type { MovieLabels } from './DeskMovie'
import { MusicNotes } from './MusicNotes'
import { DeskKeyboard } from './DeskKeyboard'
import { NowPlaying } from './NowPlaying'
import { PortraitBezel } from './PortraitBezel'
import { AppBoundary, AppLoading } from './AppBoundary'

// Every app but the README landing and the desktop is its own chunk, so the
// first load stays small on phones; they are prefetched once the page is idle.
const DeskPaint = dynamic(() => import('./DeskPaint').then((m) => m.DeskPaint), { ssr: false, loading: AppLoading })
const DeskMinesweeper = dynamic(() => import('./DeskMinesweeper').then((m) => m.DeskMinesweeper), { ssr: false, loading: AppLoading })
const DeskSnake = dynamic(() => import('./DeskSnake').then((m) => m.DeskSnake), { ssr: false, loading: AppLoading })
const DeskBlackjack = dynamic(() => import('./DeskBlackjack').then((m) => m.DeskBlackjack), { ssr: false, loading: AppLoading })
const DeskSolitaire = dynamic(() => import('./DeskSolitaire').then((m) => m.DeskSolitaire), { ssr: false, loading: AppLoading })
const DeskPong = dynamic(() => import('./DeskPong').then((m) => m.DeskPong), { ssr: false, loading: AppLoading })
const DeskBreakout = dynamic(() => import('./DeskBreakout').then((m) => m.DeskBreakout), { ssr: false, loading: AppLoading })
const DeskChess = dynamic(() => import('./DeskChess').then((m) => m.DeskChess), { ssr: false, loading: AppLoading })
const DeskMusic = dynamic(() => import('./DeskMusic').then((m) => m.DeskMusic), { ssr: false, loading: AppLoading })
const DeskLegal = dynamic(() => import('./DeskLegal').then((m) => m.DeskLegal), { ssr: false, loading: AppLoading })
const DeskSettings = dynamic(() => import('./DeskSettings').then((m) => m.DeskSettings), { ssr: false, loading: AppLoading })
const DeskTerminal = dynamic(() => import('./DeskTerminal').then((m) => m.DeskTerminal), { ssr: false, loading: AppLoading })
const DeskGuestbook = dynamic(() => import('./DeskGuestbook').then((m) => m.DeskGuestbook), { ssr: false, loading: AppLoading })
const DeskMovie = dynamic(() => import('./DeskMovie').then((m) => m.DeskMovie), { ssr: false, loading: AppLoading })
const APP_CHUNKS = [
  () => import('./DeskPaint'), () => import('./DeskMinesweeper'), () => import('./DeskSnake'),
  () => import('./DeskBlackjack'), () => import('./DeskSolitaire'), () => import('./DeskPong'),
  () => import('./DeskBreakout'), () => import('./DeskChess'), () => import('./DeskMusic'), () => import('./DeskLegal'),
  () => import('./DeskSettings'), () => import('./DeskTerminal'), () => import('./DeskGuestbook'),
  () => import('./DeskMovie'),
]

const SCREEN_X = 436; const SCREEN_Y = 152
const DESK_SCREEN: DeskScreen = { w: SCREEN_W, h: SCREEN_H, portrait: false }
const SPEAKER_LEFT = { x: 190, y: 265, w: 175, h: 300 }
const SPEAKER_RIGHT = { x: 1005, y: 270, w: 215, h: 300 }
// Desk-speaker driver holes (tweeter + woofer), stage coords, measured from desk-closeup art.
const DESK_SPEAKER_HOLES_LEFT = [
  { cx: 284, cy: 349, r: 34 },
  { cx: 284, cy: 478, r: 50 },
]
const DESK_SPEAKER_HOLES_RIGHT = [
  { cx: 1118, cy: 352, r: 38 },
  { cx: 1115, cy: 472, r: 52 },
]
const MOUSE_X_MIN = 975; const MOUSE_X_MAX = 1140
const MOUSE_Y_MIN = 572; const MOUSE_Y_MAX = 635
const MOUSE_REST_X = 1007; const MOUSE_REST_Y = 608

const SCREEN_CX = SCREEN_X + SCREEN_W / 2
const SCREEN_CY = SCREEN_Y + SCREEN_H / 2

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

/** Mobile desk layout: scale the stage so the whole monitor screen fits the
 *  viewport with a small margin, then centre the screen area in view. The desk
 *  art around it stays pannable within the stage edges. The fixed music player
 *  runs along the bottom, so the screen fits (and centres) in the space above
 *  it; that only bites on landscape phones, where the height is the limit. */
function mobileDeskLayout(vw: number, vh: number) {
  const s = Math.max(0.2, Math.min((vw - 12) / SCREEN_W, (vh - MUSIC_BAR_H - 12) / SCREEN_H))
  const slackX = Math.abs(STAGE_W * s - vw) / 2
  const slackY = Math.abs(STAGE_H * s - vh) / 2
  const cx = -(SCREEN_CX - STAGE_W / 2) * s
  const cy = -(SCREEN_CY - STAGE_H / 2) * s - MUSIC_BAR_H / 2
  return {
    scale: s,
    pan: { x: clamp(cx, -slackX, slackX), y: clamp(cy, -slackY, slackY) },
    slack: { x: slackX, y: slackY },
  }
}
type ScreenMode = 'desktop' | 'paint' | 'minesweeper' | 'snake' | 'blackjack' | 'solitaire' | 'pong' | 'breakout' | 'chess' | 'readme' | 'music' | 'legal' | 'guestbook' | 'settings' | 'terminal' | 'movie'

interface DeskViewProps {
  shortcuts: DesktopShortcut[]
  backLabel: string
  clickAgainLabel: string
  screenLabel: string
  desktopLabel: string
  speakersLabel: string
  lampOn: boolean
  lampFlicker: boolean
  lampLabel: string
  paintLabels: PaintLabels
  minesLabels: MinesLabels
  snakeLabels: SnakeLabels
  blackjackLabels: BlackjackLabels
  solitaireLabels: SolitaireLabels
  pongLabels: PongLabels
  breakoutLabels: BreakoutLabels
  chessLabels: ChessLabels
  /** Shared by the arcade apps: full-screen button and card names */
  arcadeLabels: ArcadeLabels
  /** Labels for the readme popup */
  readmeLabels: Dictionary['desk']['readmeApp']
  /** Labels for the music player */
  musicLabels: Dictionary['desk']['musicApp']
  /** Labels for the Legal app */
  legalLabels: LegalLabels
  /** Structured privacy policy content */
  legalPrivacy: Record<string, unknown>
  /** Structured terms content */
  legalTerms: Record<string, unknown>
  /** "Effective date" label from the dictionary */
  /** Labels for the Settings app */
  settingsLabels: SettingsLabels
  /** Settings: SFX on/off */
  sfxOn: boolean; onSfx: (v: boolean) => void
  /** Settings: SFX volume 0-1 */
  sfxVolume: number; onSfxVolume: (v: number) => void
  /** Settings: music volume 0-1 */
  musicVolume: number; onMusicVolume: (v: number) => void
  /** Settings: 24h clock toggle */
  is24h: boolean; onClock: () => void
  legalEffectiveDate: string
  /** site-text.txt content for the readme popup */
  readmeContent: string
  /** Labels for the Terminal app */
  terminalLabels: { title: string }
  /** Labels for the Links app */
  /** Labels for the Guestbook app */
  guestbookLabels: GuestbookLabels
  /** Labels for the VHS player */
  movieLabels: MovieLabels
  /**
   * App to open instead of the desktop on arrival (the shelf VHS walks the
   * visitor straight into the player). Cleared through onInitialAppHandled.
   */
  initialApp?: string | null
  onInitialAppHandled?: () => void
  /** Konami code easter egg trigger */
  konamiOpen: boolean
  /** Called after the terminal has been opened so the parent can reset the flag */
  onKonamiHandled: () => void
  onToggleLamp: () => void
  onBack: () => void
  /** The music bar under the portrait phone screen */
  nowPlayingLabels: React.ComponentProps<typeof NowPlaying>['labels']
}

// On a portrait phone the shell pads itself clear of notches and the home indicator.
const SAFE_PADDING = 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'
const PORTRAIT_STAGE: React.CSSProperties = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', transform: 'none' }

export function DeskView(props: DeskViewProps) {
  const { shortcuts, backLabel, clickAgainLabel, screenLabel, desktopLabel, speakersLabel, lampOn, lampFlicker, lampLabel, paintLabels, minesLabels, snakeLabels, blackjackLabels, solitaireLabels, pongLabels, breakoutLabels, chessLabels, arcadeLabels, readmeLabels, musicLabels, legalLabels, legalPrivacy, legalTerms, legalEffectiveDate, settingsLabels, sfxOn, onSfx, sfxVolume, onSfxVolume, musicVolume, onMusicVolume, is24h, onClock, readmeContent, terminalLabels, guestbookLabels, movieLabels, initialApp, onInitialAppHandled, konamiOpen, onKonamiHandled, onToggleLamp, onBack, nowPlayingLabels } = props
  const { scale, mobile, portrait } = useStageScale()
  const t = useT().desk
  const reduce = useReducedMotion()
  const { playing, toggle } = useRoomAudio()
  const [showDesktop, setShowDesktop] = useState(false)
  const [time, setTime] = useState('')
  const [screenMode, setScreenMode] = useState<ScreenMode>('readme')
  const [termBoot, setTermBoot] = useState<string | null>(null)
  const [deskFiles, setDeskFiles] = useState<{ name: string; path: string }[]>([])
  const [mouseJitter, setMouseJitter] = useState(false)
  const [screensaver, setScreensaver] = useState(false)
  const [backPending, setBackPending] = useState(false)
  const backPendingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastAppRef = useRef<string | null>(null)
  const mouseRef = useRef<HTMLDivElement>(null)
  const mouseTarget = useRef({ x: MOUSE_REST_X, y: MOUSE_REST_Y })
  const mouseCurrent = useRef({ x: MOUSE_REST_X, y: MOUSE_REST_Y })
  const rafRef = useRef(0)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Mobile: the desk scales to fit the monitor screen, centred, and the desk
  // around it pans by dragging. Desktop keeps the whole-desk fit scale.
  // SSR-safe default; the effect below applies the real mobile layout on the
  // client while the splash is still covering the page.
  const [deskLayout, setDeskLayout] = useState({ scale: 1, pan: { x: 0, y: 0 }, slack: { x: 0, y: 0 } })
  const deskLayoutRef = useRef(deskLayout)
  const deskPanRef = useRef(deskLayout.pan)
  const deskDragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const deskRafRef = useRef(0)
  const draggedRef = useRef(false)

  useEffect(() => {
    deskLayoutRef.current = deskLayout
    deskPanRef.current = deskLayout.pan
  }, [deskLayout])

  // Portrait phone: the shell's content box (safe areas are its padding) sets the
  // screen geometry. Measured before paint, so a rotation never shows a wrong frame.
  const shellRef = useRef<HTMLDivElement>(null)
  const [geo, setGeo] = useState<PortraitGeometry | null>(null)
  useLayoutEffect(() => {
    const el = shellRef.current
    if (!portrait || !el) return
    const measure = () => setGeo(portraitGeometry(el.clientWidth, el.clientHeight))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [portrait])
  const g = portrait ? geo : null
  const screen = useMemo<DeskScreen>(() => (g ? { w: g.w, h: g.h, portrait: true } : DESK_SCREEN), [g])

  useEffect(() => {
    if (!mobile || portrait) return
    const apply = () => setDeskLayout(mobileDeskLayout(window.innerWidth, window.innerHeight))
    apply()
    window.addEventListener('resize', apply)
    window.addEventListener('orientationchange', apply)
    return () => {
      window.removeEventListener('resize', apply)
      window.removeEventListener('orientationchange', apply)
    }
  }, [mobile, portrait])

  // Drag to pan around the desk. Only on a mobile desk (a portrait phone has no
  // desk art) and only when the drag starts outside the screen area and
  // controls, so apps keep their own gestures.
  useEffect(() => {
    if (!mobile || portrait) return
    // Like the room, a drag may start on the lamp or a speaker (they cover most of
    // the desk art on a phone): it pans past 6px, and then that button's click is swallowed.
    const swallowClick = () => {
      const stop = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault() }
      window.addEventListener('click', stop, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 400)
    }
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('[data-screen-area],input,textarea,select')) return
      draggedRef.current = false
      deskDragRef.current = { x: e.clientX, y: e.clientY, px: deskPanRef.current.x, py: deskPanRef.current.y }
    }
    const onMove = (e: PointerEvent) => {
      if (!deskDragRef.current) return
      const dx = e.clientX - deskDragRef.current.x
      const dy = e.clientY - deskDragRef.current.y
      if (!draggedRef.current) {
        if (Math.abs(dx) <= 6 && Math.abs(dy) <= 6) return
        draggedRef.current = true
      }
      const { slack } = deskLayoutRef.current
      const pan = {
        x: clamp(deskDragRef.current.px + dx, -slack.x, slack.x),
        y: clamp(deskDragRef.current.py + dy, -slack.y, slack.y),
      }
      deskPanRef.current = pan
      cancelAnimationFrame(deskRafRef.current)
      deskRafRef.current = requestAnimationFrame(() => {
        setDeskLayout((prev) => ({ ...prev, pan }))
      })
    }
    const onUp = () => {
      if (!deskDragRef.current) return
      deskDragRef.current = null
      if (draggedRef.current) swallowClick()
      // The click after a drag fires before this timeout, so it is still
      // suppressed; the timeout clears the flag when no click follows.
      setTimeout(() => { draggedRef.current = false }, 0)
    }
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      cancelAnimationFrame(deskRafRef.current)
    }
  }, [mobile, portrait])

  // Warm every app chunk once the landing is idle, so opening one is instant
  // (skipped when the visitor asks to save data or is on 2g).
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
    if (conn?.saveData || /2g/.test(conn?.effectiveType ?? '')) return
    const run = () => { for (const load of APP_CHUNKS) void load().catch(() => {}) }
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(run, { timeout: 5000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(run, 2500)
    return () => clearTimeout(id)
  }, [])

  // Live clock, in the visitor's 12/24-hour choice (the strip clock toggles it)
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !is24h }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [is24h])
  const clock = useMemo(() => ({ is24h, onToggle: onClock }), [is24h, onClock])
  // Every strip's Room button: the click must not also count as a desk click.
  const backToRoom = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onBack() }, [onBack])

  // Loading beat
  useEffect(() => {
    const id = setTimeout(() => setShowDesktop(true), reduce ? 0 : 500)
    return () => clearTimeout(id)
  }, [reduce])

  const handleShortcutClick = useCallback(
    (e: React.MouseEvent, s: DesktopShortcut) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      if (s.kind === 'external') {
        window.open(s.target, '_blank', 'noopener,noreferrer')
        return
      }
      if (s.kind === 'app') {
        lastAppRef.current = s.id
        setScreenMode(s.target as ScreenMode)
        window.dispatchEvent(new CustomEvent('room:app-open', { detail: s.target }))
        return
      }
    },
    [],
  )

  // Escape ladder: app → desktop → room
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // A full-screen game: the browser's own Escape leaves full screen, and that is all it should do.
      if (document.fullscreenElement) return
      if (screenMode !== 'desktop') {
        setScreenMode('desktop')
      } else {
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screenMode, onBack])

  // Arrived from an object in the room that opens an app directly.
  useEffect(() => {
    if (!initialApp) return
    setScreenMode(initialApp as ScreenMode)
    window.dispatchEvent(new CustomEvent('room:app-open', { detail: initialApp }))
    onInitialAppHandled?.()
  }, [initialApp, onInitialAppHandled])

  // Konami code: open terminal when triggered from Room
  useEffect(() => {
    if (konamiOpen) {
      setScreenMode("terminal")
      window.dispatchEvent(new CustomEvent('room:app-open', { detail: 'terminal' }))
      onKonamiHandled()
    }
  }, [konamiOpen, onKonamiHandled])
  // Files saved to ~/Desktop in the Terminal show up as desktop icons; refresh when the desktop is shown
  useEffect(() => {
    if (screenMode === 'desktop') setDeskFiles(desktopFiles(readmeContent))
  }, [screenMode, readmeContent])
  const openDeskFile = useCallback((path: string) => {
    setTermBoot("nano '" + path.replace(/'/g, "'\\''") + "'")
    setScreenMode('terminal')
  }, [])
  // Return to desktop
  const goDesktop = useCallback(() => {
    setScreenMode('desktop')
  }, [])

  // Idle screensaver: reset timer on any activity, trigger after 15s
  useEffect(() => {
    const reset = () => {
      setScreensaver(false)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      idleTimerRef.current = setTimeout(() => setScreensaver(true), 15000)
    }
    const events = ['mousemove', 'keydown', 'pointerdown', 'wheel']
    for (const e of events) window.addEventListener(e, reset)
    reset()
    return () => {
      for (const e of events) window.removeEventListener(e, reset)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  // The screensaver overlay only exists on the desktop, so only count it there.
  useEffect(() => {
    if (screensaver && screenMode === 'desktop') window.dispatchEvent(new CustomEvent('room:app-open', { detail: 'screensaver' }))
  }, [screensaver, screenMode])

  // Mouse follower rAF loop with visibility guard
  useEffect(() => {
    if (reduce) return
    if (!matchMedia('(pointer: fine)').matches) return
    let idleTimeout: ReturnType<typeof setTimeout> | undefined
    let running = true
    const onMove = (e: PointerEvent) => {
      mouseTarget.current.x = MOUSE_X_MIN + (e.clientX / window.innerWidth) * (MOUSE_X_MAX - MOUSE_X_MIN)
      mouseTarget.current.y = MOUSE_Y_MIN + (e.clientY / window.innerHeight) * (MOUSE_Y_MAX - MOUSE_Y_MIN)
      if (!running) {
        running = true
        rafRef.current = requestAnimationFrame(loop)
      }
      if (idleTimeout) clearTimeout(idleTimeout)
      idleTimeout = setTimeout(() => {
        running = false
        cancelAnimationFrame(rafRef.current)
      }, 3000)
    }
    const onLeave = () => { mouseTarget.current.x = MOUSE_REST_X; mouseTarget.current.y = MOUSE_REST_Y }
    const onVisibility = () => {
      if (document.hidden) {
        running = false
        cancelAnimationFrame(rafRef.current)
        if (idleTimeout) { clearTimeout(idleTimeout); idleTimeout = undefined }
      } else {
        running = true
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const loop = () => {
      const el = mouseRef.current
      if (el) {
        mouseCurrent.current.x = lerp(mouseCurrent.current.x, mouseTarget.current.x, 0.15)
        mouseCurrent.current.y = lerp(mouseCurrent.current.y, mouseTarget.current.y, 0.15)
        el.style.transform = `translate(${mouseCurrent.current.x}px, ${mouseCurrent.current.y}px)`
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    window.addEventListener('pointermove', onMove)
    document.documentElement.addEventListener('mouseleave', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    rafRef.current = requestAnimationFrame(loop)
    idleTimeout = setTimeout(() => {
      running = false
      cancelAnimationFrame(rafRef.current)
    }, 3000)
    return () => {
      running = false
      if (idleTimeout) clearTimeout(idleTimeout)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(rafRef.current)
    }
  }, [reduce])

  const screenStyle: React.CSSProperties = {
    position: 'absolute', left: SCREEN_X, top: SCREEN_Y,
    width: SCREEN_W, height: SCREEN_H, overflow: 'hidden',
  }

  const deskTransform = mobile
    ? `translate(calc(-50% + ${deskLayout.pan.x}px), calc(-50% + ${deskLayout.pan.y}px)) scale(${deskLayout.scale})`
    : `translate(-50%, -50%) scale(${scale})`

  // Wraps each app so one that fails (a chunk on a flaky connection) cannot take the page down.
  const boundary = (node: ReactNode) => (
    <AppBoundary message={t.appError} reloadLabel={t.appReload} desktopLabel={desktopLabel} onDesktop={goDesktop}>{node}</AppBoundary>
  )

  // One element tree for both modes: the desk art and the bezel are conditional
  // siblings of the screen element, which never moves, so rotating a phone swaps
  // layouts without remounting the open app.
  return (
    <div className="relative room-cursor"
      style={{ width: '100%', height: '100dvh', overflow: 'hidden', backgroundColor: '#000', padding: portrait ? SAFE_PADDING : undefined }}
      onClick={(e) => {
        if (portrait) return
        if (draggedRef.current) {
          draggedRef.current = false
          return
        }
        if ((e.target as HTMLElement).closest('[data-screen-area]')) return
        if (screensaver) {
          setScreensaver(false)
          return
        }
        setMouseJitter(true)
        setTimeout(() => setMouseJitter(false), 300)
        if (!backPending) {
          setBackPending(true)
          if (backPendingTimer.current) clearTimeout(backPendingTimer.current)
          backPendingTimer.current = setTimeout(() => setBackPending(false), 2000)
          return
        }
        if (backPendingTimer.current) clearTimeout(backPendingTimer.current)
        setBackPending(false)
        onBack()
      }}>
      <div ref={shellRef} className="relative w-full h-full">
      <motion.div style={portrait ? PORTRAIT_STAGE : {
        width: STAGE_W, height: STAGE_H, position: 'absolute', top: '50%', left: '50%',
        transform: deskTransform, transformOrigin: 'center center',
        // The mobile desk pans by drag like the room; the browser must not claim the gesture (pointercancel).
        touchAction: mobile ? 'none' : undefined,
      }} initial={reduce ? undefined : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {!portrait && (<>
        {/* Lamp-off close-up */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup-lamp-off.png" alt="" draggable={false} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />
        {/* Lamp-on close-up */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup.png" alt="" draggable={false}
          className={`absolute inset-0 w-full h-full ${lampFlicker && !reduce ? 'animate-[lamp-flicker_0.5s_ease-out]' : ''}`}
          style={{ imageRendering: 'pixelated', opacity: lampOn ? 1 : 0, transition: reduce ? 'none' : 'opacity 0.4s ease' }} />
        <DeskKeyboard lampOn={lampOn} />

        {/* Desk lamp toggle */}
        <button onClick={(e) => { e.stopPropagation(); onToggleLamp() }} aria-label={lampLabel}
          className="absolute cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2"
          style={{ left: 8, top: 88, width: 160, height: 480 }} />

        {/* Speaker buttons */}
        <button onClick={(e) => { e.stopPropagation(); toggle() }} aria-label={speakersLabel}
          className="absolute cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2 transition-transform duration-[120ms] active:scale-[0.98]"
          style={{ left: SPEAKER_LEFT.x, top: SPEAKER_LEFT.y, width: SPEAKER_LEFT.w, height: SPEAKER_LEFT.h }}>
          {!playing && <span className="absolute top-2 right-2 text-[#a09080] opacity-70 pointer-events-none"
            style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px' }}>✕♪</span>}
        </button>
        <button onClick={(e) => { e.stopPropagation(); toggle() }} aria-label={speakersLabel}
          className="absolute cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2 transition-transform duration-[120ms] active:scale-[0.98]"
          style={{ left: SPEAKER_RIGHT.x, top: SPEAKER_RIGHT.y, width: SPEAKER_RIGHT.w, height: SPEAKER_RIGHT.h }}>
          {!playing && <span className="absolute top-2 right-2 text-[#a09080] opacity-70 pointer-events-none"
            style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px' }}>✕♪</span>}
        </button>

        <MusicNotes holes={DESK_SPEAKER_HOLES_LEFT} startDelay={0} />
        <MusicNotes holes={DESK_SPEAKER_HOLES_RIGHT} startDelay={550} />

        {/* "Click again to return" indicator */}
        <AnimatePresence>
          {backPending && (
            <motion.div
              className="absolute pointer-events-none z-30"
              style={{ left: '50%', top: '8px', transform: 'translateX(-50%)' }}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
            >
              <div
                className="px-3 py-1.5 border-2"
                style={{
                  backgroundColor: '#3d2e1e',
                  borderColor: '#5a4430',
                  borderRadius: '3px',
                  fontFamily: 'var(--font-pixel), "Courier New", monospace',
                  fontSize: '11px',
                  color: '#e8d5b0',
                  whiteSpace: 'nowrap',
                  textShadow: '1px 1px 0 #1a0e04',
                }}
              >
                {clickAgainLabel}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Decorative mouse */}
        <div
          ref={mouseRef}
          aria-hidden
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0, width: 110, height: 80, transform: `translate(${MOUSE_REST_X}px, ${MOUSE_REST_Y}px)`, willChange: 'transform' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/room/mouse.png" alt="" draggable={false}
            className={`block ${mouseJitter && !reduce ? 'animate-[mouse-jitter_0.3s_ease-out]' : ''}`}
            style={{ imageRendering: 'pixelated' }} />
        </div>
        </>)}

        {g && <PortraitBezel geo={g} />}

        {/* Screen area: the monitor glass, or the portrait phone screen scaled into the bezel */}
        <div data-screen-area style={g
          ? { position: 'absolute', left: g.left, top: g.top, width: g.w, height: g.h, overflow: 'hidden', transform: `scale(${g.scale})`, transformOrigin: '0 0' }
          : { ...screenStyle, visibility: portrait ? 'hidden' : undefined }}>
          <DeskScreenContext.Provider value={screen}>
          <DeskClockContext.Provider value={clock}>
          <AnimatePresence mode="wait">
            {screenMode === 'desktop' && showDesktop && (
              <motion.div key="desktop" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}>
                {boundary(<DeskDesktop
                  time={time}
                  backLabel={backLabel}
                  onBack={backToRoom}
                  screenLabel={screenLabel}
                  shortcuts={shortcuts}
                  screensaver={screensaver}
                  reduce={reduce}
                  screenW={screen.w}
                  screenH={screen.h}
                  onShortcutClick={handleShortcutClick}
                  files={deskFiles}
                  onFileClick={openDeskFile}
                  focusId={lastAppRef.current}
                />)}
              </motion.div>
            )}
            {screenMode === 'paint' && (
              <motion.div key="paint" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskPaint time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={paintLabels} onDesktop={goDesktop}
                  onBack={backToRoom} />)}
              </motion.div>
            )}

            {screenMode === 'minesweeper' && (
              <motion.div key="minesweeper" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskMinesweeper time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={minesLabels} onDesktop={goDesktop}
                  onBack={backToRoom} />)}
              </motion.div>
            )}

            {screenMode === 'snake' && (
              <motion.div key="snake" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskSnake time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={snakeLabels} onDesktop={goDesktop}
                  onBack={backToRoom} />)}
              </motion.div>
            )}

            {screenMode === 'blackjack' && (
              <motion.div key="blackjack" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskBlackjack time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={blackjackLabels} arcade={arcadeLabels} onDesktop={goDesktop}
                  onBack={backToRoom} />)}
              </motion.div>
            )}

            {screenMode === 'solitaire' && (
              <motion.div key="solitaire" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskSolitaire time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={solitaireLabels} arcade={arcadeLabels} onDesktop={goDesktop}
                  onBack={backToRoom} />)}
              </motion.div>
            )}

            {screenMode === 'pong' && (
              <motion.div key="pong" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskPong time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={pongLabels} arcade={arcadeLabels} onDesktop={goDesktop}
                  onBack={backToRoom} />)}
              </motion.div>
            )}

            {screenMode === 'breakout' && (
              <motion.div key="breakout" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskBreakout time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={breakoutLabels} arcade={arcadeLabels} onDesktop={goDesktop}
                  onBack={backToRoom} />)}
              </motion.div>
            )}

            {screenMode === 'chess' && (
              <motion.div key="chess" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskChess time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={chessLabels} arcade={arcadeLabels} onDesktop={goDesktop}
                  onBack={backToRoom} />)}
              </motion.div>
            )}

            {screenMode === 'readme' && (
              <motion.div key="readme" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskReadme
                  time={time}
                  content={readmeContent}
                  labels={readmeLabels}
                  desktopLabel={desktopLabel}
                  backLabel={backLabel}
                  onDesktop={goDesktop}
                  onBack={backToRoom}
                />)}
              </motion.div>
            )}

            {screenMode === 'music' && (
              <motion.div key="music" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskMusic
                  time={time}
                  desktopLabel={desktopLabel}
                  backLabel={backLabel}
                  labels={musicLabels}
                  onDesktop={goDesktop}
                  onBack={backToRoom}
                />)}
              </motion.div>
            )}

            {screenMode === 'legal' && (
              <motion.div key="legal" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskLegal
                  time={time}
                  privacy={legalPrivacy}
                  terms={legalTerms}
                  effectiveDate={legalEffectiveDate}
                  labels={legalLabels}
                  desktopLabel={desktopLabel}
                  backLabel={backLabel}
                  onDesktop={goDesktop}
                  onBack={backToRoom}
                />)}
              </motion.div>
            )}

            {screenMode === 'guestbook' && (
              <motion.div key="guestbook" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskGuestbook
                  time={time}
                  labels={guestbookLabels}
                  desktopLabel={desktopLabel}
                  backLabel={backLabel}
                  onDesktop={goDesktop}
                  onBack={backToRoom}
                />)}
              </motion.div>
            )}

            {screenMode === 'settings' && (
              <motion.div key="settings" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskSettings
                  time={time}
                  labels={settingsLabels}
                  desktopLabel={desktopLabel}
                  backLabel={backLabel}
                  onBack={backToRoom}
                  sfxOn={sfxOn}
                  onSfx={onSfx}
                  sfxVolume={sfxVolume}
                  onSfxVolume={onSfxVolume}
                  musicVolume={musicVolume}
                  onMusicVolume={onMusicVolume}
                  is24h={is24h}
                  onClock={onClock}
                  onDesktop={goDesktop}
                />)}
              </motion.div>
            )}

            {screenMode === 'movie' && (
              <motion.div key="movie" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskMovie
                  time={time}
                  desktopLabel={desktopLabel}
                  backLabel={backLabel}
                  labels={movieLabels}
                  onDesktop={goDesktop}
                  onBack={backToRoom}
                />)}
              </motion.div>
            )}

            {screenMode === "terminal" && (
              <motion.div key="terminal" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {boundary(<DeskTerminal
                  time={time}
                  labels={terminalLabels}
                  desktopLabel={desktopLabel}
                  backLabel={backLabel}
                  onDesktop={goDesktop}
                  onBack={backToRoom}
                  readmeContent={readmeContent}
                  bootCommand={termBoot}
                  onBootHandled={() => setTermBoot(null)}
                />)}
              </motion.div>
            )}
          </AnimatePresence>
          </DeskClockContext.Provider>
          </DeskScreenContext.Provider>
        </div>
      </motion.div>
      {portrait && (
        <div
          className="absolute left-0 right-0 bottom-0 flex items-center px-3"
          style={{ height: MUSIC_BAR_H, backgroundColor: '#0e0a08', borderTop: '1px solid #5a4430' }}
        >
          <NowPlaying labels={nowPlayingLabels} embedded />
        </div>
      )}
      </div>
    </div>
  )
}
