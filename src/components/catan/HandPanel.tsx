'use client'

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import type { GameState, PlayerId, Resource } from '@/lib/games/catan/types'
import { cardStackLayout, eventGainsForPlayer, type ResourceGain } from './card-layout'
import { PixelSprite } from './PixelSprite'
import { Tooltip } from './Tooltip'
import { COLORS, PIXEL_FONT, Panel, SectionTitle } from './ui'
import type { UiSpriteName } from './ui-sprites'

const CARD_SCALE = 2
const CARD_W = 24 * CARD_SCALE
const CARD_H = 34 * CARD_SCALE
const FAN_STEP = 4
const MAX_FANNED = 4
const STACK_W = CARD_W + FAN_STEP * (MAX_FANNED - 1)
const BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  top: -6,
  right: -8,
  ...PIXEL_FONT,
  fontSize: 10,
  color: COLORS.panelDark,
  backgroundColor: COLORS.accent,
  border: `2px solid ${COLORS.panelDark}`,
  padding: '0 3px',
  lineHeight: 1.3,
  zIndex: 2,
}

function ResourceStack({
  resource,
  count,
  gain,
}: {
  resource: Resource
  count: number
  gain: number | null
}) {
  const layout = cardStackLayout(count, MAX_FANNED)
  return (
    <div style={{ position: 'relative', width: STACK_W, height: CARD_H, flexShrink: 0 }}>
      {count === 0 ? (
        <div
          style={{
            width: CARD_W,
            height: '100%',
            border: `2px dashed ${COLORS.panelBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.55,
          }}
        >
          <PixelSprite name={`icon-${resource}` as UiSpriteName} scale={2} alt="" />
        </div>
      ) : (
        Array.from({ length: layout.shown }, (_, i) => (
          <PixelSprite
            key={i}
            name={`card-${resource}` as UiSpriteName}
            scale={CARD_SCALE}
            style={{ position: 'absolute', left: i * FAN_STEP, top: 0 }}
          />
        ))
      )}
      {layout.extra > 0 ? (
        <span className="catan-count-badge" style={BADGE_STYLE}>
          x{count}
        </span>
      ) : null}
      {gain !== null && gain > 0 ? (
        <span className="catan-flash-badge" style={{ ...BADGE_STYLE, right: undefined, left: -8, backgroundColor: '#7fb85a' }}>
          +{gain}
        </span>
      ) : null}
    </div>
  )
}

export function HandPanel({ state, human }: { state: GameState; human: PlayerId }) {
  const t = useT()
  const me = state.players[human]
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

  return (
    <Panel data-tutorial="hand" style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <style>{`
        @keyframes catan-flash-badge {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
        .catan-flash-badge { animation: catan-flash-badge 0.6s steps(2, start) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .catan-flash-badge { animation: none; }
        }
      `}</style>
      <SectionTitle>{t.catan.hand}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${RESOURCES.length}, ${STACK_W}px)`, justifyContent: 'space-between', marginTop: 10 }}>
        {RESOURCES.map((r) => {
          const count = me.resources[r]
          const gain = flash && lastEvent && flash.seq === lastEvent.seq
            ? (flash.gains.find((g) => g.resource === r)?.amount ?? null)
            : null
          return (
            <div key={r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <Tooltip content={`${t.catan.resources[r]}: ${t.catan.handBuilds[r]}`}>
                <ResourceStack resource={r} count={count} gain={gain} />
              </Tooltip>
              <span style={{ ...PIXEL_FONT, fontSize: 10, color: count > 0 ? COLORS.text : COLORS.muted, width: STACK_W, whiteSpace: 'nowrap' }}>
                {t.catan.resources[r]} {count}
              </span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
