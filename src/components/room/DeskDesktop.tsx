// src/components/room/DeskDesktop.tsx
import { DeskIcon } from './DeskIcon'
import { ScreenStrip } from './ScreenStrip'

export interface DesktopShortcut {
  id: string
  label: string
  tooltip: string
  kind: 'site' | 'app' | 'external'
  target: string
  icon: React.ReactNode
  /** Rendered icon size in px (square). Defaults to 32. */
  iconSize?: number
}

interface DeskDesktopProps {
  time: string
  screenLabel: string
  shortcuts: DesktopShortcut[]
  screensaver: boolean
  reduce: boolean | null
  screenW: number
  screenH: number
  onShortcutClick: (e: React.MouseEvent, s: DesktopShortcut) => void
}
export function DeskDesktop({
  time,
  screenLabel,
  shortcuts,
  screensaver,
  reduce,
  screenW,
  screenH,
  onShortcutClick,
}: DeskDesktopProps) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time} />
      <nav aria-label={screenLabel} className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-3 gap-x-8 gap-y-5 px-4">
          {shortcuts.map((s) => (
            <DeskIcon
              key={s.id}
              label={s.label}
              tooltip={s.tooltip}
              href={s.kind === 'app' ? undefined : s.target}
              icon={s.icon}
              iconSize={s.iconSize}
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
