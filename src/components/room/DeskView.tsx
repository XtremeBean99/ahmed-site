'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useReducedMotion, motion, AnimatePresence } from 'framer-motion'
import { useStageScale, STAGE_W, STAGE_H } from '@/lib/room/useStageScale'
import { DeskIcon } from './DeskIcon'

// Screen rect in stage coords (measured from close_up_monitor.png at 4px stride)
const SCREEN_X = 436
const SCREEN_Y = 152
const SCREEN_W = 536
const SCREEN_H = 308

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
  onBack: () => void
}

export function DeskView({ shortcuts, backLabel, screenLabel, onBack }: DeskViewProps) {
  const scale = useStageScale()
  const router = useRouter()
  const reduce = useReducedMotion()
  const [showDesktop, setShowDesktop] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [time, setTime] = useState('')

  // Prefetch shortcuts
  useEffect(() => {
    for (const s of shortcuts) router.prefetch(s.href)
  }, [shortcuts, router])

  // Live clock
  useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      )
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // Show desktop after loading beat
  useEffect(() => {
    if (reduce) {
      setShowDesktop(true)
      return
    }
    const id = setTimeout(() => setShowDesktop(true), 500)
    return () => clearTimeout(id)
  }, [reduce])

  const handleShortcutClick = useCallback(
    (e: React.MouseEvent, href: string) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      e.preventDefault()
      if (reduce) {
        router.push(href)
        return
      }
      setLeaving(true)
      setTimeout(() => router.push(href), 150)
    },
    [reduce, router],
  )

  // Screen area style
  const screenStyle: React.CSSProperties = {
    position: 'absolute',
    left: SCREEN_X,
    top: SCREEN_Y,
    width: SCREEN_W,
    height: SCREEN_H,
    overflow: 'hidden',
  }

  return (
    <div
      className="relative"
      style={{ width: '100%', height: '100vh', overflow: 'hidden', backgroundColor: '#000', cursor: 'default' }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('[data-screen-area]')) onBack()
      }}
    >
      {/* Stage */}
      <motion.div
        style={{
          width: STAGE_W,
          height: STAGE_H,
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        initial={reduce ? undefined : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Background image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/room/desk-closeup.png"
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Screen area overlay */}
        <div data-screen-area style={screenStyle}>
          {/* Desktop (fades in over the LOADING caption) */}
          <AnimatePresence>
            {showDesktop && (
              <motion.div
                className="absolute inset-0 flex flex-col"
                style={{ backgroundColor: '#faf8f5' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.3 }}
              >
                {/* Top strip with clock */}
                <div
                  className="flex items-center justify-between px-3 h-7 border-b"
                  style={{
                    backgroundColor: '#e8e0d8',
                    borderColor: '#c8b8a8',
                    fontFamily: 'var(--font-pixel), "Courier New", monospace',
                    fontSize: '10px',
                    color: '#3a3028',
                  }}
                >
                  <span>{time}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onBack()
                    }}
                    className="hover:text-[#6a5040] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
                    style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace' }}
                    aria-label={backLabel}
                  >
                    ← {backLabel}
                  </button>
                </div>

                {/* Shortcut icons area */}
                <nav
                  aria-label={screenLabel}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="grid grid-cols-3 gap-x-8 gap-y-5 px-4">
                    {shortcuts.map((s) => (
                      <DeskIcon
                        key={s.id}
                        label={s.label}
                        href={s.href}
                        icon={s.icon}
                        onClick={(e) => handleShortcutClick(e, s.href)}
                      />
                    ))}
                  </div>
                </nav>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* White bloom on navigation */}
      <AnimatePresence>
        {leaving && !reduce && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ backgroundColor: '#faf8f5' }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
