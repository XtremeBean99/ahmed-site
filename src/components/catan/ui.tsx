'use client'

import { forwardRef, useEffect, useRef } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { hitSize, useCatanLayout } from './layout'

export const PIXEL_FONT = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

/** Text colours are checked against panel and bg at WCAG AA (4.5:1) or better. */
export const COLORS = {
  bg: '#2a2220',
  panel: '#3d2e1e',
  panelRaised: '#4a3826',
  panelBorder: '#5a4430',
  panelDark: '#1a0e04',
  text: '#e8d5b0',
  muted: '#b8a890',
  accent: '#e0a040',
  accentDark: '#b87a20',
  /** Fill for destructive buttons (text on it 5.0:1); use dangerText for red text on panels. */
  danger: '#9a3424',
  dangerText: '#ec8266',
  /** Fill for accept buttons, with panelDark text. */
  good: '#a8c878',
  goodText: '#a8c878',
  sea: '#2f5d7c',
} as const

/** Pixel font sizes: the only sizes Catan uses. */
export const FONT = { small: 10, body: 12, title: 16, big: 24 } as const

export const FOCUS_CLASS =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(200,184,154,0.7)]'

export function pixelStyle(extra?: CSSProperties): CSSProperties {
  return { ...PIXEL_FONT, ...extra }
}

export interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger' | 'good' | 'ghost'
  /** sm keeps the old compact look; md and lg are for primary game actions. All grow to 44 px on touch. */
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
}

const BUTTON_SIZES = {
  sm: { fontSize: FONT.small, minHeight: 28, padding: '6px 8px' },
  md: { fontSize: FONT.body, minHeight: 34, padding: '8px 10px' },
  lg: { fontSize: FONT.title, minHeight: 44, padding: '10px 14px' },
} as const

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(function PixelButton(
  { children, variant = 'default', size = 'sm', selected = false, className = '', style, type = 'button', ...props },
  ref,
) {
  const { coarse } = useCatanLayout()
  const palette = {
    default: { bg: COLORS.panel, border: COLORS.panelBorder, color: COLORS.text },
    primary: { bg: COLORS.accent, border: COLORS.panelDark, color: COLORS.panelDark },
    danger: { bg: COLORS.danger, border: COLORS.panelDark, color: COLORS.text },
    good: { bg: COLORS.good, border: COLORS.panelDark, color: COLORS.panelDark },
    ghost: { bg: 'transparent', border: COLORS.panelBorder, color: COLORS.muted },
  }[variant]
  // A disabled call to action must not still look like one: coloured variants fall back to a muted panel.
  const coloured = variant === 'primary' || variant === 'good' || variant === 'danger'
  const look = props.disabled && coloured ? { bg: COLORS.panelDark, border: COLORS.panelBorder, color: COLORS.muted } : palette
  const sizing = BUTTON_SIZES[size]

  return (
    <button
      ref={ref}
      type={type}
      className={`${FOCUS_CLASS} ${className}`}
      style={{
        ...PIXEL_FONT,
        fontSize: sizing.fontSize,
        padding: sizing.padding,
        minHeight: Math.max(sizing.minHeight, hitSize(coarse)),
        minWidth: coarse ? hitSize(true) : undefined,
        backgroundColor: look.bg,
        color: look.color,
        border: `2px solid ${look.border}`,
        boxShadow: selected ? `0 0 0 2px ${COLORS.accent}` : undefined,
        cursor: props.disabled ? 'default' : 'pointer',
        opacity: props.disabled ? (coloured ? 0.8 : 0.45) : 1,
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
})

export function Panel({
  children,
  className = '',
  style,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  children: ReactNode
  className?: string
  style?: CSSProperties
  'data-tutorial'?: string
}) {
  return (
    <section
      {...rest}
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

/** Fixed overlay for dialogs; square pixel corners, no blur. Above sheets (60), the log drawer and popovers (55). */
export function Overlay({ children, fullScreen = false }: { children: ReactNode; fullScreen?: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(26, 14, 4, 0.72)',
        padding: fullScreen ? 0 : 16,
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
  const { layout } = useCatanLayout()
  const fullScreen = layout === 'stack'

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

  const sheet: CSSProperties = fullScreen
    ? {
        width: '100%',
        height: '100dvh',
        maxWidth: 'none',
        maxHeight: 'none',
        boxShadow: 'none',
        padding: 'max(12px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom))',
      }
    : {}
  return (
    <Overlay fullScreen={fullScreen}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{
          ...PIXEL_FONT,
          fontSize: FONT.body,
          backgroundColor: COLORS.panel,
          border: `2px solid ${COLORS.panelBorder}`,
          boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
          color: COLORS.text,
          padding: 12,
          maxWidth: 'min(92vw, 640px)',
          maxHeight: '88vh',
          overflowY: 'auto',
          ...style,
          ...sheet,
        }}
      >
        {children}
      </div>
    </Overlay>
  )
}
