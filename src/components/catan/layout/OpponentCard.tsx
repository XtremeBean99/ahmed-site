'use client'

import { useT } from '@/lib/i18n/client'
import { totalCards, victoryPoints } from '@/lib/games/catan/helpers'
import type { GameState, Player } from '@/lib/games/catan/types'
import { isOverSeven } from '../card-layout'
import { PixelSprite } from '../PixelSprite'
import { PLAYER_HEX, PLAYER_TEXT } from '../player-colors'
import { Tooltip } from '../Tooltip'
import { COLORS, PIXEL_FONT } from '../ui'

const THINKING_CSS = `
  @keyframes catan-thinking-dot {
    0%, 100% { opacity: 0.25; }
    50% { opacity: 1; }
  }
  .catan-thinking-dot { animation: catan-thinking-dot 0.9s steps(2, start) infinite; }
  @media (prefers-reduced-motion: reduce) {
    .catan-thinking-dot { animation: none; opacity: 0.6; }
  }
`

function LevelBadge({ level }: { level: Player['level'] }) {
  const t = useT()
  const label = t.catan.layout.levels[level]
  return (
    <span
      style={{
        ...PIXEL_FONT,
        fontSize: 10,
        color: COLORS.muted,
        border: `1px solid ${COLORS.panelBorder}`,
        padding: '1px 4px',
        lineHeight: 1.2,
      }}
    >
      {label}
    </span>
  )
}

function StatChip({ icon, label, value, danger = false }: { icon: 'cards' | 'dev' | 'knight' | 'road'; label: string; value: number; danger?: boolean }) {
  return (
    <Tooltip content={label}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
        <PixelSprite name={`icon-${icon}`} scale={2} alt="" />
        <span
          style={{
            ...PIXEL_FONT,
            fontSize: 10,
            color: danger ? COLORS.dangerText : COLORS.text,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span className="sr-only">{label} </span>
          {value}
        </span>
      </span>
    </Tooltip>
  )
}

function ThinkingDots() {
  return (
    <span aria-label="thinking" role="status" style={{ display: 'inline-flex', gap: 2, marginLeft: 4 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="catan-thinking-dot"
          style={{
            width: 4,
            height: 4,
            backgroundColor: COLORS.accent,
            display: 'inline-block',
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </span>
  )
}

export function OpponentCard({
  state,
  player,
  isActing,
  isThinking,
  tradeReply,
}: {
  state: GameState
  player: Player
  isActing: boolean
  isThinking: boolean
  tradeReply: string | null
}) {
  const t = useT()
  const d = t.catan.playersTable
  const hand = totalCards(player.resources)
  const vp = victoryPoints(state, player.id, false)
  const devTotal = player.devCards.length + player.newDevCards.length

  return (
    <div
      data-catan-anchor={`player-${player.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 8,
        backgroundColor: COLORS.panel,
        border: `2px solid ${isActing ? COLORS.accent : COLORS.panelBorder}`,
        boxShadow: isActing ? `0 0 0 1px rgba(224,160,64,0.6)` : undefined,
      }}
    >
      <style>{THINKING_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          aria-hidden
          style={{
            width: 14,
            height: 14,
            backgroundColor: PLAYER_HEX[player.color],
            border: `2px solid ${COLORS.panelDark}`,
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            ...PIXEL_FONT,
            fontSize: 12,
            color: PLAYER_TEXT[player.color],
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {player.name}
        </span>
        {player.isBot ? <LevelBadge level={player.level} /> : null}
        <span style={{ flex: 1 }} />
        <Tooltip content={d.vp}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <PixelSprite name="icon-vp" scale={2} alt="" />
            <span style={{ ...PIXEL_FONT, fontSize: 16, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
              <span className="sr-only">{d.vp} </span>
              {vp}
            </span>
          </span>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <StatChip icon="cards" label={d.resources} value={hand} danger={isOverSeven(hand)} />
        <StatChip icon="dev" label={d.dev} value={devTotal} />
        <StatChip icon="knight" label={d.knights} value={player.knightsPlayed} />
        <StatChip icon="road" label={d.road} value={player.longestRoad} />
      </div>
      {(state.longestRoadHolder === player.id || state.largestArmyHolder === player.id || isThinking || tradeReply !== null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 16 }}>
          {state.longestRoadHolder === player.id ? (
            <Tooltip content={d.longestRoad}>
              <PixelSprite name="card-longest-road" scale={1} alt={t.catan.longestRoad} />
            </Tooltip>
          ) : null}
          {state.largestArmyHolder === player.id ? (
            <Tooltip content={d.largestArmy}>
              <PixelSprite name="card-largest-army" scale={1} alt={t.catan.largestArmy} />
            </Tooltip>
          ) : null}
          {isThinking ? <ThinkingDots /> : null}
          {tradeReply !== null ? (
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>{tradeReply}</span>
          ) : null}
        </div>
      )}
    </div>
  )
}

export function OpponentChip({
  state,
  player,
  isActing,
  minHeight,
  onOpen,
}: {
  state: GameState
  player: Player
  isActing: boolean
  minHeight: number
  onOpen: () => void
}) {
  const t = useT()
  const d = t.catan.playersTable
  const vp = victoryPoints(state, player.id, false)
  const hand = totalCards(player.resources)
  return (
    <button
      type="button"
      data-catan-anchor={`player-${player.id}`}
      onClick={onOpen}
      style={{
        ...PIXEL_FONT,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        minHeight,
        backgroundColor: COLORS.panel,
        border: `2px solid ${isActing ? COLORS.accent : COLORS.panelBorder}`,
        color: COLORS.text,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          backgroundColor: PLAYER_HEX[player.color],
          border: `2px solid ${COLORS.panelDark}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: COLORS.panelDark,
          fontSize: 10,
          flexShrink: 0,
        }}
      >
        {player.name.charAt(0)}
      </span>
      <span style={{ fontSize: 10, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 64 }}>
        {player.name}
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <PixelSprite name="icon-vp" scale={1} alt="" />
        <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
          <span className="sr-only">{d.vp} </span>
          {vp}
        </span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        <PixelSprite name="icon-cards" scale={1} alt="" />
        <span style={{ fontSize: 10, color: isOverSeven(hand) ? COLORS.dangerText : COLORS.text }}>
          <span className="sr-only">{d.resources} </span>
          {hand}
        </span>
      </span>
      <span className="sr-only">{t.catan.layout.openPlayer}</span>
    </button>
  )
}
