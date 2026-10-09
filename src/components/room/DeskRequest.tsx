'use client'

import { useState } from 'react'
import { ScreenStrip, useDeskScreen } from './ScreenStrip'
import { ARCADE, ArcadeButton, PIXEL_FONT } from './pixel-ui'
import { useStageScale } from '@/lib/room/useStageScale'

export interface RequestLabels {
  title: string
  intro: string
  namePh: string
  contactPh: string
  messagePh: string
  send: string
  sending: string
  sent: string
  another: string
  error: string
  count: string
}

interface Props {
  time: string
  labels: RequestLabels
  desktopLabel: string
  backLabel: string
  onDesktop: () => void
  onBack: (e: React.MouseEvent) => void
}

const MAX = 1000

/**
 * Request a feature: a short form whose message reaches the owner's inbox
 * through /api/feature-request (name and contact optional; contact is never
 * shown anywhere). Same honeypot and server guards as the guestbook.
 */
export function DeskRequest({ time, labels, desktopLabel, backLabel, onDesktop, onBack }: Props) {
  const { portrait } = useDeskScreen()
  const { mobile } = useStageScale()
  const touch = portrait || mobile
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || message.trim().length < 5) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/feature-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, contact, message, website }),
      })
      const d = await r.json()
      if (!r.ok || !d.success) { setErr(d.error || labels.error); return }
      setSent(true); setMessage('')
    } catch { setErr(labels.error) } finally { setBusy(false) }
  }

  const font = (size: number): React.CSSProperties => ({ ...PIXEL_FONT, fontSize: size, color: ARCADE.ink })
  const field: React.CSSProperties = {
    ...PIXEL_FONT, color: ARCADE.ink, backgroundColor: '#fffef5', border: `1px solid ${ARCADE.stripBorder}`,
    width: '100%', fontSize: touch ? 16 : 10, padding: portrait ? '8px 6px' : touch ? '5px 6px' : '3px 4px',
  }
  const line = portrait ? 38 : touch ? 32 : 22

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: ARCADE.paper }}>
      <ScreenStrip time={time} title={labels.title} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack} />
      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center" aria-live="polite">
          <p style={font(portrait ? 14 : 12)}>{labels.sent}</p>
          <ArcadeButton size={portrait ? 'xl' : 'md'} onClick={() => setSent(false)}>{labels.another}</ArcadeButton>
        </div>
      ) : (
        <form onSubmit={submit} className={`flex-1 min-h-0 flex flex-col ${portrait ? 'gap-2 p-3' : 'gap-1.5 px-3 py-2'}`}>
          <p style={font(portrait ? 12 : 10)}>{labels.intro}</p>
          <div className={`flex ${portrait ? 'flex-col gap-2' : 'gap-1.5'}`}>
            <input aria-label={labels.namePh} placeholder={labels.namePh} maxLength={32} value={name}
              onChange={(e) => setName(e.target.value)} style={{ ...field, height: line }} />
            <input aria-label={labels.contactPh} placeholder={labels.contactPh} maxLength={120} value={contact}
              onChange={(e) => setContact(e.target.value)} style={{ ...field, height: line }} />
          </div>
          <textarea aria-label={labels.messagePh} placeholder={labels.messagePh} maxLength={MAX} value={message}
            onChange={(e) => setMessage(e.target.value)} className="flex-1 min-h-[60px] resize-none" style={field} />
          <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)}
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
          <div className="flex items-center gap-2">
            <span style={{ ...font(portrait ? 12 : 9), color: ARCADE.inkSoft }}>{labels.count.replace('{n}', String(message.length)).replace('{max}', String(MAX))}</span>
            {err && <span aria-live="polite" style={{ ...font(portrait ? 12 : 9), color: ARCADE.rust }}>{err}</span>}
            <span className="ml-auto">
              <ArcadeButton type="submit" tone="dark" size={portrait ? 'xl' : 'md'} disabled={busy || message.trim().length < 5}>
                {busy ? labels.sending : labels.send}
              </ArcadeButton>
            </span>
          </div>
        </form>
      )}
    </div>
  )
}
