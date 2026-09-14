import type { ReactElement } from 'react'
import type { Resource, ResourceCounts } from '@/lib/games/catan/types'
import { RESOURCES } from '@/lib/games/catan/constants'

const RESOURCE_COLORS: Record<Resource, { base: string; dark: string }> = {
  brick: { base: '#b0583a', dark: '#8a4028' },
  lumber: { base: '#3f6b3a', dark: '#2c4f29' },
  wool: { base: '#8fb85a', dark: '#6f9a42' },
  grain: { base: '#d9b44a', dark: '#b08a2e' },
  ore: { base: '#7c7f8a', dark: '#5a5d68' },
}

/** 8x8 pixel grids; . is empty, letter is the base tone, D is the dark tone. */
const GRIDS: Record<Resource, string[]> = {
  brick: [
    '........',
    '.RR.RR..',
    '.RR.RR..',
    '........',
    '.RR.RR..',
    '.RR.RR..',
    '........',
    '........',
  ],
  lumber: [
    '...LL...',
    '...LL...',
    '..LLLL..',
    '..LLLL..',
    '.LLLLLL.',
    '.LLDLLL.',
    '...DD...',
    '...DD...',
  ],
  wool: [
    '........',
    '..WWWW..',
    '.WWWWWW.',
    '.WWWWWW.',
    '..WWWW..',
    '...DD...',
    '...DD...',
    '........',
  ],
  grain: [
    '...GG...',
    '...GG...',
    '...GG...',
    '...GG...',
    '...GG...',
    '...GG...',
    '...GG...',
    '...DD...',
  ],
  ore: [
    '........',
    '.OOOOOO.',
    'OOOOOOOO',
    'OOODOOOO',
    'OOOOOOOO',
    '.OOOOOO.',
    '........',
    '........',
  ],
}

export function ResourceIcon({
  resource,
  size = 16,
  label,
}: {
  resource: Resource
  size?: number
  label?: string
}) {
  const colors = RESOURCE_COLORS[resource]
  const grid = GRIDS[resource]
  const cell = size / 8
  const rects: ReactElement[] = []
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const c = grid[y][x]
      if (c === '.') continue
      rects.push(
        <rect
          key={`${x}-${y}`}
          x={x * cell}
          y={y * cell}
          width={cell}
          height={cell}
          fill={c === 'D' ? colors.dark : colors.base}
        />,
      )
    }
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      style={{ imageRendering: 'pixelated', display: 'inline-block', flexShrink: 0 }}
    >
      {rects}
    </svg>
  )
}

export function CostIcons({ cost, size = 14 }: { cost: ResourceCounts; size?: number }) {
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
