'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { type BotSpeed } from './prefs'
import { Tooltip } from './Tooltip'
import { COLORS, PIXEL_FONT, PixelButton } from './ui'

export function SettingsMenu({
  botSpeed,
  tooltips,
  showBoardKey,
  onBotSpeedChange,
  onTooltipsChange,
  onShowBoardKeyChange,
}: {
  botSpeed: BotSpeed
  tooltips: boolean
  showBoardKey: boolean
  onBotSpeedChange: (speed: BotSpeed) => void
  onTooltipsChange: (enabled: boolean) => void
  onShowBoardKeyChange: (shown: boolean) => void
}) {
  const t = useT()
  const d = t.catan.settings
  const speed = t.catan.speed
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

  const speedOptions: { value: BotSpeed; label: string }[] = [
    { value: 0, label: speed.instant },
    { value: 200, label: speed.fast },
    { value: 450, label: speed.normal },
    { value: 900, label: speed.slow },
  ]

  return (
    <div style={{ position: 'relative' }}>
      <Tooltip content={d.title}>
        <PixelButton
          ref={triggerRef}
          data-tutorial="settings"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {d.title}
        </PixelButton>
      </Tooltip>
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
            width: 220,
            backgroundColor: COLORS.panel,
            border: `2px solid ${COLORS.panelBorder}`,
            boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text }}>{d.tooltips}</span>
            <Tooltip content={d.tooltipsHint}>
              <PixelButton
                aria-pressed={tooltips}
                onClick={() => onTooltipsChange(!tooltips)}
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span>{tooltips ? d.on : d.off}</span>
              </PixelButton>
            </Tooltip>
          </div>
          <div data-tutorial="speed" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text }}>{speed.label}</span>
            <div role="group" aria-label={speed.label} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {speedOptions.map((option) => (
                <Tooltip key={option.value} content={`${speed.label}: ${option.label}`}>
                  <PixelButton
                    selected={botSpeed === option.value}
                    aria-pressed={botSpeed === option.value}
                    onClick={() => onBotSpeedChange(option.value)}
                  >
                    {option.label}
                  </PixelButton>
                </Tooltip>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text }}>{d.boardKey}</span>
            <Tooltip content={d.boardKeyHint}>
              <PixelButton
                aria-pressed={showBoardKey}
                onClick={() => onShowBoardKeyChange(!showBoardKey)}
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                <span>{showBoardKey ? d.on : d.off}</span>
              </PixelButton>
            </Tooltip>
          </div>
        </div>
      ) : null}
    </div>
  )
}
