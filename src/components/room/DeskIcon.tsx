import { useId, useRef, useState, useCallback, useEffect, type ReactNode } from 'react'

interface DeskIconProps {
  label: string
  /** Speech-bubble hint shown on hover/focus */
  tooltip?: string
  /** Site links render an <a>; apps omit href and render a <button> */
  href?: string
  icon: ReactNode
  onClick: (e: React.MouseEvent) => void
}

export function DeskIcon({ label, tooltip, href, icon, onClick }: DeskIconProps) {
  const tipId = useId()
  const [showTooltip, setShowTooltip] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const activate = useCallback(() => {
    timerRef.current = setTimeout(() => setShowTooltip(true), 200)
  }, [])

  const deactivate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setShowTooltip(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const className =
    'relative flex flex-col items-center gap-1 group outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(0,0,0,0.4)] focus-visible:outline-offset-1'
  const style = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as React.CSSProperties
  const sharedHandlers = {
    onMouseEnter: activate,
    onMouseLeave: deactivate,
    onFocus: activate,
    onBlur: deactivate,
  }
  const inner = (
    <>
      {tooltip && (
        <span
          id={tipId}
          role="tooltip"
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 border whitespace-nowrap z-10 transition-opacity duration-100 ${showTooltip ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ backgroundColor: '#3d2e1e', borderColor: '#5a4430', borderRadius: '2px', fontSize: '9px', color: '#e8d5b0' }}
        >
          {tooltip}
        </span>
      )}
      <div className="w-10 h-10 flex items-center justify-center group-hover:-translate-y-px transition-transform duration-100">
        <svg width="32" height="32" viewBox="0 0 16 16" fill="none" shapeRendering="crispEdges" aria-hidden="true">
          {icon}
        </svg>
      </div>
      <span
        className="text-[9px] text-[#2a2520] text-center leading-tight max-w-[56px]"
        style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', textShadow: 'none' }}
      >
        {label}
      </span>
    </>
  )
  return href ? (
    <a href={href} onClick={onClick} className={className} aria-label={label} aria-describedby={tooltip ? tipId : undefined} style={style} {...sharedHandlers}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={className} aria-label={label} aria-describedby={tooltip ? tipId : undefined} style={style} {...sharedHandlers}>
      {inner}
    </button>
  )
}

// 16×16 pixel icons (each rect is 1px in the 16×16 grid)

export const ICON_HOME = (
  <>
    <rect x="2" y="6" width="12" height="9" fill="#3a3028" />
    <rect x="4" y="8" width="3" height="7" fill="#faf8f5" />
    <rect x="10" y="11" width="2" height="4" fill="#faf8f5" />
    <rect x="1" y="5" width="14" height="2" fill="#5a4a3a" />
    <rect x="7" y="2" width="2" height="4" fill="#5a4a3a" />
    <rect x="6" y="1" width="4" height="2" fill="#5a4a3a" />
  </>
)

export const ICON_GAMES = (
  <>
    <rect x="2" y="3" width="4" height="2" fill="#3a3028" />
    <rect x="8" y="3" width="4" height="2" fill="#3a3028" />
    <rect x="3" y="5" width="2" height="3" fill="#3a3028" />
    <rect x="9" y="5" width="2" height="3" fill="#3a3028" />
    <rect x="4" y="9" width="7" height="1" fill="#5a4a3a" />
    <rect x="5" y="10" width="5" height="2" fill="#5a4a3a" />
    {/* D-pad */}
    <rect x="3" y="12" width="1" height="2" fill="#5a4a3a" />
    <rect x="2" y="13" width="3" height="1" fill="#5a4a3a" />
  </>
)

export const ICON_PROJECTS = (
  <>
    <rect x="3" y="2" width="10" height="10" fill="#faf8f5" />
    <rect x="2" y="1" width="10" height="1" fill="#5a4a3a" />
    <rect x="2" y="1" width="1" height="11" fill="#5a4a3a" />
    <rect x="3" y="5" width="6" height="1" fill="#3a3028" />
    <rect x="3" y="7" width="4" height="1" fill="#3a3028" />
    <rect x="3" y="9" width="5" height="1" fill="#3a3028" />
  </>
)

export const ICON_TUTORING = (
  <>
    <rect x="5" y="1" width="4" height="2" fill="#3a3028" />
    <rect x="5" y="3" width="4" height="7" fill="#faf8f5" />
    <rect x="4" y="3" width="1" height="7" fill="#5a4a3a" />
    <rect x="9" y="3" width="1" height="7" fill="#5a4a3a" />
    <rect x="5" y="10" width="4" height="1" fill="#5a4a3a" />
    <rect x="3" y="13" width="2" height="1" fill="#3a3028" />
    <rect x="9" y="13" width="2" height="1" fill="#3a3028" />
    <rect x="6" y="13" width="2" height="2" fill="#5a4a3a" />
  </>
)

export const ICON_CONTACT = (
  <>
    <rect x="2" y="3" width="10" height="8" fill="#faf8f5" />
    <rect x="1" y="2" width="12" height="1" fill="#5a4a3a" />
    <rect x="1" y="3" width="1" height="8" fill="#5a4a3a" />
    <rect x="12" y="3" width="1" height="8" fill="#5a4a3a" />
    <rect x="2" y="11" width="10" height="1" fill="#5a4a3a" />
    {/* Envelope flap */}
    <polygon points="2,3 7,8 12,3" fill="#3a3028" />
  </>
)

export const ICON_LEGAL = (
  <>
    <circle cx="7" cy="7" r="2" fill="none" stroke="#3a3028" strokeWidth="1" />
    <rect x="5" y="5" width="1" height="5" fill="#5a4a3a" />
    <rect x="6" y="4" width="1" height="1" fill="#5a4a3a" />
    <rect x="9" y="3" width="1" height="8" fill="#5a4a3a" />
    {/* Base */}
    <rect x="7" y="12" width="4" height="1" fill="#3a3028" />
    <rect x="8" y="13" width="2" height="2" fill="#5a4a3a" />
  </>
)

export const ICON_PAINT = (
  <>
    {/* Brush handle + ferrule */}
    <rect x="10" y="1" width="2" height="5" fill="#5a4a3a" />
    <rect x="9" y="6" width="4" height="2" fill="#3a3028" />
    <rect x="10" y="8" width="2" height="2" fill="#e8d5b0" />
    {/* Paint blob */}
    <rect x="3" y="10" width="8" height="3" fill="#8a4a3a" />
    <rect x="2" y="11" width="1" height="2" fill="#8a4a3a" />
    <rect x="11" y="11" width="1" height="1" fill="#8a4a3a" />
    <rect x="5" y="9" width="3" height="1" fill="#8a4a3a" />
    <rect x="4" y="13" width="5" height="1" fill="#6a3a2a" />
  </>
)

export const ICON_MINESWEEPER = (
  <>
    {/* Mine body */}
    <rect x="5" y="5" width="6" height="6" fill="#3a3028" />
    <rect x="6" y="4" width="4" height="8" fill="#3a3028" />
    <rect x="4" y="6" width="8" height="4" fill="#3a3028" />
    {/* Spikes */}
    <rect x="7" y="1" width="2" height="2" fill="#5a4a3a" />
    <rect x="7" y="13" width="2" height="2" fill="#5a4a3a" />
    <rect x="1" y="7" width="2" height="2" fill="#5a4a3a" />
    <rect x="13" y="7" width="2" height="2" fill="#5a4a3a" />
    {/* Glint */}
    <rect x="6" y="6" width="2" height="2" fill="#faf8f5" />
  </>
)
