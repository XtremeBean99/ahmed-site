'use client'

import { useT } from '@/lib/i18n/client'
import type { JSX } from 'react'
import type { Player } from '@/lib/games/catan/types'
import { PLAYER_HEX, PLAYER_TEXT } from '../player-colors'
import type { VpSeries } from './results-data'
import { COLORS, PIXEL_FONT } from '../ui'

const WIDTH = 440
const HEIGHT = 210
const LEFT = 26
const RIGHT = 10
const TOP = 12
const BOTTOM = 26

const SVG_FONT = "var(--font-pixel), 'Courier New', monospace"

export function VpChart({ series, players }: { series: VpSeries; players: readonly Player[] }): JSX.Element {
  const t = useT()
  const d = t.catan.gameOver
  const rowCount = series.rows.length
  const maxVp = Math.max(1, ...series.rows.flat())
  const plotWidth = WIDTH - LEFT - RIGHT
  const plotHeight = HEIGHT - TOP - BOTTOM
  const x = (index: number) => (rowCount <= 1 ? LEFT + Math.floor(plotWidth / 2) : LEFT + Math.round((index * plotWidth) / (rowCount - 1)))
  const y = (vp: number) => TOP + plotHeight - Math.round((vp / maxVp) * plotHeight)

  const ticks: number[] = []
  for (let vp = 0; vp <= maxVp; vp += 2) ticks.push(vp)
  if (!ticks.includes(maxVp)) ticks.push(maxVp)

  const labelStep = Math.max(1, Math.ceil(rowCount / 12))

  return (
    <div>
      <svg width={WIDTH} height={HEIGHT} shapeRendering="crispEdges" aria-hidden="true">
        {ticks.map((vp) => (
          <g key={vp}>
            <line x1={LEFT} y1={y(vp)} x2={WIDTH - RIGHT} y2={y(vp)} stroke={COLORS.panelBorder} strokeWidth={1} />
            <text x={LEFT - 4} y={y(vp) + 3} textAnchor="end" fontFamily={SVG_FONT} fontSize={10} fill={COLORS.muted}>
              {vp}
            </text>
          </g>
        ))}
        {rowCount === 1
          ? players.map((player) => (
              <rect
                key={player.id}
                x={x(0) - 1}
                y={y(series.rows[0][player.id]) - 1}
                width={2}
                height={2}
                fill={PLAYER_HEX[player.color]}
              />
            ))
          : series.rows.slice(1).map((row, index) => {
              const previous = series.rows[index]
              return players.map((player) => {
                const path = `M ${x(index)} ${y(previous[player.id])} H ${x(index + 1)} V ${y(row[player.id])}`
                return <path key={player.id} d={path} stroke={PLAYER_HEX[player.color]} strokeWidth={2} fill="none" />
              })
            })}
        {series.rows.map((_, index) => {
          const turn = index + 1
          if (turn !== rowCount && turn % labelStep !== 0) return null
          return (
            <text key={turn} x={x(index)} y={HEIGHT - 6} textAnchor="middle" fontFamily={SVG_FONT} fontSize={10} fill={COLORS.muted}>
              {turn}
            </text>
          )
        })}
        {series.finalRow !== null ? (
          <text
            x={Math.min(x(series.finalRow), WIDTH - RIGHT - 2)}
            y={TOP - 2}
            textAnchor="end"
            fontFamily={SVG_FONT}
            fontSize={10}
            fill={COLORS.accent}
          >
            {d.final}
          </text>
        ) : null}
      </svg>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
        {players.map((player) => (
          <span key={player.id} style={{ ...PIXEL_FONT, fontSize: 10, color: PLAYER_TEXT[player.color], display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              aria-hidden
              style={{ width: 10, height: 10, backgroundColor: PLAYER_HEX[player.color], border: '1px solid #1a0e04', display: 'inline-block' }}
            />
            {player.name}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{d.vpCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{d.colTurn}</th>
            {players.map((player) => (
              <th key={player.id} scope="col">
                {player.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.rows.map((row, index) => (
            <tr key={index}>
              <th scope="row">
                {index + 1}
                {series.finalRow === index ? ` (${d.final})` : ''}
              </th>
              {players.map((player) => (
                <td key={player.id}>{row[player.id]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
