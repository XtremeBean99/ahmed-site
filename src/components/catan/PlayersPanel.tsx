'use client'

import { useT } from '@/lib/i18n/client'
import { totalCards, victoryPoints } from '@/lib/games/catan/helpers'
import type { GameState, Player } from '@/lib/games/catan/types'
import { cardStackLayout, isOverSeven } from './card-layout'
import { PixelSprite } from './PixelSprite'
import { PLAYER_HEX } from './player-colors'
import { Tooltip } from './Tooltip'
import { COLORS, PIXEL_FONT, Panel, SectionTitle } from './ui'

const GRID_TEMPLATE = 'minmax(0, 1fr) 30px 28px 28px 28px 28px'

function HeaderCell({ abbr, children }: { abbr: string; children: string }) {
  return (
    <Tooltip content={abbr}>
      <abbr
        title={abbr}
        aria-label={abbr}
        style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, textAlign: 'center', textDecoration: 'none' }}
      >
        {children}
      </abbr>
    </Tooltip>
  )
}

function CardBackStack({ count, kind }: { count: number; kind: 'resource' | 'development' }) {
  if (count === 0) return null
  const maxVisible = kind === 'resource' ? 7 : 4
  const layout = cardStackLayout(count, maxVisible)
  const name = kind === 'resource' ? ('card-back-resource' as const) : ('card-back-development' as const)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <span style={{ position: 'relative', width: 24 + (layout.shown - 1) * 4, height: 34 }}>
        {Array.from({ length: layout.shown }, (_, i) => (
          <PixelSprite key={i} name={name} scale={1} style={{ position: 'absolute', left: i * 4, top: 0 }} />
        ))}
      </span>
      <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      {layout.extra > 0 ? (
        <span style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.accent }}>+{layout.extra}</span>
      ) : null}
    </span>
  )
}

function StatCell({ value, muted = true }: { value: number; muted?: boolean }) {
  return (
    <span
      style={{
        ...PIXEL_FONT,
        fontSize: 12,
        color: muted ? COLORS.muted : COLORS.text,
        textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {value}
    </span>
  )
}

export function PlayersPanel({ state }: { state: GameState }) {
  const t = useT()
  const d = t.catan.playersTable

  const row = (p: Player) => {
    const isCurrent = state.current === p.id
    const vp = p.isBot ? victoryPoints(state, p.id, false) : victoryPoints(state, p.id, true)
    const hand = totalCards(p.resources)
    const over = isOverSeven(hand)
    const devTotal = p.devCards.length + p.newDevCards.length
    return (
      <Tooltip key={p.id} content={over ? d.overSeven : null}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_TEMPLATE,
            alignItems: 'center',
            gap: 4,
            padding: '3px 6px',
            backgroundColor: isCurrent ? 'rgba(224,160,64,0.14)' : 'transparent',
            border: `2px solid ${isCurrent ? COLORS.accent : 'transparent'}`,
            outline: over ? `2px solid ${COLORS.danger}` : '2px solid transparent',
            outlineOffset: -2,
          }}
        >
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                backgroundColor: PLAYER_HEX[p.color],
                border: `1px solid ${COLORS.panelDark}`,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                ...PIXEL_FONT,
                fontSize: 10,
                color: COLORS.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {p.name}
              {isCurrent ? ' \u25b8' : ''}
            </span>
            {p.isBot ? (
              <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginLeft: 4, minWidth: 0 }}>
                <CardBackStack count={hand} kind="resource" />
                <CardBackStack count={devTotal} kind="development" />
              </span>
            ) : null}
            {state.longestRoadHolder === p.id ? (
              <Tooltip content={d.longestRoad}>
                <PixelSprite name="card-longest-road" scale={1} alt={t.catan.longestRoad} />
              </Tooltip>
            ) : null}
            {state.largestArmyHolder === p.id ? (
              <Tooltip content={d.largestArmy}>
                <PixelSprite name="card-largest-army" scale={1} alt={t.catan.largestArmy} />
              </Tooltip>
            ) : null}
          </span>
          <Tooltip content={d.vp}>
            <span style={{ textAlign: 'center' }}>
              <StatCell value={vp} muted={false} />
            </span>
          </Tooltip>
          <Tooltip content={d.resources}>
            <span style={{ textAlign: 'center' }}>
              <StatCell value={hand} />
            </span>
          </Tooltip>
          <Tooltip content={d.dev}>
            <span style={{ textAlign: 'center' }}>
              <StatCell value={devTotal} />
            </span>
          </Tooltip>
          <Tooltip content={d.knights}>
            <span style={{ textAlign: 'center' }}>
              <StatCell value={p.knightsPlayed} />
            </span>
          </Tooltip>
          <Tooltip content={d.road}>
            <span style={{ textAlign: 'center' }}>
              <StatCell value={p.longestRoad} />
            </span>
          </Tooltip>
        </div>
      </Tooltip>
    )
  }

  return (
    <Panel data-tutorial="players" style={{ borderWidth: 0, padding: 8 }}>
      <SectionTitle>{t.catan.players}</SectionTitle>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_TEMPLATE,
          gap: 4,
          marginTop: 4,
          padding: '0 6px',
        }}
      >
        <span />
        <HeaderCell abbr={d.vp}>VP</HeaderCell>
        <HeaderCell abbr={d.resources}>Res</HeaderCell>
        <HeaderCell abbr={d.dev}>Dev</HeaderCell>
        <HeaderCell abbr={d.knights}>Knt</HeaderCell>
        <HeaderCell abbr={d.road}>Rd</HeaderCell>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
        {state.players.map((p) => row(p))}
      </div>
    </Panel>
  )
}
