'use client'

import type { JSX } from 'react'
import type { PlayerColor, Terrain } from '@/lib/games/catan/types'
import { PixelSprite } from './PixelSprite'
import type { AnySpriteName } from './PixelSprite'
import { TILE_SPRITES } from './sprites'
import { COLORS, PIXEL_FONT } from './ui'

export interface LegendLabels {
  robber: string
  settlement: string
  city: string
  road: string
  numberToken: string
  harbours: string
  terrain: Record<Terrain, string>
}

interface LegendRow {
  key: string
  sprite: AnySpriteName
  scale: number
  color?: PlayerColor
  label: string
}

const TERRAIN_ORDER: Terrain[] = ['brick', 'lumber', 'wool', 'grain', 'ore', 'desert']

/**
 * Presentational legend for the board pieces. Rows are sprite + short text,
 * sized to sit inside the 340 px sidebar panel. The card agent supplies the
 * strings from en.ts; this component never renders copy of its own.
 */
export function BoardLegend({ labels }: { labels: LegendLabels }): JSX.Element {
  const rows: LegendRow[] = [
    { key: 'robber', sprite: 'robber', scale: 2, label: labels.robber },
    { key: 'settlement', sprite: 'settlement', scale: 2, color: 'red', label: labels.settlement },
    { key: 'city', sprite: 'city', scale: 2, color: 'red', label: labels.city },
    { key: 'road', sprite: 'road-rising', scale: 2, color: 'red', label: labels.road },
    { key: 'numberToken', sprite: 'token-8', scale: 2, label: labels.numberToken },
    { key: 'harbours', sprite: 'harbor-any', scale: 2, label: labels.harbours },
    ...TERRAIN_ORDER.map((terrain) => ({
      key: `terrain-${terrain}`,
      sprite: TILE_SPRITES[terrain],
      scale: 1,
      label: labels.terrain[terrain],
    })),
  ]

  return (
    <div
      style={{
        ...PIXEL_FONT,
        color: COLORS.text,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 10,
        lineHeight: 1.35,
      }}
    >
      {rows.map((row) => (
        <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <PixelSprite name={row.sprite} scale={row.scale} color={row.color} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0 }}>{row.label}</span>
        </div>
      ))}
    </div>
  )
}
