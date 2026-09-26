'use client'

import { useT } from '@/lib/i18n/client'
import type { JSX } from 'react'
import { RESOURCES } from '@/lib/games/catan/constants'
import type { Player } from '@/lib/games/catan/types'
import { fill } from '../event-text'
import { PLAYER_HEX, PLAYER_TEXT } from '../player-colors'
import { RESOURCE_COLORS, ResourceIcon } from '../ResourceIcon'
import type { ProductionBars } from './results-data'
import { COLORS, Muted, PIXEL_FONT } from '../ui'

const BAR_WIDTH = 240
const BAR_HEIGHT = 12

export function ProductionChart({ bars, players }: { bars: ProductionBars; players: readonly Player[] }): JSX.Element {
  const t = useT()
  const d = t.catan.gameOver

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {RESOURCES.map((resource) => (
          <span
            key={resource}
            style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          >
            <ResourceIcon resource={resource} size={16} label={t.catan.resources[resource]} />
            {t.catan.resources[resource]}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bars.players.map((bar) => {
          const player = players[bar.player]
          const widths = RESOURCES.map((resource) =>
            Math.min(BAR_WIDTH, Math.max(0, Math.round((bar.produced[resource] / bars.maxTotal) * BAR_WIDTH))),
          )
          let used = 0
          return (
            <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              <span
                style={{
                  ...PIXEL_FONT,
                  fontSize: 10,
                  color: PLAYER_TEXT[player.color],
                  width: 64,
                  flexShrink: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {player.name}
              </span>
              <svg width={BAR_WIDTH} height={BAR_HEIGHT} shapeRendering="crispEdges" aria-hidden="true" style={{ flexShrink: 0 }}>
                <rect x={0} y={0} width={BAR_WIDTH} height={BAR_HEIGHT} fill={COLORS.panelDark} />
                {RESOURCES.map((resource, index) => {
                  const width = Math.min(widths[index], BAR_WIDTH - used)
                  const segment = <rect key={resource} x={used} y={0} width={width} height={BAR_HEIGHT} fill={RESOURCE_COLORS[resource].base} />
                  used += width
                  return segment
                })}
              </svg>
              <Muted style={{ flexShrink: 0 }}>{fill(d.blockedByRobber, { n: bar.blocked })}</Muted>
            </div>
          )
        })}
      </div>
      <table className="sr-only">
        <caption>{d.producedCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{d.colPlayer}</th>
            {RESOURCES.map((resource) => (
              <th key={resource} scope="col">
                {t.catan.resources[resource]}
              </th>
            ))}
            <th scope="col">{d.blockedCol}</th>
          </tr>
        </thead>
        <tbody>
          {bars.players.map((bar) => (
            <tr key={bar.player}>
              <th scope="row">{players[bar.player].name}</th>
              {RESOURCES.map((resource) => (
                <td key={resource}>{bar.produced[resource]}</td>
              ))}
              <td>{bar.blocked}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
