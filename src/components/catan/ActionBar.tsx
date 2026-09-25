'use client'

import { useT } from '@/lib/i18n/client'
import { Tooltip } from './Tooltip'
import { COLORS, PIXEL_FONT, Panel, PixelButton } from './ui'

export type BuildMode = 'road' | 'settlement' | 'city' | null

export function ActionBar({
  canTrade,
  canEndTurn,
  canUndo,
  onTrade,
  onEndTurn,
  onUndo,
  hintVisible,
  hintText,
  onHint,
}: {
  canTrade: boolean
  canEndTurn: boolean
  canUndo: boolean
  onTrade: () => void
  onEndTurn: () => void
  onUndo: () => void
  hintVisible: boolean
  hintText: string | null
  onHint?: () => void
}) {
  const t = useT()
  const bar = t.catan.actionBar
  const l = t.catan.layout
  const tips = t.catan.tooltips

  return (
    <Panel style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Tooltip content={canTrade ? tips.trade : `${tips.trade}. ${bar.rollFirst}`}>
            <PixelButton data-tutorial="trade" size="md" disabled={!canTrade} onClick={onTrade} style={{ flex: 1 }}>
              {bar.trade}
            </PixelButton>
          </Tooltip>
          <Tooltip content={canUndo ? l.undo : l.undoDisabled}>
            <PixelButton variant="ghost" disabled={!canUndo} onClick={onUndo} style={{ flex: 1 }}>
              {l.undo}
            </PixelButton>
          </Tooltip>
          {onHint ? (
            <Tooltip content={hintVisible ? bar.hintHide : bar.hint}>
              <PixelButton variant="ghost" aria-pressed={hintVisible} onClick={onHint} style={{ flex: 1 }}>
                {hintVisible ? bar.hintHide : bar.hint}
              </PixelButton>
            </Tooltip>
          ) : null}
        </div>
        <Tooltip content={canEndTurn ? tips.endTurn : `${tips.endTurn}. ${bar.rollFirst}`}>
          <PixelButton
            data-tutorial="end-turn"
            variant="primary"
            size="lg"
            disabled={!canEndTurn}
            onClick={onEndTurn}
            style={{ width: '100%' }}
          >
            {bar.endTurn}
          </PixelButton>
        </Tooltip>
        {hintText ? (
          <div role="status" aria-live="polite" style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.accent, lineHeight: 1.4 }}>
            {hintText}
          </div>
        ) : null}
      </div>
    </Panel>
  )
}
