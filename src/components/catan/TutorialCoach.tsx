'use client'

import { useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from 'framer-motion'
import type { TutorialHighlight } from '@/lib/games/catan/tutorial'
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
    z-index: 40;
    outline: 2px solid rgba(245, 184, 61, 0.95);
    animation: catan-spotlight-pulse 1.1s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .catan-spotlight { animation: none; }
  }
`

export function TutorialSpotlight({ ids }: { ids: readonly string[] }) {
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
  }, [idsKey, ids])

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

export interface TutorialCoachProps {
  stepLabel: string
  title: string
  body: string
  highlight: TutorialHighlight
  canGoBack: boolean
  isLast: boolean
  nextLabel: string
  backLabel: string
  exitLabel: string
  finishLabel: string
  onNext: () => void
  onBack: () => void
  onExit: () => void
  /** False on steps that finish when the player makes the highlighted move. */
  canAdvance: boolean
  actionPrompt: string
}

export function TutorialCoach({
  stepLabel,
  title,
  body,
  highlight,
  canGoBack,
  isLast,
  nextLabel,
  backLabel,
  exitLabel,
  finishLabel,
  onNext,
  onBack,
  onExit,
  canAdvance,
  actionPrompt,
}: TutorialCoachProps) {
  const ids = useMemo(() => highlight.ui ?? [], [highlight.ui])

  return (
    <>
      <TutorialSpotlight ids={ids} />
      <div
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          width: 360,
          maxWidth: 'calc(100% - 24px)',
          backgroundColor: COLORS.panel,
          border: `2px solid ${COLORS.panelBorder}`,
          boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
          color: COLORS.text,
          padding: 10,
          pointerEvents: 'auto',
          zIndex: 30,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.accent, letterSpacing: 1 }}>
            {stepLabel}
          </span>
          <h2 style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, margin: 0, flex: 1 }}>{title}</h2>
          <PixelButton onClick={onExit} aria-label={exitLabel}>
            {exitLabel}
          </PixelButton>
        </div>
        <p style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, lineHeight: 1.5, margin: '8px 0 0' }}>{body}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
          {canGoBack ? <PixelButton onClick={onBack}>{backLabel}</PixelButton> : null}
          {canAdvance ? (
            <PixelButton variant="primary" onClick={onNext}>
              {isLast ? finishLabel : nextLabel}
            </PixelButton>
          ) : (
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.accent }}>{actionPrompt}</span>
          )}
        </div>
      </div>
    </>
  )
}
