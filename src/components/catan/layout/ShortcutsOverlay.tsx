'use client'

import { useId } from 'react'
import { useT } from '@/lib/i18n/client'
import { ModalDialog, PIXEL_FONT, PixelButton, SectionTitle } from '../ui'

export function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  const t = useT()
  const s = t.catan.layout.shortcuts
  const titleId = useId()

  return (
    <ModalDialog labelledBy={titleId} onClose={onClose} style={{ width: 380 }}>
      <SectionTitle id={titleId}>{s.title}</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        {s.items.map((item) => (
          <div key={item.keys} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                ...PIXEL_FONT,
                fontSize: 10,
                color: '#1a0e04',
                backgroundColor: '#e0a040',
                border: '2px solid #1a0e04',
                padding: '2px 6px',
                minWidth: 52,
                textAlign: 'center',
                flexShrink: 0,
              }}
            >
              {item.keys}
            </span>
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0' }}>{item.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <PixelButton onClick={onClose}>{t.catan.close}</PixelButton>
      </div>
    </ModalDialog>
  )
}
