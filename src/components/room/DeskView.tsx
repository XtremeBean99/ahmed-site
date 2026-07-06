'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { useStageScale, STAGE_W, STAGE_H } from '@/lib/room/useStageScale'
import { useRoomAudio } from './RoomAudioProvider'
import { DeskIcon } from './DeskIcon'

const SCREEN_X = 436
const SCREEN_Y = 152
const SCREEN_W = 536
const SCREEN_H = 308

// Speaker rects in stage coords
const SPEAKER_LEFT = { x: 190, y: 265, w: 175, h: 300 }
const SPEAKER_RIGHT = { x: 1005, y: 270, w: 215, h: 300 }

// Mouse travel box
const MOUSE_X_MIN = 975
const MOUSE_X_MAX = 1140
const MOUSE_Y_MIN = 572
const MOUSE_Y_MAX = 635
const MOUSE_REST_X = 1007
const MOUSE_REST_Y = 608

interface Shortcut {
  id: string
  label: string
  href: string
  icon: React.ReactNode
}

interface DeskViewProps {
  shortcuts: Shortcut[]
  backLabel: string
  screenLabel: string
  speakersLabel: string
  onBack: () => void
}

export function DeskView({ shortcuts, backLabel, screenLabel, speakersLabel, onBack }: DeskViewProps) {
  const scale = useStageScale()
  const router = useRouter()
  const reduce = useReducedMotion()
  const { playing, toggle } = useRoomAudio()
  const [showDesktop, setShowDesktop] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [time, setTime] = useState('')
  const mouseRef = useRef<HTMLImageElement>(null)
  const mouseTarget = useRef({ x: MOUSE_REST_X, y: MOUSE_REST_Y })
  const mouseCurrent = useRef({ x: MOUSE_REST_X, y: MOUSE_REST_Y })
  const rafRef = useRef<number>(0)

  // Prefetch
  useEffect(() => {
    for (const s of shortcuts) router.prefetch(s.href)
  }, [shortcuts, router])

  // Live clock
  useEffect(() => {
    const update = () => setTime(
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    )
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
    (e: React.MouseEvent, href: string) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      if (reduce) { router.push(href); return }
      setLeaving(true)
      setTimeout(() => router.push(href), 150)
    },
    [reduce, router],
  )

  // Mouse follower (pointermove → lerp via RAF)
  useEffect(() => {
    if (reduce) return
    const hasFinePointer = matchMedia('(pointer: fine)').matches
    if (!hasFinePointer) return

    const onMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth
      const ny = e.clientY / window.innerHeight
      mouseTarget.current.x = MOUSE_X_MIN + nx * (MOUSE_X_MAX - MOUSE_X_MIN)
      mouseTarget.current.y = MOUSE_Y_MIN + ny * (MOUSE_Y_MAX - MOUSE_Y_MIN)
    }
    const onLeave = () => {
      mouseTarget.current.x = MOUSE_REST_X
      mouseTarget.current.y = MOUSE_REST_Y
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
    <div
      className="relative"
      style={{ width: '100%', height: '100vh', overflow: 'hidden', backgroundColor: '#000', cursor: 'default' }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('[data-screen-area]')) onBack()
      }}
    >
      <motion.div
        style={{
          width: STAGE_W, height: STAGE_H,
          position: 'absolute', top: '50%', left: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        initial={reduce ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/room/desk-closeup.png" alt="" draggable={false}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Speaker hotspots */}
        <button
          onClick={(e) => { e.stopPropagation(); toggle() }}
          aria-label={speakersLabel}
          className="absolute cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2 transition-transform duration-[120ms] active:scale-[0.98]"
          style={{ left: SPEAKER_LEFT.x, top: SPEAKER_LEFT.y, width: SPEAKER_LEFT.w, height: SPEAKER_LEFT.h }}
        >
          {/* Muted glyph */}
          {!playing && (
            <span className="absolute top-2 right-2 text-[#a09080] opacity-70 pointer-events-none"
              style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px' }}>
              ✕♪
            </span>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggle() }}
          aria-label={speakersLabel}
          className="absolute cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2 transition-transform duration-[120ms] active:scale-[0.98]"
          style={{ left: SPEAKER_RIGHT.x, top: SPEAKER_RIGHT.y, width: SPEAKER_RIGHT.w, height: SPEAKER_RIGHT.h }}
        >
          {!playing && (
            <span className="absolute top-2 right-2 text-[#a09080] opacity-70 pointer-events-none"
              style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: '10px' }}>
              ✕♪
            </span>
          )}
        </button>

        {/* Decorative mouse follower */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={mouseRef}
          src="/room/mouse.png"
          alt=""
          draggable={false}
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            imageRendering: 'pixelated',
            transform: `translate(${MOUSE_REST_X}px, ${MOUSE_REST_Y}px)`,
            willChange: 'transform',
          }}
        />

        {/* Screen overlay */}
        <div data-screen-area style={screenStyle}>
          <AnimatePresence>
            {showDesktop && (
              <motion.div className="absolute inset-0 flex flex-col"
                style={{ backgroundColor: '#faf8f5' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
              >
                <div className="flex items-center justify-between px-3 h-7 border-b"
                  style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8',
                    fontFamily: 'var(--font-pixel), "Courier New", monospace',
                    fontSize: '10px', color: '#3a3028' }}
                >
                  <span>{time}</span>
                  <button onClick={(e) => { e.stopPropagation(); onBack() }}
                    className="hover:text-[#6a5040] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                    style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace' }}
                    aria-label={backLabel}
                  >
                    ← {backLabel}
                  </button>
                </div>
                <nav aria-label={screenLabel} className="flex-1 flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-x-8 gap-y-5 px-4">
                    {shortcuts.map((s) => (
                      <DeskIcon key={s.id} label={s.label} href={s.href} icon={s.icon}
                        onClick={(e) => handleShortcutClick(e, s.href)} />
                    ))}
                  </div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* White bloom */}
      <AnimatePresence>
        {leaving && !reduce && (
          <motion.div className="fixed inset-0 z-50 pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }} style={{ backgroundColor: '#faf8f5' }} />
        )}
      </AnimatePresence>
    </div>
  )
}
