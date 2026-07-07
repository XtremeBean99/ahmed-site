// src/components/room/DeskDesktop.tsx
'use client'

import { DeskIcon } from './DeskIcon'
import { ScreenStrip, StripButton } from './ScreenStrip'

export interface DesktopShortcut {
  id: string
  label: string
  tooltip: string
  kind: 'site' | 'app' | 'external'
  target: string
  icon: React.ReactNode
}

interface DeskDesktopProps {
  time: string
  backLabel: string
  screenLabel: string
  shortcuts: DesktopShortcut[]
  screensaver: boolean
  reduce: boolean | null
  screenW: number
  screenH: number
  onBack: (e: React.MouseEvent) => void
  onShortcutClick: (e: React.MouseEvent, s: DesktopShortcut) => void
}

export function DeskDesktop({
  time,
  backLabel,
  screenLabel,
  shortcuts,
  screensaver,
  reduce,
  screenW,
  screenH,
  onBack,
  onShortcutClick,
}: DeskDesktopProps) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time}>
        <StripButton onClick={onBack} ariaLabel={backLabel}>← {backLabel}</StripButton>
      </ScreenStrip>
      <nav aria-label={screenLabel} className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-x-8 gap-y-5 px-4">
          {shortcuts.map((s) => (
            <DeskIcon
              key={s.id}
              label={s.label}
              tooltip={s.tooltip}
              href={s.kind === 'app' ? undefined : s.target}
              icon={s.icon}
              onClick={(e) => onShortcutClick(e, s)}
            />
          ))}
        </div>
      </nav>

      {/* Idle screensaver overlay (moved verbatim from DeskView) */}
      {screensaver && !reduce && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#faf8f5' }} aria-hidden>
          <div
            className="relative"
            style={{
              width: 40,
              height: 20,
              animation: 'screensaver-drift 10s linear infinite',
              '--sw': screenW + 'px',
              '--sh': screenH + 'px',
            } as React.CSSProperties}
          >
            <div
              style={{
                width: 40,
                height: 20,
                backgroundColor: '#3a3028',
                borderRadius: '2px',
                fontFamily: 'var(--font-pixel), "Courier New", monospace',
                fontSize: '8px',
                color: '#faf8f5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              AH
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
