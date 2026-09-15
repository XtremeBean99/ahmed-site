import type { CSSProperties } from 'react'
import type { Resource, ResourceCounts } from '@/lib/games/catan/types'
import { RESOURCES } from '@/lib/games/catan/constants'
import { PixelSprite } from './PixelSprite'
import { ICON_SIZE, type UiSpriteName } from './ui-sprites'

export const RESOURCE_COLORS: Record<Resource, { base: string; dark: string }> = {
  brick: { base: '#b0583a', dark: '#8a4028' },
  lumber: { base: '#3f6b3a', dark: '#2c4f29' },
  wool: { base: '#8fb85a', dark: '#6f9a42' },
  grain: { base: '#d9b44a', dark: '#b08a2e' },
  ore: { base: '#7c7f8a', dark: '#5a5d68' },
}

const ICONS: Record<Resource, UiSpriteName> = {
  brick: 'icon-brick',
  lumber: 'icon-lumber',
  wool: 'icon-wool',
  grain: 'icon-grain',
  ore: 'icon-ore',
}

/** Rounds a requested pixel size to the nearest integer icon scale (8px units). */
function iconScale(size: number): number {
  return Math.max(1, Math.round(size / ICON_SIZE))
}

export function ResourceIcon({
  resource,
  size = 16,
  label,
  style,
}: {
  resource: Resource
  size?: number
  label?: string
  style?: CSSProperties
}) {
  const scale = iconScale(size)
  return (
    <PixelSprite
      name={ICONS[resource]}
      scale={scale}
      alt={label ?? ''}
      style={{ ...style, width: ICON_SIZE * scale, height: ICON_SIZE * scale }}
    />
  )
}

export function CostIcons({ cost, size = 16 }: { cost: ResourceCounts; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {RESOURCES.filter((r) => cost[r] > 0).map((r) => (
        <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          <ResourceIcon resource={r} size={size} />
          {cost[r] > 1 ? <span style={{ fontSize: 10, color: '#e8d5b0' }}>{cost[r]}</span> : null}
        </span>
      ))}
    </span>
  )
}
