'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import { totalCards } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId, Resource } from '@/lib/games/catan/types'
import { cardStackLayout, eventGainsForPlayer, isOverSeven, type ResourceGain } from './card-layout'
import { PixelSprite } from './PixelSprite'
import { Tooltip } from './Tooltip'
import { COLORS, PIXEL_FONT, Panel, SectionTitle } from './ui'
import type { UiSpriteName } from './ui-sprites'

const CARD_SCALE = 2
const CARD_W = 24 * CARD_SCALE
const CARD_H = 34 * CARD_SCALE

const BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  bottom: -8,
  right: -6,
  ...PIXEL_FONT,
  fontSize: 12,
  color: COLORS.text,
  backgroundColor: COLORS.panelDark,
  border: `2px solid ${COLORS.panelBorder}`,
  padding: '0 4px',
  lineHeight: 1.3,
  zIndex: 2,
  fontVariantNumeric: 'tabular-nums',
}

const FLASH_CSS = `
  @keyframes catan-flash-badge {
    0%, 100% { opacity: 0.45; }
    50% { opacity: 1; }
  }
  .catan-flash-badge { animation: catan-flash-badge 0.6s steps(2, start) infinite; }
  @media (prefers-reduced-motion: reduce) {
    .catan-flash-badge { animation: none; }
  }
`

function ResourceSlot({
  resource,
  count,
  gain,
  tooltip,
}: {
  resource: Resource
  count: number
  gain: number | null
  tooltip: string
}) {
  const layout = cardStackLayout(count, 1)
  return (
    <div data-catan-anchor={`hand-${resource}`} style={{ position: 'relative', width: CARD_W, height: CARD_H, flexShrink: 0 }}>
      <Tooltip content={tooltip}>
        <span style={{ display: 'block', width: '100%', height: '100%', opacity: count === 0 ? 0.35 : 1 }}>
          {layout.shown > 0 ? (
            <PixelSprite name={`card-${resource}` as UiSpriteName} scale={CARD_SCALE} />
          ) : (
            <span
              style={{
                display: 'flex',
                width: '100%',
                height: '100%',
                border: `2px dashed ${COLORS.panelBorder}`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PixelSprite name={`icon-${resource}` as UiSpriteName} scale={2} alt="" />
            </span>
          )}
        </span>
      </Tooltip>
      {count > 0 ? <span className="catan-count-badge" style={BADGE_STYLE}>{count}</span> : null}
      {gain !== null && gain > 0 ? (
        <span
          className="catan-flash-badge"
          style={{ ...BADGE_STYLE, right: undefined, left: -8, backgroundColor: '#7fb85a', color: COLORS.panelDark }}
        >
          +{gain}
        </span>
      ) : null}
    </div>
  )
}

export function HandPanel({
  state,
  human,
  variant = 'panel',
}: {
  state: GameState
  human: PlayerId
  variant?: 'panel' | 'strip'
}) {
  const t = useT()
  const l = t.catan.layout
  const me = state.players[human]
  const total = totalCards(me.resources)
  const over = isOverSeven(total)
  const [flash, setFlash] = useState<{ seq: number; gains: ResourceGain[] } | null>(null)
  const handledSeq = useRef(-1)
  const lastEvent = state.events[state.events.length - 1] ?? null

  useEffect(() => {
    if (!lastEvent || handledSeq.current === lastEvent.seq) return
    handledSeq.current = lastEvent.seq
    const gains = eventGainsForPlayer(lastEvent, human)
    if (gains.length === 0) return
    setFlash({ seq: lastEvent.seq, gains })
    const id = setTimeout(() => setFlash(null), 1500)
    return () => clearTimeout(id)
  }, [lastEvent, human])

  // The panel spreads the five cards across whatever width the column has (270 to 300 px); the strip scrolls.
  const cards = (
    <div
      style={
        variant === 'strip'
          ? { display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden', alignItems: 'flex-start', paddingBottom: 8 }
          : {
              display: 'grid',
              gridTemplateColumns: `repeat(${RESOURCES.length}, ${CARD_W}px)`,
              justifyContent: 'space-between',
              alignItems: 'start',
              paddingBottom: 8,
            }
      }
    >
      {RESOURCES.map((r) => {
        const count = me.resources[r]
        const gain =
          flash && lastEvent && flash.seq === lastEvent.seq
            ? (flash.gains.find((g) => g.resource === r)?.amount ?? null)
            : null
        return (
          <ResourceSlot key={r} resource={r} count={count} gain={gain} tooltip={`${t.catan.resources[r]}: ${t.catan.handBuilds[r]}`} />
        )
      })}
    </div>
  )

  const totals = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ ...PIXEL_FONT, fontSize: 12, color: over ? COLORS.dangerText : COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
        {total} {total === 1 ? t.catan.card : t.catan.cards}
      </span>
      {over ? (
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.dangerText }}>{l.handWarning}</span>
      ) : null}
    </div>
  )

  if (variant === 'strip') {
    return (
      <div
        data-tutorial="hand"
        data-catan-anchor="hand"
        style={{
          height: 84,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 8px',
          backgroundColor: COLORS.bg,
          borderTop: `2px solid ${COLORS.panelBorder}`,
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        <style>{FLASH_CSS}</style>
        {cards}
        {totals}
      </div>
    )
  }

  return (
    <Panel data-tutorial="hand" data-catan-anchor="hand" style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <style>{FLASH_CSS}</style>
      <SectionTitle>{t.catan.hand}</SectionTitle>
      <div style={{ marginTop: 8 }}>{cards}</div>
      {totals}
    </Panel>
  )
}
