// src/components/room/ScreenStrip.tsx
'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'
import { ARCADE, ArcadeButton, PIXEL_FONT } from './pixel-ui'

/** The desk clock's 12/24-hour switch. DeskView provides it to every strip. */
export const DeskClockContext = createContext<{ is24h: boolean; onToggle: () => void }>({
  is24h: true,
  onToggle: () => {},
})

/** The part of useFullscreen() the strip needs. */
interface StripFullscreen {
  active: boolean
  supported: boolean
  toggle: () => void
}

function leaveFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
}

/**
 * The 28px strip across the top of every desk screen, identical everywhere:
 * clock and optional title on the left; then the app's own controls, Full
 * screen (where the app supports it), Desktop (every app) and Room on the right.
 */
export function ScreenStrip({
  time,
  title,
  children,
  fs,
  fsLabels,
  desktopLabel,
  onDesktop,
  backLabel,
  onBack,
}: {
  time: string
  title?: string
  /** App-specific controls, rendered before the shared ones. */
  children?: ReactNode
  fs?: StripFullscreen
  fsLabels?: { fullscreen: string; exitFullscreen: string }
  desktopLabel?: string
  /** Omit on the desktop itself. */
  onDesktop?: () => void
  backLabel: string
  onBack: (e: React.MouseEvent) => void
}) {
  const t = useT().desk
  const clock = useContext(DeskClockContext)
  const shown = time || '--:--'
  const other = clock.is24h ? '12' : '24'
  const fsText = fsLabels ?? t.arcade
  return (
    <div
      className="flex items-center justify-between gap-2 px-[5px] h-7 border-b flex-shrink-0"
      style={{ backgroundColor: ARCADE.strip, borderColor: ARCADE.stripBorder, ...PIXEL_FONT }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StripButton
          onClick={clock.onToggle}
          ariaLabel={t.clockLabel.replace('{time}', shown).replace('{n}', other)}
          title={t.clockTitle.replace('{n}', other)}
        >
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
        </StripButton>
        {title && (
          <span className="truncate" style={{ fontSize: 10, color: ARCADE.ink }}>
            {title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {children}
        {fs?.supported && (
          <StripButton onClick={fs.toggle}>{fs.active ? fsText.exitFullscreen : fsText.fullscreen}</StripButton>
        )}
        {onDesktop && (
          <StripButton onClick={() => { leaveFullscreen(); onDesktop() }}>{desktopLabel}</StripButton>
        )}
        <StripButton onClick={(e) => { leaveFullscreen(); onBack(e) }} ariaLabel={t.backAria}>
          ← {backLabel}
        </StripButton>
      </div>
    </div>
  )
}

/**
 * Every control on a desk strip: the dark pixel box from Pong's difficulty
 * picker. A mouse click hands focus back to the page, so games that read keys
 * from the window never have Space or Enter land on the button as well.
 */
export function StripButton({
  onClick,
  children,
  ariaLabel,
  pressed,
  title,
}: {
  onClick: (e: React.MouseEvent) => void
  children: ReactNode
  ariaLabel?: string
  pressed?: boolean
  title?: string
}) {
  return (
    <ArcadeButton
      tone="dark"
      size="sm"
      pressed={pressed}
      ariaLabel={ariaLabel}
      title={title}
      onClick={(e) => {
        if (e.detail > 0) (e.currentTarget as HTMLElement).blur()
        onClick(e)
      }}
    >
      {children}
    </ArcadeButton>
  )
}
