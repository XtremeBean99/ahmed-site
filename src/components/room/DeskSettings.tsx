'use client'

import { ScreenStrip } from './ScreenStrip'
import { ArcadeButton } from './pixel-ui'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export interface SettingsLabels {
  title: string; sfx: string; sfxVolume: string; musicVolume: string
  clock: string; clock12: string; clock24: string
  on: string; off: string; close: string
}

interface DeskSettingsProps {
  time: string
  labels: SettingsLabels
  desktopLabel: string
  backLabel: string
  onBack: (e: React.MouseEvent) => void
  sfxOn: boolean; onSfx: (v: boolean) => void
  sfxVolume: number; onSfxVolume: (v: number) => void
  musicVolume: number; onMusicVolume: (v: number) => void
  is24h: boolean; onClock: () => void
  onDesktop: () => void
}

// Module level: defined inside render it would remount on every click and drop keyboard focus.
function Toggle({ on, onChange, aria, onLabel, offLabel }: { on: boolean; onChange: (v: boolean) => void; aria: string; onLabel: string; offLabel: string }) {
  return (
    <ArcadeButton tone="dark" size="sm" pressed={on} ariaLabel={aria} onClick={() => onChange(!on)}>
      {on ? onLabel : offLabel}
    </ArcadeButton>
  )
}

export function DeskSettings(p: DeskSettingsProps) {
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 4px', borderBottom: '1px solid #e0d8cc' } as const
  const slider = (v: number, on: (n: number) => void, aria: string) => (
    <input type="range" min={0} max={1} step={0.05} value={v} aria-label={aria}
      onChange={(e) => on(Number(e.target.value))}
      style={{ width: 90, accentColor: '#3d2e1e' }} />
  )
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={p.time} title={p.labels.title} desktopLabel={p.desktopLabel} onDesktop={p.onDesktop} backLabel={p.backLabel} onBack={p.onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-2" style={{ ...PIXEL, fontSize: '11px', color: '#2a2520' }}>
        <div style={row}><span>{p.labels.sfx}</span><Toggle on={p.sfxOn} onChange={p.onSfx} aria={p.labels.sfx} onLabel={p.labels.on} offLabel={p.labels.off} /></div>
        <div style={row}><span>{p.labels.sfxVolume}</span>{slider(p.sfxVolume, p.onSfxVolume, p.labels.sfxVolume)}</div>
        <div style={row}><span>{p.labels.musicVolume}</span>{slider(p.musicVolume, p.onMusicVolume, p.labels.musicVolume)}</div>
        <div style={row}><span>{p.labels.clock}</span><Toggle on={p.is24h} onChange={() => p.onClock()} aria={p.labels.clock} onLabel={p.labels.on} offLabel={p.labels.off} /></div>
      </div>
    </div>
  )
}
