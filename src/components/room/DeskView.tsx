'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { useStageScale, STAGE_W, STAGE_H } from '@/lib/room/useStageScale'
import { useRoomAudio } from './RoomAudioProvider'
import { DeskDesktop, type DesktopShortcut } from './DeskDesktop'
import { DeskPaint, type PaintLabels } from './DeskPaint'
import { DeskMinesweeper, type MinesLabels } from './DeskMinesweeper'
import { ScreenStrip, StripButton } from './ScreenStrip'
import { MusicNotes } from './MusicNotes'

const SCREEN_X = 436; const SCREEN_Y = 152; const SCREEN_W = 536; const SCREEN_H = 308
const SPEAKER_LEFT = { x: 190, y: 265, w: 175, h: 300 }
const SPEAKER_RIGHT = { x: 1005, y: 270, w: 215, h: 300 }
// Driver holes (tweeter + woofer) per speaker, stage coords, measured from the art.
// Module-level constants so the MusicNotes effect dependency stays referentially stable.
const HOLES_LEFT = [
  { cx: 284, cy: 349, r: 34 },
  { cx: 284, cy: 478, r: 50 },
]
const HOLES_RIGHT = [
  { cx: 1118, cy: 352, r: 38 },
  { cx: 1115, cy: 472, r: 52 },
]
const MOUSE_X_MIN = 975; const MOUSE_X_MAX = 1140
const MOUSE_Y_MIN = 572; const MOUSE_Y_MAX = 635
const MOUSE_REST_X = 1007; const MOUSE_REST_Y = 608
const MOBILE_CUTOFF = 700

type ScreenMode = 'desktop' | 'browser' | 'paint' | 'minesweeper'

interface DeskViewProps {
  shortcuts: DesktopShortcut[]
  backLabel: string
  screenLabel: string
  desktopLabel: string
  expandLabel: string
  browserTitle: string
  speakersLabel: string
  /** Persisted lamp state — picks the close-up art variant */
  lampOn: boolean
  /** True for 500ms after a toggle; drives the flicker animation */
  lampFlicker: boolean
  /** Accessible label for the lamp button (room.lampLabel) */
  lampLabel: string
  /** Labels for the Paint app */
  paintLabels: PaintLabels
  /** Labels for the Minesweeper app */
  minesLabels: MinesLabels
  onToggleLamp: () => void
  onBack: () => void
}

export function DeskView(props: DeskViewProps) {
  const { shortcuts, backLabel, screenLabel, desktopLabel, expandLabel, browserTitle, speakersLabel, lampOn, lampFlicker, lampLabel, paintLabels, minesLabels, onToggleLamp, onBack } = props
  const scale = useStageScale()
  const router = useRouter()
  const reduce = useReducedMotion()
  const { playing, toggle } = useRoomAudio()
  const [showDesktop, setShowDesktop] = useState(false)
  const [time, setTime] = useState('')
  const [screenMode, setScreenMode] = useState<ScreenMode>('desktop')
  const [browserPath, setBrowserPath] = useState('')
  const [iframeLoaded, setIframeLoaded] = useState(false)
  const [mouseJitter, setMouseJitter] = useState(false)
  const [screensaver, setScreensaver] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const activeIconRef = useRef<HTMLAnchorElement>(null)
  const mouseRef = useRef<HTMLDivElement>(null)
  const mouseTarget = useRef({ x: MOUSE_REST_X, y: MOUSE_REST_Y })
  const mouseCurrent = useRef({ x: MOUSE_REST_X, y: MOUSE_REST_Y })
  const rafRef = useRef(0)
  const pathTimerRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_CUTOFF

  // Prefetch
  useEffect(() => {
    for (const s of shortcuts) if (s.kind === 'site') router.prefetch(s.target)
  }, [shortcuts, router])

  // Live clock
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Loading beat
  useEffect(() => {
    const id = setTimeout(() => setShowDesktop(true), reduce ? 0 : 500)
    return () => clearTimeout(id)
  }, [reduce])

  // Poll iframe path while in browser mode
  useEffect(() => {
    if (screenMode !== 'browser' || !iframeRef.current) return
    pathTimerRef.current = setInterval(() => {
      try {
        const w = iframeRef.current?.contentWindow
        if (w) setBrowserPath(w.location.pathname + w.location.hash)
      } catch { /* cross-origin — ignore */ }
    }, 500)
    return () => { if (pathTimerRef.current) clearInterval(pathTimerRef.current) }
  }, [screenMode])

  const handleShortcutClick = useCallback(
    (e: React.MouseEvent, s: DesktopShortcut) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      if (s.kind === 'external') {
        window.open(s.target, '_blank', 'noopener,noreferrer')
        return
      }
      if (s.kind === 'app') {
        setScreenMode(s.target as ScreenMode)
        return
      }
      if (reduce || isMobile) { router.push(s.target); return }
      if (screenMode === 'browser') {
        try {
          iframeRef.current?.contentWindow?.location.replace(s.target)
          setBrowserPath(s.target)
        } catch { /* ignore */ }
        return
      }
      activeIconRef.current = e.currentTarget as HTMLAnchorElement
      setBrowserPath(s.target)
      setScreenMode('browser')
      setIframeLoaded(false)
    },
    [reduce, isMobile, router, screenMode],
  )

  // Escape ladder: paint/minesweeper/browser → desktop → room
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (screenMode !== 'desktop') {
        setScreenMode('desktop')
        activeIconRef.current?.focus()
      } else {
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screenMode, onBack])

  // Return to desktop
  const goDesktop = useCallback(() => {
    setScreenMode('desktop')
    setIframeLoaded(false)
    activeIconRef.current?.focus()
  }, [])

  // Expand to full page in new tab
  const goExpand = useCallback(() => {
    window.open(browserPath || '/home', '_blank')
  }, [browserPath])

  // Focus iframe on enter browser mode
  useEffect(() => {
    if (screenMode === 'browser' && iframeRef.current) {
      setTimeout(() => iframeRef.current?.focus(), 100)
    }
  }, [screenMode])

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

  // Mouse follower (unchanged)
  useEffect(() => {
    if (reduce) return
    if (!matchMedia('(pointer: fine)').matches) return
    const onMove = (e: PointerEvent) => {
      mouseTarget.current.x = MOUSE_X_MIN + (e.clientX / window.innerWidth) * (MOUSE_X_MAX - MOUSE_X_MIN)
      mouseTarget.current.y = MOUSE_Y_MIN + (e.clientY / window.innerHeight) * (MOUSE_Y_MAX - MOUSE_Y_MIN)
    }
    const onLeave = () => { mouseTarget.current.x = MOUSE_REST_X; mouseTarget.current.y = MOUSE_REST_Y }
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
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(rafRef.current)
    }
  }, [reduce])

  const screenStyle: React.CSSProperties = {
    position: 'absolute', left: SCREEN_X, top: SCREEN_Y,
    width: SCREEN_W, height: SCREEN_H, overflow: 'hidden',
  }

  return (
    <div className="relative" style={{ width: '100%', height: '100vh', overflow: 'hidden', backgroundColor: '#000', cursor: 'default' }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-screen-area]')) return
        setMouseJitter(true); setTimeout(() => setMouseJitter(false), 300)
        onBack()
      }}>
      <motion.div style={{
        width: STAGE_W, height: STAGE_H, position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center center',
      }} initial={reduce ? undefined : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {/* Lamp-off close-up (always present, behind the lit version) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup-lamp-off.png" alt="" draggable={false} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />
        {/* Lamp-on close-up (fades out when the lamp is off, flickers on toggle) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup.png" alt="" draggable={false}
          className={`absolute inset-0 w-full h-full ${lampFlicker && !reduce ? 'animate-[lamp-flicker_0.5s_ease-out]' : ''}`}
          style={{ imageRendering: 'pixelated', opacity: lampOn ? 1 : 0, transition: reduce ? 'none' : 'opacity 0.4s ease' }} />

        {/* Desk lamp toggle (left edge of the close-up) */}
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

        {/* Music notes emanating from the speaker driver holes */}
        <MusicNotes holes={HOLES_LEFT} startDelay={0} />
        <MusicNotes holes={HOLES_RIGHT} startDelay={550} />

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

        {/* Screen area */}
        <div data-screen-area style={screenStyle}>
          <AnimatePresence mode="wait">
            {screenMode === 'desktop' && showDesktop && (
              <motion.div key="desktop" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}>
                <DeskDesktop
                  time={time}
                  backLabel={backLabel}
                  screenLabel={screenLabel}
                  shortcuts={isMobile ? shortcuts.filter((s) => s.kind === 'site') : shortcuts}
                  screensaver={screensaver}
                  reduce={reduce}
                  screenW={SCREEN_W}
                  screenH={SCREEN_H}
                  onBack={(e) => { e.stopPropagation(); onBack() }}
                  onShortcutClick={handleShortcutClick}
                />
              </motion.div>
            )}

            {screenMode === 'browser' && (
              <motion.div key="browser" className="absolute inset-0 flex flex-col"
                style={{ backgroundColor: '#faf8f5' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <ScreenStrip time={time}>
                  <StripButton onClick={goDesktop}>{desktopLabel}</StripButton>
                  <StripButton onClick={goExpand}>{expandLabel}</StripButton>
                  <StripButton onClick={(e) => { e.stopPropagation(); onBack() }} ariaLabel={backLabel}>← {backLabel}</StripButton>
                </ScreenStrip>
                {/* Iframe area — zoomed out 25% so site content appears smaller */}
                <div className="flex-1 relative overflow-hidden">
                  {!iframeLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px', color: '#3a3028', backgroundColor: '#faf8f5' }}>
                      LOADING…
                    </div>
                  )}
                  <iframe
                    ref={iframeRef}
                    src={browserPath}
                    title={browserTitle}
                    className="border-0 absolute top-0 left-0"
                    style={{
                      backgroundColor: '#faf8f5',
                      width: `${SCREEN_W / 0.75}px`,
                      height: `${(SCREEN_H - 28) / 0.75}px`,
                      transform: 'scale(0.75)',
                      transformOrigin: 'top left',
                    }}
                    onLoad={() => setIframeLoaded(true)}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                </div>
              </motion.div>
            )}

            {screenMode === 'paint' && (
              <motion.div key="paint" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskPaint time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={paintLabels} onDesktop={goDesktop}
                  onBack={(e) => { e.stopPropagation(); onBack() }} />
              </motion.div>
            )}

            {screenMode === 'minesweeper' && (
              <motion.div key="minesweeper" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskMinesweeper time={time} backLabel={backLabel} desktopLabel={desktopLabel}
                  labels={minesLabels} onDesktop={goDesktop}
                  onBack={(e) => { e.stopPropagation(); onBack() }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
