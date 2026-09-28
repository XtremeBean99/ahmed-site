'use client'

import { useEffect, useRef, useState } from 'react'
import { ScreenStrip, useDeskScreen } from './ScreenStrip'
import { ArcadeButton } from './pixel-ui'
import { useStageScale } from '@/lib/room/useStageScale'
import type { GuestbookEntry } from '@/services/guestbook'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export interface GuestbookLabels { title: string; close: string; namePh: string; messagePh: string; sign: string; empty: string; posting: string; error: string }

interface Props {
  time: string
  labels: GuestbookLabels
  desktopLabel: string
  backLabel: string
  onDesktop: () => void
  onBack: (e: React.MouseEvent) => void
}

export function DeskGuestbook({ time, labels, desktopLabel, backLabel, onDesktop, onBack }: Props) {
  const { portrait } = useDeskScreen()
  const { mobile } = useStageScale()
  const [entries, setEntries] = useState<GuestbookEntry[] | null>(null)
  const [name, setName] = useState(''); const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('')
  const focusTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => { fetch('/api/guestbook').then((r) => r.json()).then((d) => setEntries(d.entries ?? [])).catch(() => setEntries([])) }, [])
  useEffect(() => () => { if (focusTimer.current) clearTimeout(focusTimer.current) }, [])

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

  // The global CSS forces 16px on touch inputs; these sizes hold that text
  // without clipping in the portrait stack and the landscape touch layout.
  const touch = portrait || mobile
  const inputStyle: React.CSSProperties = {
    ...PIXEL,
    color: '#2a2520',
    backgroundColor: '#fffef5',
    border: '1px solid #c8b8a8',
    width: '100%',
    fontSize: touch ? 16 : 10,
    padding: portrait ? '8px 6px' : touch ? '5px 6px' : '2px 4px',
    ...(portrait ? { height: 38 } : touch ? { height: 32 } : {}),
  }

  const keepVisible = (e: React.FocusEvent<HTMLInputElement>) => {
    if (!mobile) return
    if (focusTimer.current) clearTimeout(focusTimer.current)
    focusTimer.current = setTimeout(() => { e.currentTarget.scrollIntoView({ block: 'center' }) }, 300)
  }
  const blurTimer = () => { if (focusTimer.current) clearTimeout(focusTimer.current) }

  const entriesList = (
    <div
      className={`overflow-y-auto ${portrait ? 'flex-1 px-2 py-2 mx-2 mb-2' : 'flex-1 p-2 mx-2 mt-2'}`}
      style={{ backgroundColor: '#fffef5', border: '1px solid #d8d0c0', ...PIXEL, fontSize: portrait ? 12 : 10, color: '#2a2520' }}
    >
      {entries === null ? null : entries.length === 0 ? <p>{labels.empty}</p> : entries.map((en) => (
        <div key={en.id} className="mb-2 pb-1" style={{ borderBottom: '1px dotted #d8d0c0' }}>
          <b style={{ color: '#3d2e1e' }}>{en.name}</b> <span style={{ opacity: 0.6 }}>{new Date(en.at).toLocaleDateString()}</span>
          <div style={{ wordBreak: 'break-word' }}>{en.message}</div>
        </div>
      ))}
    </div>
  )

  const form = (
    <form onSubmit={submit} className={`flex flex-col ${portrait ? 'gap-1.5 px-2 py-2' : 'gap-1 px-2 py-2'}`}>
      <input aria-label={labels.namePh} placeholder={labels.namePh} maxLength={32} value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} onFocus={keepVisible} onBlur={blurTimer} />
      <input aria-label={labels.messagePh} placeholder={labels.messagePh} maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} style={inputStyle} onFocus={keepVisible} onBlur={blurTimer} />
      <input tabIndex={-1} autoComplete="off" aria-hidden value={website} onChange={(e) => setWebsite(e.target.value)} style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />
      {err && <span aria-live="polite" style={{ ...PIXEL, fontSize: portrait ? 12 : 9, color: '#a33' }}>{err}</span>}
      <ArcadeButton type="submit" tone="dark" size={portrait ? 'xl' : 'sm'} disabled={busy || !name.trim() || !message.trim()} className={portrait ? 'w-full' : undefined}>{busy ? labels.posting : labels.sign}</ArcadeButton>
    </form>
  )

  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time} title={labels.title} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack} />
      {portrait ? (<>{form}{entriesList}</>) : (<>{entriesList}{form}</>)}
    </div>
  )
}
