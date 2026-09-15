'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { Tooltip } from './Tooltip'
import { FOCUS_CLASS, ModalDialog, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

export function NewGameDialog({
  onStart,
  onCancel,
  canCancel,
  onTutorial,
}: {
  onStart: (count: 3 | 4, name: string) => void
  onCancel: () => void
  canCancel: boolean
  onTutorial?: () => void
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
                <Tooltip key={n} content={n === 3 ? d.three : d.four}>
                  <PixelButton
                    selected={count === n}
                    onClick={() => setCount(n)}
                    aria-pressed={count === n}
                    style={{ flex: 1 }}
                  >
                    {n === 3 ? d.three : d.four}
                  </PixelButton>
                </Tooltip>
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
            {onTutorial ? (
              <Tooltip content={d.learn}>
                <PixelButton onClick={onTutorial}>{d.learn}</PixelButton>
              </Tooltip>
            ) : null}
            {canCancel ? (
              <Tooltip content={d.cancel}>
                <PixelButton onClick={onCancel}>{d.cancel}</PixelButton>
              </Tooltip>
            ) : null}
            <Tooltip content={d.start}>
              <PixelButton variant="primary" disabled={!valid} onClick={() => onStart(count, trimmed || 'You')}>
                {d.start}
              </PixelButton>
            </Tooltip>
          </div>
        </div>
    </ModalDialog>
  )
}
