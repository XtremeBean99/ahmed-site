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
  backLabel: string
  onBack: (e: React.MouseEvent) => void
  screenLabel: string
  shortcuts: DesktopShortcut[]
  screensaver: boolean
  reduce: boolean | null
  screenW: number
  screenH: number
  onShortcutClick: (e: React.MouseEvent, s: DesktopShortcut) => void
  /** Shortcut id to auto-focus on mount (the app the visitor just left). */
  focusId?: string | null
  /** Files saved to ~/Desktop from the Terminal app */
  files?: { name: string; path: string }[]
  onFileClick?: (path: string) => void
}

// 16x16 pixel page with a folded corner
const ICON_FILE = (
  <>
    <rect x="3" y="1" width="8" height="1" fill="#3a3028" /><rect x="3" y="2" width="1" height="13" fill="#3a3028" />
    <rect x="4" y="14" width="9" height="1" fill="#3a3028" /><rect x="12" y="5" width="1" height="9" fill="#3a3028" />
    <rect x="11" y="2" width="1" height="3" fill="#3a3028" /><rect x="11" y="4" width="2" height="1" fill="#3a3028" />
    <rect x="4" y="2" width="7" height="12" fill="#fffaf0" /><rect x="11" y="5" width="1" height="9" fill="#fffaf0" />
    <rect x="5" y="6" width="5" height="1" fill="#8a7a68" /><rect x="5" y="8" width="6" height="1" fill="#8a7a68" /><rect x="5" y="10" width="4" height="1" fill="#8a7a68" />
  </>
)

export function DeskDesktop({
  time,
  backLabel,
  onBack,
  screenLabel,
  shortcuts,
  screensaver,
  reduce,
  screenW,
  screenH,
  onShortcutClick,
  files,
  onFileClick,
  focusId,
}: DeskDesktopProps) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time} backLabel={backLabel} onBack={onBack} />
      <nav aria-label={screenLabel} className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-5 gap-x-7 gap-y-4 px-4">
          {shortcuts.map((s) => (
            <DeskIcon
              key={s.id}
              label={s.label}
              tooltip={s.tooltip}
              href={s.kind === 'app' ? undefined : s.target}
              icon={s.icon}
              iconSize={s.iconSize}
              onClick={(e) => onShortcutClick(e, s)}
              autoFocus={s.id === focusId}
            />
          ))}
        </div>
      </nav>

      {files && files.length > 0 && (
        <div aria-label="Desktop files" className="absolute bottom-1 left-2 right-2 flex gap-3 overflow-hidden">
          {files.slice(0, 8).map((f) => (
            <DeskIcon
              key={f.path}
              label={f.name.length > 10 ? f.name.slice(0, 9) + '…' : f.name}
              tooltip={f.name}
              icon={ICON_FILE}
              iconSize={24}
              onClick={(e) => { e.preventDefault(); onFileClick?.(f.path) }}
            />
          ))}
        </div>
      )}

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
