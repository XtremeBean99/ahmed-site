'use client'

import { useState } from 'react'
import { ScreenStrip, StripButton } from './ScreenStrip'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export interface LegalLabels {
  title: string
  privacyTab: string
  termsTab: string
  close: string
}

interface Section { h: string; body: string[]; items?: readonly string[]; after?: string }

interface DeskLegalProps {
  privacy: Record<string, unknown>
  terms: Record<string, unknown>
  effectiveDate: string
  labels: LegalLabels
  desktopLabel: string
  onDesktop: () => void
}

function privacySections(p: Record<string, string | string[]>): Section[] {
  return [
    { h: p.s1h as string, body: [p.s1b as string] },
    { h: p.s2h as string, body: [p.s2intro as string], items: p.s2items as string[], after: p.s2after as string },
    { h: p.s3h as string, body: [p.s3intro as string], items: p.s3items as string[], after: p.s3after as string },
    { h: p.s4h as string, body: [p.s4p1 as string, p.s4p2 as string] },
    { h: p.s5h as string, body: [p.s5b as string] },
    { h: p.s6h as string, body: [p.s6p1 as string, p.s6p2 as string, p.s6p3 as string] },
    { h: p.s7h as string, body: [p.s7b as string] },
    { h: p.s8h as string, body: [p.s8b as string] },
  ]
}

function termsSections(t: Record<string, string | string[]>): Section[] {
  return [
    { h: t.s1h as string, body: [t.s1b as string] },
    { h: t.s2h as string, body: [t.s2b1 as string, t.s2b2 as string] },
    { h: t.s3h as string, body: [t.s3intro as string], items: t.s3items as string[] },
    { h: t.s4h as string, body: [t.s4p1 as string, t.s4p2 as string] },
    { h: t.s5h as string, body: [t.s5b as string] },
    { h: t.s6h as string, body: [t.s6b as string] },
    { h: t.s7h as string, body: [t.s7b as string] },
    { h: t.s8h as string, body: [t.s8b as string] },
  ]
}

export function DeskLegal({ privacy, terms, effectiveDate, labels, desktopLabel, onDesktop }: DeskLegalProps) {
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy')
  const doc = (tab === 'privacy' ? privacy : terms) as Record<string, string>
  const sections = tab === 'privacy'
    ? privacySections(privacy as Record<string, string | string[]>)
    : termsSections(terms as Record<string, string | string[]>)

  const tabStyle = (active: boolean): React.CSSProperties => ({
    ...PIXEL,
    fontSize: '9px',
    padding: '2px 8px',
    border: '1px solid #c8b8a8',
    backgroundColor: active ? '#3d2e1e' : '#e8e0d8',
    color: active ? '#e8d5b0' : '#3a3028',
  })

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={labels.title}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>{desktopLabel}</StripButton>
      </ScreenStrip>

      <div className="flex gap-1 px-2 pt-2" role="tablist" aria-label={labels.title}>
        <button type="button" role="tab" aria-selected={tab === 'privacy'} style={tabStyle(tab === 'privacy')} onClick={() => setTab('privacy')}>{labels.privacyTab}</button>
        <button type="button" role="tab" aria-selected={tab === 'terms'} style={tabStyle(tab === 'terms')} onClick={() => setTab('terms')}>{labels.termsTab}</button>
      </div>

      <div
        className="flex-1 overflow-y-auto p-3 mx-2 my-2"
        style={{ backgroundColor: '#fffef5', border: '1px solid #d8d0c0', fontFamily: "'Courier New', 'Consolas', monospace", fontSize: '10px', lineHeight: '1.6', color: '#2a2520' }}
      >
        <p style={{ fontWeight: 'bold' }}>{doc.title}</p>
        <p style={{ color: '#6a6058', marginBottom: '8px' }}>{effectiveDate}: {doc.date}</p>
        {sections.map((s) => (
          <section key={s.h} style={{ marginBottom: '10px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '2px' }}>{s.h}</p>
            {s.body.map((b, i) => <p key={i} style={{ marginBottom: '4px' }}>{b}</p>)}
            {s.items && s.items.length > 0 && (
              <ul style={{ listStyle: 'disc', paddingLeft: '16px', marginBottom: '4px' }}>
                {s.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            )}
            {s.after && <p>{s.after}</p>}
          </section>
        ))}
      </div>

      <div className="flex items-center justify-end px-3 h-7 border-t flex-shrink-0" style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8' }}>
        <button type="button" onClick={onDesktop} className="px-3 py-[2px] text-[10px]" style={{ ...PIXEL, backgroundColor: '#e8e0d8', color: '#3a3028', border: '1px solid #c8b8a8' }}>{labels.close}</button>
      </div>
    </div>
  )
}
