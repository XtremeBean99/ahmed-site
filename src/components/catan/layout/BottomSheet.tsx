'use client'

import { useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'
import { COLORS, PIXEL_FONT, PixelButton } from '../ui'
import { useModalBehavior } from './use-modal-behavior'

const DRAG_CLOSE_PX = 100

export function BottomSheet({
  labelledBy,
  onClose,
  children,
  style,
}: {
  labelledBy: string
  onClose: () => void
  children: ReactNode
  style?: CSSProperties
}) {
  const t = useT()
  const l = t.catan.layout
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startY = useRef(0)

  useModalBehavior(sheetRef, onClose)

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    startY.current = event.clientY
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragY(Math.max(0, event.clientY - startY.current))
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return
    setDragging(false)
    setDragY(0)
    if (event.clientY - startY.current > DRAG_CLOSE_PX) onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'flex-end',
        backgroundColor: 'rgba(26, 14, 4, 0.6)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} aria-hidden />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{
          ...PIXEL_FONT,
          fontSize: 12,
          position: 'relative',
          width: '100%',
          maxHeight: '75dvh',
          overflowY: 'auto',
          backgroundColor: COLORS.panel,
          borderTop: `2px solid ${COLORS.panelBorder}`,
          boxShadow: `0 -4px 0 ${COLORS.panelDark}`,
          color: COLORS.text,
          padding: '8px 10px max(10px, env(safe-area-inset-bottom))',
          transform: dragging ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : 'transform 120ms linear',
          ...style,
        }}
      >
        <div
          aria-hidden
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            setDragging(false)
            setDragY(0)
          }}
          style={{
            height: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <span
            style={{
              width: 44,
              height: 4,
              backgroundColor: COLORS.panelBorder,
              display: 'inline-block',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6 }}>
          <PixelButton onClick={onClose} aria-label={l.closeSheet}>
            {t.catan.close}
          </PixelButton>
        </div>
        {children}
      </div>
    </div>
  )
}
