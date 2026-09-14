'use client'

import { useEffect, useRef } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

export const PIXEL_FONT = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

export const COLORS = {
  bg: '#2a2220',
  panel: '#3d2e1e',
  panelBorder: '#5a4430',
  panelDark: '#1a0e04',
  text: '#e8d5b0',
  muted: '#a09080',
  accent: '#e0a040',
  danger: '#c0503a',
} as const

export const FOCUS_CLASS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(200,184,154,0.7)]'

export function pixelStyle(extra?: CSSProperties): CSSProperties {
  return { ...PIXEL_FONT, ...extra }
}

export function PixelButton({
  children,
  variant = 'default',
  selected = false,
  className = '',
  style,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  selected?: boolean
}) {
  const palette = {
    default: { bg: COLORS.panel, border: COLORS.panelBorder, color: COLORS.text },
    primary: { bg: COLORS.accent, border: COLORS.panelDark, color: COLORS.panelDark },
    danger: { bg: COLORS.danger, border: COLORS.panelDark, color: COLORS.text },
    ghost: { bg: 'transparent', border: COLORS.panelBorder, color: COLORS.muted },
  }[variant]

  return (
    <button
      type={type}
      className={`${FOCUS_CLASS} ${className}`}
      style={{
        ...PIXEL_FONT,
        fontSize: 10,
        padding: '6px 8px',
        backgroundColor: palette.bg,
        color: palette.color,
        border: `2px solid ${palette.border}`,
        boxShadow: selected ? `0 0 0 2px ${COLORS.accent}` : undefined,
        cursor: props.disabled ? 'default' : 'pointer',
        opacity: props.disabled ? 0.45 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        lineHeight: 1.1,
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  )
}

export function Panel({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <section
      className={className}
      style={{
        backgroundColor: COLORS.panel,
        border: `2px solid ${COLORS.panelBorder}`,
        color: COLORS.text,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

export function SectionTitle({ children, id, style }: { children: ReactNode; id?: string; style?: CSSProperties }) {
  return (
    <h2 id={id} style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, margin: 0, letterSpacing: 1, ...style }}>
      {children}
    </h2>
  )
}

export function Muted({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted, ...style }}>{children}</span>
  )
}

/** Fixed overlay for dialogs; square pixel corners, no blur. */
export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(26, 14, 4, 0.72)',
        padding: 16,
      }}
    >
      {children}
    </div>
  )
}

export function DialogPanel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        ...PIXEL_FONT,
        fontSize: 10,
        backgroundColor: COLORS.panel,
        border: `2px solid ${COLORS.panelBorder}`,
        boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
        color: COLORS.text,
        padding: 12,
        maxWidth: 'min(92vw, 640px)',
        maxHeight: '88vh',
        overflowY: 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getAttribute('aria-hidden') !== 'true')
}

/**
 * Modal dialog shell: labelled dialog panel, initial focus inside, a focus
 * trap while open, Escape for dismissable dialogs, and focus restored to the
 * trigger on close. The background is made inert by the caller.
 */
export function ModalDialog({
  children,
  labelledBy,
  dismissable = true,
  onClose,
  style,
}: {
  children: ReactNode
  labelledBy: string
  dismissable?: boolean
  onClose?: () => void
  style?: CSSProperties
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const previous = document.activeElement
    const panel = panelRef.current
    if (panel) {
      const focusables = focusableElements(panel)
      ;(focusables[0] ?? panel).focus({ preventScroll: true })
    }
    return () => {
      if (previous instanceof HTMLElement) previous.focus({ preventScroll: true })
    }
  }, [])

  useEffect(() => {
    if (!dismissable || !onClose) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [dismissable, onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = focusableElements(panel)
      if (focusables.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <Overlay>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{
          ...PIXEL_FONT,
          fontSize: 10,
          backgroundColor: COLORS.panel,
          border: `2px solid ${COLORS.panelBorder}`,
          boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
          color: COLORS.text,
          padding: 12,
          maxWidth: 'min(92vw, 640px)',
          maxHeight: '88vh',
          overflowY: 'auto',
          ...style,
        }}
      >
        {children}
      </div>
    </Overlay>
  )
}
