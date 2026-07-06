'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { useStageScale, STAGE_W, STAGE_H } from '@/lib/room/useStageScale'
import { useRoomAudio } from './RoomAudioProvider'
import { DeskIcon } from './DeskIcon'
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

type ScreenMode = 'desktop' | 'browser'

interface Shortcut { id: string; label: string; href: string; icon: React.ReactNode }

interface DeskViewProps {
  shortcuts: Shortcut[]
  backLabel: string
  screenLabel: string
  desktopLabel: string
  expandLabel: string
  browserTitle: string
  speakersLabel: string
  onBack: () => void
}

export function DeskView(props: DeskViewProps) {
  const { shortcuts, backLabel, screenLabel, desktopLabel, expandLabel, browserTitle, speakersLabel, onBack } = props
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
    for (const s of shortcuts) router.prefetch(s.href)
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

  const handleShortcutClick = useCallback((e: React.MouseEvent, href: string) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    if (reduce || isMobile) { router.push(href); return }

    if (screenMode === 'browser') {
      // Navigate existing iframe via replace
      try {
        iframeRef.current?.contentWindow?.location.replace(href)
        setBrowserPath(href)
      } catch { /* ignore */ }
      return
    }

    // Enter browser mode
    activeIconRef.current = e.currentTarget as HTMLAnchorElement
    setBrowserPath(href)
    setScreenMode('browser')
    setIframeLoaded(false)
  }, [reduce, isMobile, router, screenMode])

  // Escape ladder: browser → desktop → room
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (screenMode === 'browser') {
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

  // Idle screensaver: reset timer on any activity, trigger after 90s
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup.png" alt="" draggable={false} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />

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
              <motion.div key="desktop" className="absolute inset-0 flex flex-col"
                style={{ backgroundColor: '#faf8f5' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.3 }}>
                <div className="flex items-center justify-between px-3 h-7 border-b"
                  style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px', color: '#3a3028' }}>
                  <span>{time}</span>
                  <button onClick={(e) => { e.stopPropagation(); onBack() }}
                    className="hover:text-[#6a5040] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                    style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace' }} aria-label={backLabel}>← {backLabel}</button>
                </div>
                <nav aria-label={screenLabel} className="flex-1 flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-x-8 gap-y-5 px-4">
                    {shortcuts.map((s) => (
                      <DeskIcon key={s.id} label={s.label} href={s.href} icon={s.icon}
                        onClick={(e) => handleShortcutClick(e, s.href)} />
                    ))}
                  </div>
                </nav>

                {/* Idle screensaver overlay */}
                {screensaver && !reduce && (
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: '#faf8f5' }} aria-hidden>
                    <div className="relative"
                      style={{
                        width: 40, height: 20,
                        animation: 'screensaver-drift 10s linear infinite',
                        '--sw': SCREEN_W + 'px', '--sh': SCREEN_H + 'px',
                      } as React.CSSProperties}>
                      <div style={{
                        width: 40, height: 20,
                        backgroundColor: '#3a3028',
                        borderRadius: '2px',
                        fontFamily: 'var(--font-pixel), "Courier New", monospace',
                        fontSize: '8px',
                        color: '#faf8f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>AH</div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {screenMode === 'browser' && (
              <motion.div key="browser" className="absolute inset-0 flex flex-col"
                style={{ backgroundColor: '#faf8f5' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                {/* Top strip */}
                <div className="flex items-center justify-between px-3 h-7 border-b flex-shrink-0"
                  style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px', color: '#3a3028' }}>
                  <span>{time}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={goDesktop}
                      className="hover:text-[#6a5040] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                      style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace' }}>{desktopLabel}</button>
                    <button onClick={goExpand}
                      className="hover:text-[#6a5040] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                      style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace' }}>{expandLabel}</button>
                    <button onClick={(e) => { e.stopPropagation(); onBack() }}
                      className="hover:text-[#6a5040] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                      style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace' }} aria-label={backLabel}>← {backLabel}</button>
                  </div>
                </div>
                {/* Iframe area */}
                <div className="flex-1 relative">
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
                    className="w-full h-full border-0"
                    style={{ backgroundColor: '#faf8f5' }}
                    onLoad={() => setIframeLoaded(true)}
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
