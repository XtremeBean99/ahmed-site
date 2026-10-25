'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/use-reduced-motion'
import type { StageRect, TourStepId } from '@/lib/room/tour'

export interface TourLabels {
  start: string
  title: string
  next: string
  back: string
  skip: string
  /** `{n}` of `{total}` */
  progress: string
  enter: string
  stay: string
  steps: Record<TourStepId, { title: string; body: string }>
}

/**
 * The guided tour's spotlight: rendered inside RoomStage, so it is in stage
 * coordinates and follows the fit scale, letterboxing and phone pan. A huge
 * box-shadow dims everything but the target; with no target the whole room dims.
 */
export function TourSpotlight({ rect }: { rect: StageRect | null }) {
  const reduce = useReducedMotion()
  const r = rect ?? { x: 704, y: 384, w: 0, h: 0 }
  return (
    <motion.div
      aria-hidden
      className="absolute pointer-events-none z-30"
      initial={false}
      animate={{ left: r.x, top: r.y, width: r.w, height: r.h }}
      transition={{ duration: reduce ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
      style={{
        boxShadow: '0 0 0 4000px rgba(20,12,8,0.62)',
        outline: rect ? '2px solid #f6da9c' : 'none',
        outlineOffset: 2,
        borderRadius: 3,
      }}
    />
  )
}

interface TourCardProps {
  labels: TourLabels
  steps: readonly TourStepId[]
  index: number
  onNext: () => void
  onBack: () => void
  onClose: () => void
  /** Last step: sit down at the computer. */
  onEnter: () => void
}

/**
 * The tour's caption card, fixed to the viewport (not the stage) so the text
 * stays a readable size on any screen. Arrow keys step, Escape closes.
 */
export function TourCard({ labels, steps, index, onNext, onBack, onClose, onEnter }: TourCardProps) {
  const primaryRef = useRef<HTMLButtonElement>(null)
  const id = steps[index]
  const step = labels.steps[id]
  const last = index === steps.length - 1

  useEffect(() => { primaryRef.current?.focus({ preventScroll: true }) }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
      else if (e.key === 'ArrowRight' && !last) { e.preventDefault(); onNext() }
      else if (e.key === 'ArrowLeft' && index > 0) { e.preventDefault(); onBack() }
    }
    // Capture phase, so the room's own Escape and arrow handlers never see these.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [index, last, onNext, onBack, onClose])

  const btn = (tone: 'dark' | 'light'): React.CSSProperties => ({
    fontFamily: 'var(--font-pixel), "Courier New", monospace',
    fontSize: 12,
    minHeight: 34,
    padding: '0 12px',
    border: '2px solid #5a4430',
    borderRadius: 3,
    backgroundColor: tone === 'dark' ? '#5a4430' : 'transparent',
    color: '#e8d5b0',
    cursor: 'pointer',
  })

  return (
    <div
      role="dialog"
      aria-label={labels.title}
      aria-describedby="room-tour-body"
      className="fixed left-1/2 -translate-x-1/2 z-[60] w-[min(420px,calc(100vw-32px))]"
      style={{ bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        className="border-2 px-4 py-3 flex flex-col gap-2"
        style={{
          backgroundColor: '#3d2e1e',
          borderColor: '#5a4430',
          borderRadius: 3,
          color: '#e8d5b0',
          boxShadow: '3px 3px 0 rgba(0,0,0,0.4)',
          fontFamily: 'var(--font-pixel), "Courier New", monospace',
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 style={{ fontSize: 14, margin: 0 }}>{step.title}</h2>
          <span style={{ fontSize: 10, color: '#a09080' }}>
            {labels.progress.replace('{n}', String(index + 1)).replace('{total}', String(steps.length))}
          </span>
        </div>
        <p id="room-tour-body" aria-live="polite" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{step.body}</p>
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={onClose} style={{ ...btn('light'), border: 'none', padding: 0, color: '#a09080' }}>
            {last ? labels.stay : labels.skip}
          </button>
          <span className="flex-1" />
          {index > 0 && <button type="button" onClick={onBack} style={btn('light')}>{labels.back}</button>}
          <button ref={primaryRef} type="button" onClick={last ? onEnter : onNext} style={btn('dark')}>
            {last ? labels.enter : labels.next}
          </button>
        </div>
      </div>
    </div>
  )
}
