'use client'

import { useRef } from 'react'
import type { ReactNode } from 'react'
import { COLORS, PIXEL_FONT } from '../ui'
import { useModalBehavior } from './use-modal-behavior'

/** Centered small overlay for chip popovers; board stays visible through the dim. */
export function PopoverFrame({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useModalBehavior(panelRef, onClose)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 55,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(26, 14, 4, 0.5)',
        padding: 16,
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{
          ...PIXEL_FONT,
          fontSize: 10,
          position: 'relative',
          backgroundColor: COLORS.panel,
          border: `2px solid ${COLORS.panelBorder}`,
          boxShadow: `4px 4px 0 ${COLORS.panelDark}`,
          color: COLORS.text,
          padding: 10,
          maxWidth: 'min(92vw, 320px)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {children}
      </div>
    </div>
  )
}
