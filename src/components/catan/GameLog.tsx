'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import type { GameEvent, GameState } from '@/lib/games/catan/types'
import { fill, formatEvent, formatEventText, type EventSegment } from './event-text'
import { PLAYER_TEXT } from './player-colors'
import { PixelSprite } from './PixelSprite'
import { COLORS, PIXEL_FONT, Panel, PixelButton, SectionTitle } from './ui'
import type { UiSpriteName } from './ui-sprites'

const CARD_PURPLE = '#b58adf'

export type LogRow = { kind: 'event'; event: GameEvent } | { kind: 'separator'; turn: number; player: number }

/** Events plus a separator row at each turn boundary (turn 0 setup rows stay together). */
export function logRows(state: GameState): LogRow[] {
  const rows: LogRow[] = []
  let previousTurn: number | null = null
  for (const event of state.events) {
    if (event.turn > 0 && previousTurn !== null && event.turn !== previousTurn) {
      const player = 'player' in event && typeof event.player === 'number' ? event.player : state.current
      rows.push({ kind: 'separator', turn: event.turn, player })
    }
    rows.push({ kind: 'event', event })
    previousTurn = event.turn
  }
  return rows
}

function Segment({ segment, state }: { segment: EventSegment; state: GameState }) {
  switch (segment.kind) {
    case 'player':
      return (
        <span style={{ color: segment.player !== undefined ? PLAYER_TEXT[state.players[segment.player].color] : COLORS.text }}>
          {segment.text}
        </span>
      )
    case 'dice':
      return <span style={{ color: segment.value === 7 ? COLORS.dangerText : COLORS.accent }}>{segment.text}</span>
    case 'resource':
      // The icon carries the resource colour; the tile colours are too dark for text on the panel.
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <PixelSprite name={`icon-${segment.resource}` as UiSpriteName} scale={2} alt="" />
          <span style={{ color: COLORS.text }}>{segment.text}</span>
        </span>
      )
    case 'count':
      return <span style={{ color: COLORS.text }}>{segment.text}</span>
    case 'card':
      return <span style={{ color: CARD_PURPLE }}>{segment.text}</span>
    case 'robber':
      return <span style={{ color: COLORS.dangerText }}>{segment.text}</span>
    case 'vp':
      return <span style={{ color: COLORS.accent }}>{segment.text}</span>
    default:
      return <span>{segment.text}</span>
  }
}

export function GameLog({ state }: { state: GameState }) {
  const t = useT()
  const l = t.catan.layout
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showJump, setShowJump] = useState(false)
  const stickRef = useRef(true)
  const rows = logRows(state)

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    stickRef.current = atBottom
    setShowJump(!atBottom)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [state.events.length])

  const jumpDown = () => {
    const el = scrollRef.current
    if (!el) return
    stickRef.current = true
    setShowJump(false)
    el.scrollTop = el.scrollHeight
  }

  return (
    <Panel
      data-tutorial="log"
      style={{ borderWidth: '2px 0 0 0', padding: 8, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <SectionTitle>{t.catan.eventLog}</SectionTitle>
      <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: 'auto', marginTop: 4, paddingRight: 4, minHeight: 0 }}>
        {rows.map((row, index) => {
          if (row.kind === 'separator') {
            return (
              <div
                key={`turn-${row.turn}-${index}`}
                style={{
                  ...PIXEL_FONT,
                  fontSize: 10,
                  color: COLORS.accent,
                  padding: '4px 0 2px',
                  marginTop: 4,
                  borderTop: `2px solid ${COLORS.panelBorder}`,
                }}
              >
                {fill(l.turnSeparator, { turn: row.turn, player: state.players[row.player]?.name ?? '?' })}
              </div>
            )
          }
          const e = row.event
          return (
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
          )
        })}
      </div>
      {showJump ? (
        <PixelButton
          onClick={jumpDown}
          style={{ position: 'absolute', right: 14, bottom: 10, zIndex: 2, boxShadow: `2px 2px 0 ${COLORS.panelDark}` }}
        >
          {l.newEvents}
        </PixelButton>
      ) : null}
    </Panel>
  )
}
