'use client'

import { useT } from '@/lib/i18n/client'
import { COLORS, PIXEL_FONT, PixelButton } from '../ui'
import { STACK_ACTION_BAR_HEIGHT } from './layout-math'

export function StackActionBar({
  primaryLabel,
  primaryAction,
  canPrimary,
  primaryTutorialId,
  onBuild,
  canTrade,
  onTrade,
  onCards,
  onLog,
}: {
  /** Button label when the primary slot is a real action, or the status text when it is not. */
  primaryLabel: string
  primaryAction: (() => void) | null
  canPrimary: boolean
  primaryTutorialId: string | null
  onBuild: () => void
  canTrade: boolean
  onTrade: () => void
  onCards: () => void
  onLog: () => void
}) {
  const t = useT()
  const l = t.catan.layout

  return (
    <div
      style={{
        height: `calc(${STACK_ACTION_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
        display: 'flex',
        gap: 6,
        padding: '6px 8px max(6px, env(safe-area-inset-bottom))',
        backgroundColor: COLORS.panel,
        borderTop: `2px solid ${COLORS.panelBorder}`,
        flexShrink: 0,
      }}
    >
      <PixelButton onClick={onBuild} aria-label={l.sheetTitles.build} style={{ flex: 1, minWidth: 0, height: 44 }}>
        {l.sheetTitles.build}
      </PixelButton>
      <PixelButton
        data-tutorial="trade"
        disabled={!canTrade}
        onClick={onTrade}
        aria-label={t.catan.actionBar.trade}
        style={{ flex: 1, minWidth: 0, height: 44 }}
      >
        {t.catan.actionBar.trade}
      </PixelButton>
      <PixelButton data-tutorial="play-card" onClick={onCards} aria-label={l.sheetTitles.cards} style={{ flex: 1, minWidth: 0, height: 44 }}>
        {l.sheetTitles.cards}
      </PixelButton>
      <PixelButton data-tutorial="log" onClick={onLog} aria-label={l.sheetTitles.log} style={{ flex: 1, minWidth: 0, height: 44 }}>
        {l.sheetTitles.log}
      </PixelButton>
      {primaryAction ? (
        <PixelButton
          data-tutorial={primaryTutorialId ?? undefined}
          variant="primary"
          disabled={!canPrimary}
          onClick={primaryAction}
          style={{ flex: 1.4, minWidth: 0, height: 44 }}
        >
          {primaryLabel}
        </PixelButton>
      ) : (
        // The top bar already announces this status; repeating it here is visual only.
        <span
          aria-hidden
          style={{
            ...PIXEL_FONT,
            fontSize: 10,
            color: COLORS.text,
            flex: 1.4,
            minWidth: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            lineHeight: 1.2,
            padding: '0 4px',
          }}
        >
          {primaryLabel}
        </span>
      )}
    </div>
  )
}
