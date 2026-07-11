'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { useStageScale, STAGE_W, STAGE_H } from '@/lib/room/useStageScale'
import { useRoomAudio } from './RoomAudioProvider'
import { DeskDesktop, type DesktopShortcut } from './DeskDesktop'
import { DeskPaint, type PaintLabels } from './DeskPaint'
import { DeskMinesweeper, type MinesLabels } from './DeskMinesweeper'
import { DeskReadme } from './DeskReadme'
import { DeskMusic } from './DeskMusic'
import { DeskLegal, type LegalLabels } from './DeskLegal'
import { DeskSettings, type SettingsLabels } from './DeskSettings'
import { DeskTerminal } from './DeskTerminal'
import { MusicNotes } from './MusicNotes'

const SCREEN_X = 436; const SCREEN_Y = 152; const SCREEN_W = 536; const SCREEN_H = 308
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
type ScreenMode = 'desktop' | 'paint' | 'minesweeper' | 'readme' | 'music' | 'legal' | 'settings' | 'terminal'

interface DeskViewProps {
  shortcuts: DesktopShortcut[]
  backLabel: string
  screenLabel: string
  desktopLabel: string
  speakersLabel: string
  lampOn: boolean
  lampFlicker: boolean
  lampLabel: string
  paintLabels: PaintLabels
  minesLabels: MinesLabels
  /** Labels for the readme popup */
  readmeLabels: { title: string; close: string }
  /** Labels for the music player */
  musicLabels: { title: string; nowPlaying: string; select: string }
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
  is24h: boolean; onClock: (v: boolean) => void
  /** Settings: calm mode toggle */
  calm: boolean; onCalm: (v: boolean) => void
  legalEffectiveDate: string
  /** site-text.txt content for the readme popup */
  readmeContent: string
  /** Labels for the Terminal app */
  terminalLabels: { title: string }
  /** Konami code easter egg trigger */
  konamiOpen: boolean
  /** Called after the terminal has been opened so the parent can reset the flag */
  onKonamiHandled: () => void
  onToggleLamp: () => void
  onBack: () => void
}

export function DeskView(props: DeskViewProps) {
  const { shortcuts, backLabel, screenLabel, desktopLabel, speakersLabel, lampOn, lampFlicker, lampLabel, paintLabels, minesLabels, readmeLabels, musicLabels, legalLabels, legalPrivacy, legalTerms, legalEffectiveDate, settingsLabels, sfxOn, onSfx, sfxVolume, onSfxVolume, musicVolume, onMusicVolume, is24h, onClock, calm, onCalm, readmeContent, terminalLabels, konamiOpen, onKonamiHandled, onToggleLamp, onBack } = props
  const { scale } = useStageScale()
  const reduce = useReducedMotion()
  const { playing, toggle } = useRoomAudio()
  const [showDesktop, setShowDesktop] = useState(false)
  const [time, setTime] = useState('')
  const [screenMode, setScreenMode] = useState<ScreenMode>('desktop')
  const [mouseJitter, setMouseJitter] = useState(false)
  const [screensaver, setScreensaver] = useState(false)
  const [backPending, setBackPending] = useState(false)
  const backPendingTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const activeIconRef = useRef<HTMLAnchorElement>(null)
  const mouseRef = useRef<HTMLDivElement>(null)
  const mouseTarget = useRef({ x: MOUSE_REST_X, y: MOUSE_REST_Y })
  const mouseCurrent = useRef({ x: MOUSE_REST_X, y: MOUSE_REST_Y })
  const rafRef = useRef(0)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

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

  // Konami code: open terminal when triggered from Room
  useEffect(() => {
    if (konamiOpen) {
      setScreenMode("terminal")
      onKonamiHandled()
    }
  }, [konamiOpen, onKonamiHandled])
  // Return to desktop
  const goDesktop = useCallback(() => {
    setScreenMode('desktop')
    activeIconRef.current?.focus()
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

  return (
    <div className="relative" style={{ width: '100%', height: '100vh', overflow: 'hidden', backgroundColor: '#000', cursor: 'default' }}
      onClick={(e) => {
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
      <motion.div style={{
        width: STAGE_W, height: STAGE_H, position: 'absolute', top: '50%', left: '50%',
        transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center center',
      }} initial={reduce ? undefined : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
        {/* Lamp-off close-up */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup-lamp-off.png" alt="" draggable={false} className="absolute inset-0 w-full h-full" style={{ imageRendering: 'pixelated' }} />
        {/* Lamp-on close-up */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup.png" alt="" draggable={false}
          className={`absolute inset-0 w-full h-full ${lampFlicker && !reduce ? 'animate-[lamp-flicker_0.5s_ease-out]' : ''}`}
          style={{ imageRendering: 'pixelated', opacity: lampOn ? 1 : 0, transition: reduce ? 'none' : 'opacity 0.4s ease' }} />

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
                Click again to return to room
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
                  shortcuts={shortcuts}
                  screensaver={screensaver}
                  reduce={reduce}
                  screenW={SCREEN_W}
                  screenH={SCREEN_H}
                  onBack={(e) => { e.stopPropagation(); onBack() }}
                  onShortcutClick={handleShortcutClick}
                />
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

            {screenMode === 'readme' && (
              <motion.div key="readme" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskReadme
                  content={readmeContent}
                  labels={readmeLabels}
                  desktopLabel={desktopLabel}
                  onDesktop={goDesktop}
                />
              </motion.div>
            )}

            {screenMode === 'music' && (
              <motion.div key="music" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskMusic
                  time={time}
                  desktopLabel={desktopLabel}
                  labels={musicLabels}
                  onDesktop={goDesktop}
                />
              </motion.div>
            )}

            {screenMode === 'legal' && (
              <motion.div key="legal" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskLegal
                  privacy={legalPrivacy}
                  terms={legalTerms}
                  effectiveDate={legalEffectiveDate}
                  labels={legalLabels}
                  desktopLabel={desktopLabel}
                  onDesktop={goDesktop}
                />
              </motion.div>
            )}

            {screenMode === 'settings' && (
              <motion.div key="settings" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskSettings
                  labels={settingsLabels}
                  desktopLabel={desktopLabel}
                  sfxOn={sfxOn}
                  onSfx={onSfx}
                  sfxVolume={sfxVolume}
                  onSfxVolume={onSfxVolume}
                  musicVolume={musicVolume}
                  onMusicVolume={onMusicVolume}
                  is24h={is24h}
                  onClock={onClock}
                  calm={calm}
                  onCalm={onCalm}
                  onDesktop={goDesktop}
                />
              </motion.div>
            )}

            {screenMode === "terminal" && (
              <motion.div key="terminal" className="absolute inset-0"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.2 }}>
                <DeskTerminal
                  labels={terminalLabels}
                  desktopLabel={desktopLabel}
                  onDesktop={goDesktop}
                  readmeContent={readmeContent}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}
