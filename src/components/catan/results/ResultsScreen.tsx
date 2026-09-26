'use client'

import { useId, useState } from 'react'
import type { CSSProperties, JSX } from 'react'
import { useT } from '@/lib/i18n/client'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import { fill } from '../event-text'
import { PLAYER_HEX, PLAYER_TEXT } from '../player-colors'
import { COLORS, ModalDialog, Muted, PIXEL_FONT, PixelButton } from '../ui'
import { DiceChart } from './DiceChart'
import { Highlights } from './Highlights'
import { ProductionChart } from './ProductionChart'
import { diceSeries, highlights, productionBars, scoreRows, vpSeries } from './results-data'
import { VpChart } from './VpChart'

type TabId = 'dice' | 'resources' | 'points' | 'highlights'

const TABS: { id: TabId; labelKey: 'tabDice' | 'tabResources' | 'tabPoints' | 'tabHighlights' }[] = [
  { id: 'dice', labelKey: 'tabDice' },
  { id: 'resources', labelKey: 'tabResources' },
  { id: 'points', labelKey: 'tabPoints' },
  { id: 'highlights', labelKey: 'tabHighlights' },
]

export function ResultsScreen(props: {
  game: GameState
  human: PlayerId
  onRematch: () => void
  onNewGame: () => void
  onBackToRoom: () => void
}): JSX.Element {
  const t = useT()
  const d = t.catan.gameOver
  const l = t.catan.layout
  const titleId = useId()
  const [tab, setTab] = useState<TabId>('dice')
  const { game, human } = props
  const winner = game.phase.kind === 'gameOver' ? game.players[game.phase.winner] : null
  const rows = scoreRows(game)
  const dice = diceSeries(game.stats)
  const bars = productionBars(game.stats)
  const vp = vpSeries(game.stats, game.players.length)
  const facts = highlights(game)

  const th: CSSProperties = {
    ...PIXEL_FONT,
    fontSize: 10,
    color: COLORS.muted,
    textAlign: 'left',
    padding: '4px 6px',
    fontWeight: 'normal',
  }
  const td: CSSProperties = { ...PIXEL_FONT, fontSize: 10, color: COLORS.text, padding: '4px 6px' }

  return (
    <ModalDialog labelledBy={titleId} dismissable={false} style={{ width: 760, maxWidth: 'min(94vw, 760px)', height: 560, maxHeight: '94vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', minHeight: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {winner ? (
            <span
              aria-hidden
              style={{
                width: 20,
                height: 20,
                backgroundColor: PLAYER_HEX[winner.color],
                border: '2px solid #1a0e04',
                flexShrink: 0,
              }}
            />
          ) : null}
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} style={{ ...PIXEL_FONT, fontSize: 16, color: COLORS.text, margin: 0, lineHeight: 1.1 }}>
              {winner ? (winner.id === human ? d.winnerYou : fill(d.winner, { player: winner.name })) : d.title}
            </h2>
            <p style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, margin: '4px 0 0' }}>
              {fill(d.turns, { turns: game.turn })}. {fill(d.firstTo, { points: game.settings.vpToWin })}
            </p>
          </div>
        </header>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <caption className="sr-only">{d.scoresCaption}</caption>
          <thead>
            <tr>
              <th scope="col" style={th}>{d.colPlayer}</th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>{d.colSettlements}</th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>{d.colCities}</th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>{d.colVpCards}</th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>{d.colRoad}</th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>{d.colArmy}</th>
              <th scope="col" style={{ ...th, textAlign: 'right' }}>{d.colTotal}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const player = game.players[row.player]
              const isWinner = winner?.id === player.id
              const border = isWinner ? `2px solid ${PLAYER_HEX[player.color]}` : undefined
              const cell = { ...td, borderTop: border, borderBottom: border }
              return (
                <tr key={player.id}>
                  <td style={{ ...cell, width: '34%', ...(isWinner ? { borderLeft: border } : null) }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 12,
                          height: 12,
                          backgroundColor: PLAYER_HEX[player.color],
                          border: '1px solid #1a0e04',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: PLAYER_TEXT[player.color] }}>{player.name}</span>
                    </span>
                  </td>
                  <td style={{ ...cell, textAlign: 'right' }}>{row.settlements}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{row.cities}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{row.vpCards}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{row.road}</td>
                  <td style={{ ...cell, textAlign: 'right' }}>{row.army}</td>
                  <td style={{ ...cell, textAlign: 'right', ...(isWinner ? { borderRight: border } : null) }}>{row.total}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div role="group" aria-label={d.tabsLabel} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((item) => (
            <PixelButton key={item.id} aria-pressed={tab === item.id} selected={tab === item.id} onClick={() => setTab(item.id)}>
              {d[item.labelKey]}
            </PixelButton>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            backgroundColor: COLORS.bg,
            border: `2px solid ${COLORS.panelBorder}`,
            padding: 10,
          }}
        >
          {tab === 'dice' ? <DiceChart series={dice} /> : null}
          {tab === 'resources' ? <ProductionChart bars={bars} players={game.players} /> : null}
          {tab === 'points' ? <VpChart series={vp} players={game.players} /> : null}
          {tab === 'highlights' ? <Highlights items={facts} game={game} /> : null}
          {game.stats.partial ? (
            <Muted style={{ display: 'block', marginTop: 10, borderTop: `1px solid ${COLORS.panelBorder}`, paddingTop: 8 }}>{d.partial}</Muted>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <PixelButton onClick={props.onBackToRoom}>{l.backToRoom}</PixelButton>
          <PixelButton onClick={props.onNewGame}>{t.catan.newGame}</PixelButton>
          <PixelButton variant="primary" size="md" onClick={props.onRematch}>
            {l.rematch}
          </PixelButton>
        </div>
      </div>
    </ModalDialog>
  )
}
