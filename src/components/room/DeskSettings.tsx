'use client'

import { ScreenStrip, StripButton } from './ScreenStrip'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export interface SettingsLabels {
  title: string; sfx: string; sfxVolume: string; musicVolume: string
  clock: string; clock12: string; clock24: string; calm: string; calmHint: string
  on: string; off: string; close: string
}

interface DeskSettingsProps {
  labels: SettingsLabels
  desktopLabel: string
  sfxOn: boolean; onSfx: (v: boolean) => void
  sfxVolume: number; onSfxVolume: (v: number) => void
  musicVolume: number; onMusicVolume: (v: number) => void
  is24h: boolean; onClock: (v: boolean) => void
  calm: boolean; onCalm: (v: boolean) => void
  onDesktop: () => void
}

export function DeskSettings(p: DeskSettingsProps) {
  const Toggle = ({ on, onChange, aria }: { on: boolean; onChange: (v: boolean) => void; aria: string }) => (
    <button type="button" role="switch" aria-checked={on} aria-label={aria}
      onClick={() => onChange(!on)} style={{ ...PIXEL, fontSize: '10px', padding: '2px 10px',
      border: '1px solid #c8b8a8', backgroundColor: on ? '#3d2e1e' : '#e8e0d8',
      color: on ? '#e8d5b0' : '#3a3028' }}>
      {on ? p.labels.on : p.labels.off}
    </button>
  )
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 4px', borderBottom: '1px solid #e0d8cc' } as const
  const slider = (v: number, on: (n: number) => void, aria: string) => (
    <input type="range" min={0} max={1} step={0.05} value={v} aria-label={aria}
      onChange={(e) => on(Number(e.target.value))}
      style={{ width: 90, accentColor: '#3d2e1e' }} />
  )
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={p.labels.title}>
        <StripButton onClick={p.onDesktop} ariaLabel={p.desktopLabel}>{p.desktopLabel}</StripButton>
      </ScreenStrip>
      <div className="flex-1 overflow-y-auto px-4 py-2" style={{ ...PIXEL, fontSize: '11px', color: '#2a2520' }}>
        <div style={row}><span>{p.labels.sfx}</span><Toggle on={p.sfxOn} onChange={p.onSfx} aria={p.labels.sfx} /></div>
        <div style={row}><span>{p.labels.sfxVolume}</span>{slider(p.sfxVolume, p.onSfxVolume, p.labels.sfxVolume)}</div>
        <div style={row}><span>{p.labels.musicVolume}</span>{slider(p.musicVolume, p.onMusicVolume, p.labels.musicVolume)}</div>
        <div style={row}><span>{p.labels.clock}</span><Toggle on={p.is24h} onChange={p.onClock} aria={p.labels.clock} /></div>
        <div style={{ ...row, borderBottom: 'none', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between' }}>
            <span>{p.labels.calm}</span><Toggle on={p.calm} onChange={p.onCalm} aria={p.labels.calm} />
          </div>
          <span style={{ fontSize: '9px', color: '#8a8078' }}>{p.labels.calmHint}</span>
        </div>
      </div>
    </div>
  )
}
