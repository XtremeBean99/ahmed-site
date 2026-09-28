'use client'

import { useEffect, useState } from 'react'
import { ScreenStrip, useDeskScreen } from './ScreenStrip'
import { ArcadeButton } from './pixel-ui'
import { isMediaVolumeReadOnly } from '@/lib/room/media'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

// A portrait range input with a 28px thumb; the desk keeps the native accent-colour slider.
const RANGE_CSS = `
.room-range{-webkit-appearance:none;appearance:none;height:28px;background:transparent;outline:none;cursor:pointer}
.room-range:focus-visible{outline:2px solid #5a4430;outline-offset:2px}
.room-range::-webkit-slider-runnable-track{height:8px;background:#d8d0c0;border:1px solid #c8b8a8}
.room-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:28px;height:28px;margin-top:-9px;background:#3d2e1e;border:2px solid #5a4430;border-radius:0}
.room-range::-moz-range-track{height:8px;background:#d8d0c0;border:1px solid #c8b8a8}
.room-range::-moz-range-thumb{width:28px;height:28px;background:#3d2e1e;border:2px solid #5a4430;border-radius:0}
`

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
function Toggle({ on, onChange, aria, onLabel, offLabel, size = 'sm' }: { on: boolean; onChange: (v: boolean) => void; aria: string; onLabel: string; offLabel: string; size?: 'sm' | 'xl' }) {
  return (
    <ArcadeButton tone="dark" size={size} pressed={on} ariaLabel={aria} onClick={() => onChange(!on)}>
      {on ? onLabel : offLabel}
    </ArcadeButton>
  )
}

export function DeskSettings(p: DeskSettingsProps) {
  const { portrait } = useDeskScreen()
  const [volumeReadOnly, setVolumeReadOnly] = useState(false)
  // Server and first client render agree on false; iOS reports back on mount.
  useEffect(() => { setVolumeReadOnly(isMediaVolumeReadOnly()) }, [])

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    ...(portrait ? { height: 48, padding: '0 10px' } : { padding: '8px 4px' }),
    borderBottom: '1px solid #e0d8cc',
  }
  const slider = (v: number, on: (n: number) => void, aria: string) => (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={v}
      aria-label={aria}
      onChange={(e) => on(Number(e.target.value))}
      className={portrait ? 'room-range' : undefined}
      style={portrait ? { width: 160, touchAction: 'none' } : { width: 90, accentColor: '#3d2e1e' }}
    />
  )
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      {portrait && <style>{RANGE_CSS}</style>}
      <ScreenStrip time={p.time} title={p.labels.title} desktopLabel={p.desktopLabel} onDesktop={p.onDesktop} backLabel={p.backLabel} onBack={p.onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-2" style={{ ...PIXEL, fontSize: portrait ? 12 : 11, color: '#2a2520' }}>
        <div style={rowStyle}><span>{p.labels.sfx}</span><Toggle size={portrait ? 'xl' : 'sm'} on={p.sfxOn} onChange={p.onSfx} aria={p.labels.sfx} onLabel={p.labels.on} offLabel={p.labels.off} /></div>
        <div style={rowStyle}><span>{p.labels.sfxVolume}</span>{slider(p.sfxVolume, p.onSfxVolume, p.labels.sfxVolume)}</div>
        {!volumeReadOnly && (
          <div style={rowStyle}><span>{p.labels.musicVolume}</span>{slider(p.musicVolume, p.onMusicVolume, p.labels.musicVolume)}</div>
        )}
        <div style={rowStyle}><span>{p.labels.clock}</span><Toggle size={portrait ? 'xl' : 'sm'} on={p.is24h} onChange={() => p.onClock()} aria={p.labels.clock} onLabel={p.labels.on} offLabel={p.labels.off} /></div>
      </div>
    </div>
  )
}
