'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { FOCUS_CLASS, ModalDialog, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

export function NewGameDialog({
  onStart,
  onCancel,
  canCancel,
}: {
  onStart: (count: 3 | 4, name: string) => void
  onCancel: () => void
  canCancel: boolean
}) {
  const t = useT()
  const d = t.catan.newGameDialog
  const titleId = useId()
  const [count, setCount] = useState<3 | 4>(4)
  const [name, setName] = useState('You')

  const trimmed = name.trim().slice(0, 16)
  const valid = trimmed.length > 0

  return (
    <ModalDialog labelledBy={titleId} dismissable={canCancel} onClose={onCancel} style={{ width: 360 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <div>
            <div style={{ ...PIXEL_FONT, fontSize: 10, color: '#a09080', marginBottom: 6 }}>{d.players}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {([3, 4] as const).map((n) => (
                <PixelButton
                  key={n}
                  selected={count === n}
                  onClick={() => setCount(n)}
                  aria-pressed={count === n}
                  style={{ flex: 1 }}
                >
                  {n === 3 ? d.three : d.four}
                </PixelButton>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: '#a09080' }}>{d.name}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              maxLength={16}
              placeholder={d.namePlaceholder}
              className={FOCUS_CLASS}
              style={{
                ...PIXEL_FONT,
                fontSize: 12,
                backgroundColor: '#2a2220',
                border: '2px solid #5a4430',
                color: '#e8d5b0',
                padding: '8px',
                width: '100%',
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link
              href="/"
              className={FOCUS_CLASS}
              style={{
                ...PIXEL_FONT,
                fontSize: 10,
                padding: '6px 8px',
                backgroundColor: '#3d2e1e',
                border: '2px solid #5a4430',
                color: '#e8d5b0',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              {t.catan.back}
            </Link>
            <div style={{ flex: 1 }} />
            {canCancel ? <PixelButton onClick={onCancel}>{d.cancel}</PixelButton> : null}
            <PixelButton variant="primary" disabled={!valid} onClick={() => onStart(count, trimmed || 'You')}>
              {d.start}
            </PixelButton>
          </div>
        </div>
    </ModalDialog>
  )
}
