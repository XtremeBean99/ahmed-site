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
      <ScreenStrip time={time} />
      <button
        onClick={onBack}
        aria-label={backLabel}
        className="absolute top-3 right-3 z-10 flex items-center gap-2 px-4 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0a2e33] transition-transform duration-100 active:translate-y-[2px]"
        style={{
          fontFamily: 'var(--font-pixel), "Courier New", monospace',
          fontSize: '15px',
          color: '#08343a',
          textShadow: '1px 1px 0 rgba(255,255,255,0.35)',
          background: 'linear-gradient(180deg, #8ff2f6 0%, #2fc3d2 45%, #0f95a2 100%)',
          border: '4px solid #0a2e33',
          clipPath:
            'polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)',
          boxShadow: 'inset 2px 2px 0 rgba(255,255,255,0.55), inset -3px -3px 0 rgba(0,0,0,0.3)',
        }}
      >
        <span aria-hidden>&larr;</span> To {backLabel}
      </button>
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
