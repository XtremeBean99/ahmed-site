'use client'

import type { Resource } from '@/lib/games/catan/types'
import { ResourceIcon } from './ResourceIcon'
import { COLORS, FONT, PIXEL_FONT, PixelButton } from './ui'

export function ResourceStepper({
  resource,
  label,
  value,
  min = 0,
  max,
  onChange,
  disabled = false,
}: {
  resource: Resource
  label: string
  value: number
  min?: number
  max: number
  onChange: (next: number) => void
  disabled?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <ResourceIcon resource={resource} size={16} />
      <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text, width: 56 }}>{label}</span>
      <PixelButton
        aria-label={`Decrease ${label}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        style={{ padding: '2px 6px' }}
      >
        -
      </PixelButton>
      <span style={{ ...PIXEL_FONT, fontSize: FONT.body, color: COLORS.text, width: 20, textAlign: 'center' }}>
        {value}
      </span>
      <PixelButton
        aria-label={`Increase ${label}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
        style={{ padding: '2px 6px' }}
      >
        +
      </PixelButton>
    </div>
  )
}
