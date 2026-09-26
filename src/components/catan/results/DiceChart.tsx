'use client'

import { useT } from '@/lib/i18n/client'
import type { JSX } from 'react'
import { fill } from '../event-text'
import type { DiceSeries } from './results-data'
import { COLORS, Muted, PIXEL_FONT } from '../ui'

const WIDTH = 330
const HEIGHT = 150
const BAR_TOP = 12
const BAR_BOTTOM = 122
const COLUMN = 28
const BAR_WIDTH = 18
const LEFT = 24

const SVG_FONT = "var(--font-pixel), 'Courier New', monospace"

export function DiceChart({ series }: { series: DiceSeries }): JSX.Element {
  const t = useT()
  const d = t.catan.gameOver
  const max = Math.max(1, ...series.bars.map((b) => b.actual), ...series.bars.map((b) => Math.ceil(b.expected)))
  const plot = BAR_BOTTOM - BAR_TOP

  return (
    <div>
      {series.rolls === 0 ? (
        <Muted>{d.diceNoRolls}</Muted>
      ) : (
        <>
          <svg width={WIDTH} height={HEIGHT} shapeRendering="crispEdges" aria-hidden="true">
            {series.bars.map((bar, index) => {
              const x = LEFT + index * COLUMN
              const height = bar.actual > 0 ? Math.max(1, Math.round((bar.actual / max) * plot)) : 0
              const barY = BAR_BOTTOM - height
              const expectedY = BAR_BOTTOM - Math.round((bar.expected / max) * plot)
              return (
                <g key={bar.total}>
                  <rect x={x} y={barY} width={BAR_WIDTH} height={height} fill={COLORS.accent} />
                  <rect
                    x={x + 1}
                    y={expectedY - 1}
                    width={BAR_WIDTH - 2}
                    height={2}
                    fill="none"
                    stroke={COLORS.text}
                    strokeWidth={1}
                  />
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={BAR_BOTTOM + 12}
                    textAnchor="middle"
                    fontFamily={SVG_FONT}
                    fontSize={10}
                    fill={COLORS.muted}
                  >
                    {bar.total}
                  </text>
                  {bar.actual > 0 ? (
                    <text
                      x={x + BAR_WIDTH / 2}
                      y={barY - 3}
                      textAnchor="middle"
                      fontFamily={SVG_FONT}
                      fontSize={10}
                      fill={COLORS.text}
                    >
                      {bar.actual}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </svg>
          <div style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {series.over ? (
              <div>{fill(d.diceOver, { total: series.over.total, actual: series.over.actual, expected: series.over.expected.toFixed(1) })}</div>
            ) : null}
            {series.under ? (
              <div>{fill(d.diceUnder, { total: series.under.total, actual: series.under.actual, expected: series.under.expected.toFixed(1) })}</div>
            ) : null}
          </div>
        </>
      )}
      <table className="sr-only">
        <caption>{d.diceCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{d.diceTotal}</th>
            <th scope="col">{d.diceRolled}</th>
            <th scope="col">{d.diceExpected}</th>
          </tr>
        </thead>
        <tbody>
          {series.bars.map((bar) => (
            <tr key={bar.total}>
              <th scope="row">{bar.total}</th>
              <td>{bar.actual}</td>
              <td>{bar.expected.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
