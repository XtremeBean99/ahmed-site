'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { fill } from './event-text'
import { type BotSpeed } from './prefs'
import { SettingsMenu } from './SettingsMenu'
import { Tooltip } from './Tooltip'
import { COLORS, FOCUS_CLASS, PIXEL_FONT, PixelButton } from './ui'

export function TopBar({
  turn,
  canSkip,
  onSkip,
  onRules,
  onNewGame,
  botSpeed,
  tooltips,
  showBoardKey,
  onBotSpeedChange,
  onTooltipsChange,
  onShowBoardKeyChange,
}: {
  turn: number
  canSkip: boolean
  onSkip: () => void
  onRules: () => void
  onNewGame: () => void
  botSpeed: BotSpeed
  tooltips: boolean
  showBoardKey: boolean
  onBotSpeedChange: (speed: BotSpeed) => void
  onTooltipsChange: (enabled: boolean) => void
  onShowBoardKeyChange: (shown: boolean) => void
}) {
  const t = useT()
  const tips = t.catan.tooltips

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        backgroundColor: COLORS.panel,
        borderBottom: `2px solid ${COLORS.panelBorder}`,
      }}
    >
      <h1 style={{ ...PIXEL_FONT, fontSize: 16, color: COLORS.accent, margin: 0, letterSpacing: 2 }}>
        {t.catan.title}
      </h1>
      <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>
        {fill(t.catan.turn, { turn })}
      </span>
      <Tooltip content={canSkip ? tips.skip : tips.skipDisabled}>
        <PixelButton data-tutorial="skip" disabled={!canSkip} onClick={onSkip}>
          {t.catan.skip}
        </PixelButton>
      </Tooltip>
      <div style={{ flex: 1 }} />
      <SettingsMenu
        botSpeed={botSpeed}
        tooltips={tooltips}
        showBoardKey={showBoardKey}
        onBotSpeedChange={onBotSpeedChange}
        onTooltipsChange={onTooltipsChange}
        onShowBoardKeyChange={onShowBoardKeyChange}
      />
      <Tooltip content={tips.rules}>
        <PixelButton onClick={onRules}>{t.catan.rules}</PixelButton>
      </Tooltip>
      <Tooltip content={tips.newGame}>
        <PixelButton onClick={onNewGame}>{t.catan.newGame}</PixelButton>
      </Tooltip>
      <Tooltip content={t.catan.back}>
        <Link
          href="/"
          className={FOCUS_CLASS}
          style={{
            ...PIXEL_FONT,
            fontSize: 10,
            padding: '6px 8px',
            backgroundColor: COLORS.panel,
            border: `2px solid ${COLORS.panelBorder}`,
            color: COLORS.text,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {t.catan.back}
        </Link>
      </Tooltip>
    </header>
  )
}
