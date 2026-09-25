'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'
import { COLORS, PIXEL_FONT, PixelButton } from '../ui'
import { useModalBehavior } from './use-modal-behavior'
import { LOG_DRAWER_WIDTH } from './layout-math'

export function LogDrawer({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string
  onClose: () => void
  children: ReactNode
}) {
  const t = useT()
  const panelRef = useRef<HTMLElement | null>(null)
  useModalBehavior(panelRef, onClose)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55, backgroundColor: 'rgba(26, 14, 4, 0.5)' }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} aria-hidden />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: LOG_DRAWER_WIDTH,
          maxWidth: '100vw',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: COLORS.bg,
          borderLeft: `2px solid ${COLORS.panelBorder}`,
          color: COLORS.text,
          padding: '8px 10px',
          ...PIXEL_FONT,
          fontSize: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
          <PixelButton onClick={onClose} aria-label={t.catan.layout.closeSheet}>
            {t.catan.close}
          </PixelButton>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </section>
    </div>
  )
}
