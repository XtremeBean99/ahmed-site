'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { BOT_SPEEDS, type CatanPrefs } from './prefs'
import { useCatanSound } from './sound'
import { useCatanLayout } from './layout'
import { COLORS, FOCUS_CLASS, FONT, PIXEL_FONT, PixelButton } from './ui'

export interface SettingsMenuProps {
  prefs: CatanPrefs
  onChange: (patch: Partial<CatanPrefs>) => void
  /** popover: a Settings button that opens the panel (top bar). inline: the panel alone (inside a sheet). */
  variant?: 'popover' | 'inline'
}

export function SettingsMenu({ prefs, onChange, variant = 'popover' }: SettingsMenuProps) {
  const t = useT()
  const d = t.catan.settings
  const speed = t.catan.speed
  const sound = useCatanSound(prefs.sound, prefs.volume)
  const { coarse } = useCatanLayout()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const volumePercent = Math.round(prefs.volume * 100)
  const setVolume = (value: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(value / 10) * 10))
    onChange({ volume: clamped / 100 })
    sound.play('click')
  }

  const speedOptions = BOT_SPEEDS.map((value) => ({
    value,
    label: value === 0 ? speed.instant : value === 200 ? speed.fast : value === 450 ? speed.normal : speed.slow,
  }))

  const toggle = (label: string, checked: boolean, onToggle: () => void, hint?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PixelButton
        aria-pressed={checked}
        onClick={onToggle}
        style={{ justifyContent: 'space-between', width: '100%' }}
      >
        <span>{label}</span>
        <span>{checked ? d.on : d.off}</span>
      </PixelButton>
      {hint ? <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.muted }}>{hint}</span> : null}
    </div>
  )

  const controls = (
    <>
      {toggle(d.sound, prefs.sound, () => onChange({ sound: !prefs.sound }))}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>
          {d.volume} {volumePercent}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={volumePercent}
          onChange={(e) => setVolume(Number(e.target.value))}
          className={FOCUS_CLASS}
          style={{
            width: '100%',
            minHeight: coarse ? 44 : 28,
            accentColor: COLORS.accent,
            backgroundColor: COLORS.bg,
            border: `2px solid ${COLORS.panelBorder}`,
          }}
        />
      </label>
      {toggle(d.animations, prefs.animations, () => onChange({ animations: !prefs.animations }), d.animationsHint)}
      <div data-tutorial="speed" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{speed.label}</span>
        <div role="group" aria-label={speed.label} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {speedOptions.map((option) => (
            <PixelButton
              key={option.value}
              selected={prefs.botSpeed === option.value}
              aria-pressed={prefs.botSpeed === option.value}
              onClick={() => onChange({ botSpeed: option.value })}
            >
              {option.label}
            </PixelButton>
          ))}
        </div>
      </div>
      {toggle(d.tooltips, prefs.tooltips, () => onChange({ tooltips: !prefs.tooltips }), d.tooltipsHint)}
    </>
  )

  if (variant === 'inline') {
    return (
      <div role="group" aria-label={d.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {controls}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <PixelButton
        ref={triggerRef}
        data-tutorial="settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {d.title}
      </PixelButton>
      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={d.title}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 40,
            width: 240,
            backgroundColor: COLORS.panel,
            border: `2px solid ${COLORS.panelBorder}`,
            boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {controls}
        </div>
      ) : null}
    </div>
  )
}
