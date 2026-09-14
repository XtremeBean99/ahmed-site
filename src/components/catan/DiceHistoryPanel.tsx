'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/client'
import type { GameState } from '@/lib/games/catan/types'
import { diceStats } from './dice-stats'
import { fill } from './event-text'
import { COLORS, Muted, PIXEL_FONT, PixelButton } from './ui'

const TOTALS = Array.from({ length: 11 }, (_, i) => i + 2)
const PANEL_ID = 'catan-dice-panel'

export function DiceHistoryPanel({ state }: { state: GameState }) {
  const t = useT()
  const d = t.catan.dicePanel
  const [open, setOpen] = useState(false)
  const stats = diceStats(state.events)
  const max = Math.max(1, ...stats.counts.slice(2), ...stats.expected.slice(2).map((n) => Math.ceil(n)))

  return (
    <div style={{ borderTop: `2px solid ${COLORS.panelBorder}`, marginTop: 6, paddingTop: 6 }}>
      <PixelButton
        aria-expanded={open}
        aria-controls={PANEL_ID}
        onClick={() => setOpen((prev) => !prev)}
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        <span>{d.title}</span>
        <span aria-hidden>{open ? '-' : '+'}</span>
      </PixelButton>
      {open ? (
        <div id={PANEL_ID} style={{ marginTop: 6 }}>
          <Muted>{fill(d.lastRolls, { n: stats.rolls })}</Muted>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
            {TOTALS.map((total) => {
              const actual = stats.counts[total]
              const expected = stats.expected[total]
              const actualWidth = actual > 0 ? Math.max(1, Math.round((actual / max) * 90)) : 0
              const expectedWidth = expected > 0 ? Math.max(1, Math.round((expected / max) * 90)) : 0
              return (
                <div key={total} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, width: 16, textAlign: 'right' }}>
                    {total}
                  </span>
                  <svg width={96} height={10} shapeRendering="crispEdges" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <rect x={0} y={1} width={actualWidth} height={3} fill={COLORS.accent} />
                    <rect x={0} y={6} width={expectedWidth} height={3} fill={COLORS.muted} />
                  </svg>
                  <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, width: 20, textAlign: 'right' }}>
                    {actual}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <span style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.accent }}>{d.rolled}</span>
            <span style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.muted }}>{d.expected}</span>
          </div>
          <table className="sr-only">
            <caption>{d.title}</caption>
            <thead>
              <tr>
                <th scope="col">{d.total}</th>
                <th scope="col">{d.rolled}</th>
                <th scope="col">{d.expected}</th>
              </tr>
            </thead>
            <tbody>
              {TOTALS.map((total) => (
                <tr key={total}>
                  <th scope="row">{total}</th>
                  <td>{stats.counts[total]}</td>
                  <td>{stats.expected[total].toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
