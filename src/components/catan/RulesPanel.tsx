'use client'

import { useId } from 'react'
import { useT } from '@/lib/i18n/client'
import { ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

export function RulesPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const d = t.catan.rulesPanel
  const titleId = useId()

  const section = (title: string, body: string) => (
    <div key={title} style={{ marginBottom: 10 }}>
      <div style={{ ...PIXEL_FONT, fontSize: 12, color: '#e0a040', marginBottom: 4 }}>{title}</div>
      <p style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0', margin: 0, lineHeight: 1.5 }}>{body}</p>
    </div>
  )

  return (
    <ModalDialog labelledBy={titleId} onClose={onClose} style={{ width: 520 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionTitle id={titleId}>{d.title}</SectionTitle>
        <PixelButton onClick={onClose}>{t.catan.close}</PixelButton>
      </div>
        <p style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0', margin: '0 0 10px' }}>{d.goal}</p>
        {section(d.costsTitle, d.costs.join('  '))}
        {section(d.robberTitle, d.robberBody)}
        {section(d.devCardsTitle, d.devCards.join('  '))}
        {section(d.armyRoadTitle, d.armyRoadBody)}
        {section(d.harbourTitle, d.harbourBody)}
        {section(d.winTitle, d.winBody)}
        <Muted>{t.catan.title}</Muted>
    </ModalDialog>
  )
}
