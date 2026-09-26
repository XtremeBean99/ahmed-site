'use client'

import { PixelSprite } from './PixelSprite'
import { DIE_SIZE, type UiSpriteName } from './ui-sprites'

/** Two die-N sprites at an integer scale, or two placeholder squares when no roll yet. */
export function Dice({ dice, label, scale = 1 }: { dice: [number, number] | null; label: string; scale?: number }) {
  const size = DIE_SIZE * scale
  return (
    <span
      role="img"
      aria-label={dice ? `${label}: ${dice[0]}, ${dice[1]}` : label}
      style={{ display: 'inline-flex', gap: 4 * scale, alignItems: 'center' }}
    >
      {dice ? (
        <>
          <PixelSprite name={`die-${dice[0]}` as UiSpriteName} scale={scale} />
          <PixelSprite name={`die-${dice[1]}` as UiSpriteName} scale={scale} />
        </>
      ) : (
        <>
          <span
            aria-hidden
            style={{
              width: size,
              height: size,
              border: '2px dashed #5a4430',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a09080',
              fontFamily: 'var(--font-pixel), "Courier New", monospace',
              fontSize: 10,
            }}
          >
            ?
          </span>
          <span
            aria-hidden
            style={{
              width: size,
              height: size,
              border: '2px dashed #5a4430',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a09080',
              fontFamily: 'var(--font-pixel), "Courier New", monospace',
              fontSize: 10,
            }}
          >
            ?
          </span>
        </>
      )}
    </span>
  )
}
