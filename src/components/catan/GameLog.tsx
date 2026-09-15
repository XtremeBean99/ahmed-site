'use client'

import type { RefObject } from 'react'
import { useT } from '@/lib/i18n/client'
import type { GameEvent, GameState } from '@/lib/games/catan/types'
import { formatEvent, formatEventText, type EventSegment } from './event-text'
import { PLAYER_HEX } from './player-colors'
import { RESOURCE_COLORS } from './ResourceIcon'
import { PixelSprite } from './PixelSprite'
import { COLORS, PIXEL_FONT, Panel, SectionTitle } from './ui'
import type { UiSpriteName } from './ui-sprites'

const CARD_PURPLE = '#b58adf'

function Segment({ segment, state }: { segment: EventSegment; state: GameState }) {
  switch (segment.kind) {
    case 'player':
      return (
        <span style={{ color: segment.player !== undefined ? PLAYER_HEX[state.players[segment.player].color] : COLORS.text }}>
          {segment.text}
        </span>
      )
    case 'dice':
      return (
        <span style={{ color: segment.value === 7 ? COLORS.danger : COLORS.accent, fontWeight: 700 }}>
          {segment.text}
        </span>
      )
    case 'resource':
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <PixelSprite name={`icon-${segment.resource}` as UiSpriteName} scale={2} alt="" />
          <span style={{ color: segment.resource ? RESOURCE_COLORS[segment.resource].base : COLORS.text }}>
            {segment.text}
          </span>
        </span>
      )
    case 'count':
      return <span style={{ fontWeight: 700, color: COLORS.text }}>{segment.text}</span>
    case 'card':
      return <span style={{ color: CARD_PURPLE }}>{segment.text}</span>
    case 'robber':
      return <span style={{ color: COLORS.danger }}>{segment.text}</span>
    case 'vp':
      return <span style={{ color: COLORS.accent }}>{segment.text}</span>
    default:
      return <span>{segment.text}</span>
  }
}

export function GameLog({
  state,
  events,
  scrollRef,
}: {
  state: GameState
  events: readonly GameEvent[]
  scrollRef?: RefObject<HTMLDivElement | null>
}) {
  const t = useT()

  return (
    <Panel
      data-tutorial="log"
      style={{ borderWidth: '2px 0 0 0', padding: 8, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <SectionTitle>{t.catan.eventLog}</SectionTitle>
      <div
        ref={scrollRef}
        aria-live="polite"
        style={{ flex: 1, overflowY: 'auto', marginTop: 4, paddingRight: 4, minHeight: 0 }}
      >
        {events.map((e) => (
          <div
            key={e.seq}
            aria-label={formatEventText(state, e, t)}
            style={{
              ...PIXEL_FONT,
              fontSize: 10,
              color: COLORS.muted,
              padding: '2px 0',
              borderBottom: `1px solid ${COLORS.panelDark}`,
              lineHeight: 1.5,
            }}
          >
            {formatEvent(state, e, t).map((segment, i) => (
              <Segment key={i} segment={segment} state={state} />
            ))}
          </div>
        ))}
      </div>
    </Panel>
  )
}
