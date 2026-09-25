'use client'

import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusableElements(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getAttribute('aria-hidden') !== 'true')
}

/**
 * Initial focus, focus restore, Escape handling and a Tab trap for a modal-ish
 * panel (sheets, drawers and popovers) without pulling in ModalDialog's overlay.
 */
export function useModalBehavior(
  panelRef: RefObject<HTMLElement | null>,
  onClose: (() => void) | undefined,
  dismissable = true,
): void {
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
  }, [panelRef, dismissable])

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
  }, [panelRef])
}
