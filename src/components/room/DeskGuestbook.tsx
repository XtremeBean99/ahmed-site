'use client'

import { useEffect, useState } from 'react'
import { ScreenStrip, StripButton } from './ScreenStrip'
import type { GuestbookEntry } from '@/services/guestbook'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export interface GuestbookLabels { title: string; close: string; namePh: string; messagePh: string; sign: string; empty: string; posting: string; error: string }

interface Props { labels: GuestbookLabels; desktopLabel: string; onDesktop: () => void }

export function DeskGuestbook({ labels, desktopLabel, onDesktop }: Props) {
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null)
  const [name, setName] = useState(''); const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')

  useEffect(() => { fetch('/api/guestbook').then((r) => r.json()).then((d) => setEntries(d.entries ?? [])).catch(() => setEntries([])) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return
    setBusy(true); setErr('')
    try {
      const r = await fetch('/api/guestbook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, message, website }) })
      const d = await r.json()
      if (!r.ok || !d.success) { setErr(d.error || labels.error); return }
      if (d.entry) { setEntries((prev) => [d.entry, ...(prev ?? [])]); setName(''); setMessage('') }
      else { setErr(labels.error) }
    } catch { setErr(labels.error) } finally { setBusy(false) }
  }

  const inputStyle: React.CSSProperties = { ...PIXEL, fontSize: 10, color: '#2a2520', backgroundColor: '#fffef5', border: '1px solid #c8b8a8', padding: '2px 4px', width: '100%' }

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={labels.title}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>{desktopLabel}</StripButton>
      </ScreenStrip>
      <div className="flex-1 overflow-y-auto p-2 mx-2 mt-2" style={{ backgroundColor: '#fffef5', border: '1px solid #d8d0c0', ...PIXEL, fontSize: 10, color: '#2a2520' }}>
        {entries === null ? null : entries.length === 0 ? <p>{labels.empty}</p> : entries.map((en) => (
          <div key={en.id} className="mb-2 pb-1" style={{ borderBottom: '1px dotted #d8d0c0' }}>
            <b style={{ color: '#3d2e1e' }}>{en.name}</b> <span style={{ opacity: 0.6 }}>{new Date(en.at).toLocaleDateString()}</span>
            <div style={{ wordBreak: 'break-word' }}>{en.message}</div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-1 px-2 py-2">
        <input aria-label={labels.namePh} placeholder={labels.namePh} maxLength={32} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input aria-label={labels.messagePh} placeholder={labels.messagePh} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} style={inputStyle} />
        <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
        {err && <span style={{ ...PIXEL, fontSize: 9, color: '#a33' }}>{err}</span>}
        <button type="submit" disabled={busy || !name.trim() || !message.trim()} style={{ ...PIXEL, fontSize: 10, backgroundColor: '#e8e0d8', color: '#3a3028', border: '1px solid #c8b8a8', padding: '2px 6px', opacity: busy ? 0.6 : 1 }}>{busy ? labels.posting : labels.sign}</button>
      </form>
    </div>
  )
}
