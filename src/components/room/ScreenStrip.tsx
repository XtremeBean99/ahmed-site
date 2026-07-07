// src/components/room/ScreenStrip.tsx
import type { ReactNode } from 'react'

const PIXEL_FONT = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

/** The 28px status strip across the top of every desk screen mode. */
export function ScreenStrip({ time, children }: { time: string; children?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between px-3 h-7 border-b flex-shrink-0"
      style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8', fontSize: '10px', color: '#3a3028', ...PIXEL_FONT }}
    >
      <span>{time}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function StripButton({
  onClick,
  children,
  ariaLabel,
  pressed,
}: {
  onClick: (e: React.MouseEvent) => void
  children: ReactNode
  ariaLabel?: string
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      className="hover:text-[#6a5040] transition-colors outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#3a3028]"
      style={{ textDecoration: pressed ? 'underline' : 'none', ...PIXEL_FONT }}
    >
      {children}
    </button>
  )
}
