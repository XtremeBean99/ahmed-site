'use client'

import { useRef } from 'react'
import { useT } from '@/lib/i18n/client'
import { BoardLegend } from './BoardLegend'
import { useModalBehavior } from './layout/use-modal-behavior'
import { COLORS, PixelButton } from './ui'

/** Popover with the board legend, anchored under the Key button in the top bar. */
export function BoardKeyPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const panelRef = useRef<HTMLDivElement | null>(null)
  useModalBehavior(panelRef, open ? onClose : undefined, open)

  if (!open) return null
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t.catan.keyPanel.title}
      tabIndex={-1}
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        zIndex: 40,
        width: 280,
        maxWidth: 'calc(100vw - 16px)',
        backgroundColor: COLORS.panel,
        border: `2px solid ${COLORS.panelBorder}`,
        boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
        color: COLORS.text,
        padding: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: 12, color: COLORS.text }}>
          {t.catan.keyPanel.title}
        </span>
        <PixelButton onClick={onClose}>{t.catan.close}</PixelButton>
      </div>
      <BoardLegend labels={t.catan.key} />
    </div>
  )
}
