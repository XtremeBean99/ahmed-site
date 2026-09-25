// src/components/room/pixel-ui.tsx
'use client'

/**
 * The room's pixel UI atoms: the font, the palette and the bevelled button.
 * They live here, not in DeskArcade, so ScreenStrip can use them without an
 * import cycle (DeskArcade imports ScreenStrip). DeskArcade re-exports them.
 */
import type { ReactNode } from 'react'

export const PIXEL_FONT = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

/** Room-palette retro: warm chrome, muted felt, a warm CRT. */
export const ARCADE = {
  ink: '#3a3028',
  inkSoft: '#8a7a68',
  paper: '#faf8f5',
  strip: '#e8e0d8',
  stripBorder: '#c8b8a8',
  panel: '#3d2e1e',
  panelDark: '#2d2116',
  panelBorder: '#5a4430',
  panelText: '#e8d5b0',
  panelShadow: '#1a0e04',
  felt: '#35553a',
  feltDark: '#27402c',
  feltLight: '#4a6e4e',
  feltLine: '#6f9270',
  feltText: '#cfe0c0',
  crt: '#140e0a',
  phosphor: '#f0dcb4',
  phosphorGlow: 'rgba(240,196,130,0.55)',
  phosphorDim: '#6a5a48',
  rust: '#b3372c',
  amber: '#e8a83a',
  gold: '#d8a038',
  olive: '#7a9a4a',
  teal: '#4a8a86',
  slate: '#5a6a9a',
  plum: '#8a3a5a',
} as const

type ButtonTone = 'cream' | 'dark'
type ButtonSize = 'sm' | 'md' | 'lg'
const SIZES: Record<ButtonSize, { font: number; padX: number; h: number; notch: number; border: number }> = {
  sm: { font: 9, padX: 6, h: 18, notch: 3, border: 2 },
  md: { font: 10, padX: 9, h: 22, notch: 4, border: 2 },
  lg: { font: 12, padX: 12, h: 28, notch: 5, border: 3 },
}

/**
 * Pixel button in the room's style: cream bevel or the dark bubble. The focus
 * ring is drawn inside the button because the notched clip-path would cut an
 * outer one away.
 */
export function ArcadeButton({
  onClick,
  type,
  children,
  tone = 'cream',
  size = 'md',
  disabled,
  pressed,
  ariaLabel,
  title,
  className,
}: {
  onClick?: (e: React.MouseEvent) => void
  type?: 'button' | 'submit'
  children: ReactNode
  tone?: ButtonTone
  size?: ButtonSize
  disabled?: boolean
  pressed?: boolean
  ariaLabel?: string
  title?: string
  className?: string
}) {
  const s = SIZES[size]
  const n = s.notch
  const cream = tone === 'cream'
  return (
    <button
      type={type ?? 'button'}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      title={title}
      className={`relative inline-flex items-center justify-center whitespace-nowrap outline-none transition-[filter,transform] duration-75 enabled:hover:brightness-110 enabled:active:translate-y-px disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-4px] ${cream ? 'focus-visible:outline-[#3a2820]' : 'focus-visible:outline-[#e8d5b0]'} ${className ?? ''}`}
      style={{
        ...PIXEL_FONT,
        height: s.h,
        padding: `0 ${s.padX}px`,
        fontSize: s.font,
        lineHeight: 1,
        color: cream ? '#3a2820' : ARCADE.panelText,
        textShadow: cream ? '1px 1px 0 rgba(255,255,255,0.45)' : `1px 1px 0 ${ARCADE.panelShadow}`,
        background: cream
          ? pressed
            ? 'linear-gradient(180deg, #d8c098 0%, #e8d4b0 100%)'
            : 'linear-gradient(180deg, #fffaf0 0%, #f0e0c0 45%, #d8c098 100%)'
          : pressed
            ? ARCADE.panelDark
            : `linear-gradient(180deg, #4a3826 0%, ${ARCADE.panel} 100%)`,
        border: `${s.border}px solid ${cream ? '#3a2820' : ARCADE.panelBorder}`,
        clipPath: `polygon(${n}px 0, calc(100% - ${n}px) 0, 100% ${n}px, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, ${n}px 100%, 0 calc(100% - ${n}px), 0 ${n}px)`,
        boxShadow: cream
          ? 'inset 1px 1px 0 rgba(255,255,255,0.7), inset -2px -2px 0 rgba(0,0,0,0.22)'
          : 'inset 1px 1px 0 rgba(255,230,190,0.12), inset -2px -2px 0 rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </button>
  )
}
