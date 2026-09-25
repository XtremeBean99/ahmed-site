'use client'

import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import type { GameState } from '@/lib/games/catan/types'
import { PixelSprite } from '../PixelSprite'
import { Tooltip } from '../Tooltip'
import { COLORS, PIXEL_FONT } from '../ui'

export function BankStrip({ state }: { state: GameState }) {
  const t = useT()
  const l = t.catan.layout
  return (
    <div
      data-catan-anchor="bank"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        backgroundColor: COLORS.panel,
        border: `2px solid ${COLORS.panelBorder}`,
        flexWrap: 'wrap',
      }}
    >
      <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>{l.bankTitle}</span>
      {RESOURCES.map((r) => (
        <Tooltip key={r} content={t.catan.resources[r]}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <PixelSprite name={`icon-${r}`} scale={2} alt="" />
            <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
              {state.bank[r]}
            </span>
          </span>
        </Tooltip>
      ))}
      <span style={{ flex: 1 }} />
      <Tooltip content={t.catan.devCards}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          <PixelSprite name="card-back-development" scale={1} alt="" />
          <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
            {state.devDeck.length}
          </span>
        </span>
      </Tooltip>
    </div>
  )
}
