'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, RefObject } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useT } from '@/lib/i18n/client'
import { fill } from './event-text'
import { useCatanLayout } from './layout'
import type { TutorialStep } from '@/lib/games/catan/tutorial'
import { COLORS, PIXEL_FONT, PixelButton } from './ui'

interface SpotlightBox {
  id: string
  rect: DOMRect
}

const SPOTLIGHT_CSS = `
  @keyframes catan-spotlight-pulse {
    0%, 100% { outline-color: rgba(245, 184, 61, 0.95); outline-offset: 2px; }
    50% { outline-color: rgba(245, 184, 61, 0.35); outline-offset: 4px; }
  }
  .catan-spotlight {
    position: fixed;
    pointer-events: none;
    outline: 2px solid rgba(245, 184, 61, 0.95);
    animation: catan-spotlight-pulse 1.1s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .catan-spotlight { animation: none; }
  }
`

export function TutorialSpotlight({
  ids,
  zIndex = 40,
  refreshKey = '',
}: {
  ids: readonly string[]
  zIndex?: number
  refreshKey?: string | number
}) {
  const reduceMotion = useReducedMotion()
  const [boxes, setBoxes] = useState<SpotlightBox[]>([])
  const idsKey = ids.join(',')

  useLayoutEffect(() => {
    const measure = () => {
      const next: SpotlightBox[] = []
      for (const id of ids) {
        const el = document.querySelector<HTMLElement>(`[data-tutorial="${id}"]`)
        if (el) next.push({ id, rect: el.getBoundingClientRect() })
      }
      setBoxes(next)
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [idsKey, ids, refreshKey])

  const rendered = boxes.map((box) => (
    <div
      key={box.id}
      aria-hidden
      className="catan-spotlight"
      style={{
        left: box.rect.left,
        top: box.rect.top,
        width: box.rect.width,
        height: box.rect.height,
        zIndex,
        animation: reduceMotion ? 'none' : undefined,
      }}
    />
  ))

  return (
    <>
      <style>{SPOTLIGHT_CSS}</style>
      {typeof document !== 'undefined' ? createPortal(rendered, document.body) : null}
    </>
  )
}

export type TutorialCoachPlacement = 'board' | 'dock' | 'sheet'

export interface TutorialCoachProps {
  step: TutorialStep
  stepIndex: number
  totalSteps: number
  canGoBack: boolean
  isLast: boolean
  canAdvance: boolean
  placement: TutorialCoachPlacement
  boardRef: RefObject<HTMLDivElement | null>
  refreshKey: string | number
  onNext: () => void
  onBack: () => void
  onExit: () => void
}

export function TutorialCoach({
  step,
  stepIndex,
  totalSteps,
  canGoBack,
  isLast,
  canAdvance,
  placement,
  boardRef,
  refreshKey,
  onNext,
  onBack,
  onExit,
}: TutorialCoachProps) {
  const t = useT()
  const d = t.catan.tutorial
  const { coarse } = useCatanLayout()
  const [collapsed, setCollapsed] = useState(false)
  const [boardPlacement, setBoardPlacement] = useState<'top' | 'bottom'>('bottom')
  const nextRef = useRef<HTMLButtonElement | null>(null)

  const copy = d.steps[step.id]
  const ids = useMemo(() => step.highlight.ui ?? [], [step.highlight.ui])
  const verb = coarse ? d.verb.tap : d.verb.click
  const verbLower = coarse ? d.verbLower.tap : d.verbLower.click
  const body = fill(copy.body, { verb, verbLower, target: 10 })
  const stepLabel = fill(d.step, { current: stepIndex + 1, total: totalSteps })

  useLayoutEffect(() => {
    if (placement !== 'board') return
    const measure = () => {
      const board = boardRef.current
      if (!board) return
      const boardRect = board.getBoundingClientRect()
      let minTop = Infinity
      let maxBottom = -Infinity
      for (const id of ids) {
        const el = document.querySelector<HTMLElement>(`[data-tutorial="${id}"]`)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        minTop = Math.min(minTop, rect.top)
        maxBottom = Math.max(maxBottom, rect.bottom)
      }
      if (minTop === Infinity) {
        setBoardPlacement('top')
        return
      }
      const centerY = (minTop + maxBottom) / 2
      const distanceToTop = centerY - boardRect.top
      const distanceToBottom = boardRect.bottom - centerY
      setBoardPlacement(distanceToTop >= distanceToBottom ? 'top' : 'bottom')
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [placement, boardRef, ids, refreshKey])

  useEffect(() => {
    if (canAdvance) nextRef.current?.focus({ preventScroll: true })
  }, [canAdvance, step.id, placement])

  const panelBase: CSSProperties = {
    backgroundColor: COLORS.panel,
    border: `2px solid ${COLORS.panelBorder}`,
    color: COLORS.text,
    padding: 8,
    pointerEvents: 'auto',
  }

  const boardStyle: CSSProperties = {
    position: 'absolute',
    left: 12,
    width: 360,
    maxWidth: 'calc(100% - 24px)',
    boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
    zIndex: 30,
  }
  if (boardPlacement === 'top') boardStyle.top = 12
  else boardStyle.bottom = 12

  const panelStyle: CSSProperties =
    placement === 'board'
      ? boardStyle
      : {
          boxShadow: `2px 2px 0 ${COLORS.panelDark}`,
          flexShrink: 0,
          margin: placement === 'sheet' ? '0 0 8px' : 0,
        }

  return (
    <>
      <TutorialSpotlight ids={ids} zIndex={placement === 'sheet' ? 80 : 40} refreshKey={refreshKey} />
      <div style={{ ...panelBase, ...panelStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>{stepLabel}</span>
          <h2 style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, margin: 0, flex: 1 }}>{copy.title}</h2>
          {placement !== 'board' ? (
            <PixelButton
              aria-pressed={collapsed}
              aria-label={collapsed ? d.expand : d.collapse}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? '+' : '-'}
            </PixelButton>
          ) : null}
          <PixelButton onClick={onExit} aria-label={d.exit}>
            {d.exit}
          </PixelButton>
        </div>
        {collapsed ? null : (
          <p style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, lineHeight: 1.5, margin: '8px 0 0' }}>{body}</p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {canGoBack ? <PixelButton onClick={onBack}>{d.back}</PixelButton> : null}
          {canAdvance ? (
            <PixelButton ref={nextRef} variant="primary" onClick={onNext}>
              {isLast ? d.finish : d.next}
            </PixelButton>
          ) : (
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.accent }}>{d.doAction}</span>
          )}
        </div>
      </div>
    </>
  )
}
