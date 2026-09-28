// src/components/room/ScreenStrip.tsx
'use client'

import { Children, createContext, useContext, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'
import { SCREEN_H, SCREEN_W } from '@/lib/room/desk-screen'
import { ARCADE, ArcadeButton, PIXEL_FONT } from './pixel-ui'

/** The desk clock's 12/24-hour switch. DeskView provides it to every strip. */
export const DeskClockContext = createContext<{ is24h: boolean; onToggle: () => void }>({
  is24h: true,
  onToggle: () => {},
})

/** The screen an app renders into, in logical px: the 536x308 monitor glass, or a portrait phone screen. */
export interface DeskScreen {
  w: number
  h: number
  portrait: boolean
}

/** DeskView provides the current screen to every app. */
export const DeskScreenContext = createContext<DeskScreen>({ w: SCREEN_W, h: SCREEN_H, portrait: false })

export function useDeskScreen(): DeskScreen {
  return useContext(DeskScreenContext)
}

/** Portrait strip height, and the height of the toolbar row under it when an app passes controls. */
export const PORTRAIT_STRIP_H = 44

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
 * On a portrait phone the strip is 44px with bigger buttons, and the app's
 * controls move to a second 44px toolbar row underneath.
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
  /** App-specific controls, rendered before the shared ones (in portrait, in the toolbar row). */
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
  const { portrait } = useDeskScreen()
  const shown = time || '--:--'
  const other = clock.is24h ? '12' : '24'
  const fsText = fsLabels ?? t.arcade
  const barStyle = { backgroundColor: ARCADE.strip, borderColor: ARCADE.stripBorder, ...PIXEL_FONT }

  const left = (
    <div className="flex items-center gap-2 min-w-0">
      <StripButton
        onClick={clock.onToggle}
        ariaLabel={t.clockLabel.replace('{time}', shown).replace('{n}', other)}
        title={t.clockTitle.replace('{n}', other)}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{shown}</span>
      </StripButton>
      {title && (
        <span className="truncate" style={{ fontSize: portrait ? 12 : 10, color: ARCADE.ink }}>
          {title}
        </span>
      )}
    </div>
  )
  const nav = (
    <>
      {onDesktop && (
        <StripButton onClick={() => { leaveFullscreen(); onDesktop() }}>{desktopLabel}</StripButton>
      )}
      <StripButton onClick={(e) => { leaveFullscreen(); onBack(e) }} ariaLabel={t.backAria}>
        ← {backLabel}
      </StripButton>
    </>
  )

  if (portrait) {
    const hasTools = Children.toArray(children).length > 0
    return (
      <div className="flex-shrink-0">
        <div className="flex items-center justify-between gap-2 px-[5px] border-b" style={{ ...barStyle, height: PORTRAIT_STRIP_H }}>
          {left}
          <div className="flex items-center gap-1.5 flex-shrink-0">{nav}</div>
        </div>
        {hasTools && (
          <div className="flex items-center gap-1.5 px-[5px] border-b overflow-x-auto" style={{ ...barStyle, height: PORTRAIT_STRIP_H }}>
            {children}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 px-[5px] h-7 border-b flex-shrink-0" style={barStyle}>
      {left}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {children}
        {fs?.supported && (
          <StripButton onClick={fs.toggle}>{fs.active ? fsText.exitFullscreen : fsText.fullscreen}</StripButton>
        )}
        {nav}
      </div>
    </div>
  )
}

/**
 * Every control on a desk strip: the dark pixel box from Pong's difficulty
 * picker. A mouse click hands focus back to the page, so games that read keys
 * from the window never have Space or Enter land on the button as well.
 * Portrait phone screens get the 38px `xl` size.
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
  const { portrait } = useDeskScreen()
  return (
    <ArcadeButton
      tone="dark"
      size={portrait ? 'xl' : 'sm'}
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
