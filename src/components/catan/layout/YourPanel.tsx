'use client'

import { useT } from '@/lib/i18n/client'
import { victoryPoints } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import { fill } from '../event-text'
import { PixelSprite } from '../PixelSprite'
import { PLAYER_HEX, PLAYER_TEXT } from '../player-colors'
import { Tooltip } from '../Tooltip'
import { COLORS, PIXEL_FONT, Panel } from '../ui'

function PieceCount({ sprite, label, count }: { sprite: 'road' | 'settlement' | 'city'; label: string; count: number }) {
  const icon = sprite === 'road' ? ('icon-road' as const) : sprite
  return (
    <Tooltip content={label}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        {sprite === 'road' ? (
          <PixelSprite name={icon} scale={2} alt="" />
        ) : (
          <PixelSprite name={sprite} scale={2} color="red" alt="" />
        )}
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </span>
    </Tooltip>
  )
}

export function YourPanel({ state, human }: { state: GameState; human: PlayerId }) {
  const t = useT()
  const l = t.catan.layout
  const me = state.players[human]
  const vp = victoryPoints(state, human, true)
  const hidden = [...me.devCards, ...me.newDevCards].filter((c) => c === 'victoryPoint').length

  return (
    <Panel data-catan-anchor={`player-${human}`} style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            backgroundColor: PLAYER_HEX[me.color],
            border: `2px solid ${COLORS.panelDark}`,
            display: 'inline-block',
          }}
        />
        <span style={{ ...PIXEL_FONT, fontSize: 12, color: PLAYER_TEXT[me.color], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {me.name}
        </span>
        <span style={{ flex: 1 }} />
        <Tooltip content={t.catan.playersTable.vp}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <PixelSprite name="icon-vp" scale={2} alt="" />
            <span style={{ ...PIXEL_FONT, fontSize: 24, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>{vp}</span>
          </span>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
        {hidden > 0 ? (
          <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>{fill(l.hiddenVp, { n: hidden })}</span>
        ) : null}
        {state.longestRoadHolder === human ? (
          <Tooltip content={t.catan.longestRoad}>
            <PixelSprite name="card-longest-road" scale={1} alt={t.catan.longestRoad} />
          </Tooltip>
        ) : null}
        {state.largestArmyHolder === human ? (
          <Tooltip content={t.catan.largestArmy}>
            <PixelSprite name="card-largest-army" scale={1} alt={t.catan.largestArmy} />
          </Tooltip>
        ) : null}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
        <PieceCount sprite="road" label={t.catan.playersTable.road} count={me.roadsLeft} />
        <PieceCount sprite="settlement" label={t.catan.layout.piecesSettlement} count={me.settlementsLeft} />
        <PieceCount sprite="city" label={t.catan.layout.piecesCity} count={me.citiesLeft} />
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>{l.piecesLeftTitle}</span>
      </div>
    </Panel>
  )
}
