'use client'

import { type ReactNode, useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import { DURATION } from '@/lib/motion'

interface RoomObjectProps {
  children: ReactNode
  label: string
  /** Whether to show the tooltip (controlled by parent hover/focus state) */
  showTooltip: boolean
  /** Called on pointer enter / focus */
  onActivate: () => void
  /** Called on pointer leave / blur */
  onDeactivate: () => void
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void
  /** Always renders as an anchor with this href */
  href?: string
  tabIndex?: number
  style?: React.CSSProperties
  /**
   * Horizontal alignment of the tooltip bubble relative to the object.
   * Use 'right' for objects near the stage's right edge (e.g. bonsai) so the
   * bubble stays inside the stage instead of overflowing the viewport.
   */
  tooltipAlign?: 'center' | 'right'
}

export function RoomObject({
  children,
  label,
  showTooltip,
  onActivate,
  onDeactivate,
  onClick,
  href,
  tabIndex = 0,
  style,
  tooltipAlign = 'center',
}: RoomObjectProps) {
  const reduce = useReducedMotion()
  const [tooltipReady, setTooltipReady] = useState(false)
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pointerTypeRef = useRef('mouse')

  const clearTimers = useCallback(() => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
  }, [])

  const handleActivate = useCallback(() => {
    onActivate()
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    tooltipTimerRef.current = setTimeout(() => setTooltipReady(true), 150)
  }, [onActivate])

  const handleDeactivate = useCallback(() => {
    onDeactivate()
    clearTimers()
    setTooltipReady(false)
  }, [onDeactivate, clearTimers])

  // Hover must come from a mouse only: a touch tap runs the same highlight and
  // tooltip through the click handler below, so iOS never needs a second tap.
  const handlePointerEnter = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
      handleActivate()
    },
    [handleActivate],
  )

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      handleDeactivate()
    },
    [handleDeactivate],
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // e.detail === 0 for keyboard clicks; those already have focus/tooltip.
      if (pointerTypeRef.current !== 'mouse' && e.detail > 0) {
        handleActivate()
        if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
        tapTimerRef.current = setTimeout(() => handleDeactivate(), 1600)
      }
      onClick?.(e)
    },
    [onClick, handleActivate, handleDeactivate],
  )

  // Clear the tooltip and tap timers on unmount
  useEffect(() => () => clearTimers(), [clearTimers])

  const sharedHandlers = {
    onPointerEnter: handlePointerEnter,
    onPointerLeave: handlePointerLeave,
    onPointerDown: (e: React.PointerEvent) => {
      pointerTypeRef.current = e.pointerType
    },
    onFocus: handleActivate,
    onBlur: handleDeactivate,
  }

  // focus-visible ring: shown only on keyboard focus, not mouse hover
  const focusClass =
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(200,184,154,0.7)] focus-visible:outline-offset-2 focus-visible:outline'

  return (
    <div className="relative" style={style}>
      {href ? (
        <a
          href={href}
          className={`block cursor-pointer ${focusClass}`}
          aria-label={label}
          tabIndex={tabIndex}
          onClick={handleClick}
          {...sharedHandlers}
        >
          {children}
        </a>
      ) : (
        <button
          className={`block cursor-pointer ${focusClass}`}
          aria-label={label}
          tabIndex={tabIndex}
          onClick={handleClick}
          {...sharedHandlers}
        >
          {children}
        </button>
      )}

      {/* Speech bubble tooltip */}
      <AnimatePresence>
        {showTooltip && tooltipReady && (
          <motion.div
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            transition={{ duration: reduce ? 0 : DURATION.fast }}
            className={`absolute pointer-events-none z-20 ${
              tooltipAlign === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
            }`}
            style={{ bottom: 'calc(100% + 12px)' }}
          >
            <div
              className="relative px-3 py-2 border-2"
              style={{
                backgroundColor: '#3d2e1e',
                borderColor: '#5a4430',
                borderRadius: '3px',
                fontFamily: 'var(--font-pixel), "Courier New", monospace',
                fontSize: '12px',
                color: '#e8d5b0',
                whiteSpace: 'nowrap',
                textShadow: '1px 1px 0 #1a0e04',
                imageRendering: 'pixelated',
                boxShadow: '0 2px 4px rgba(0,0,0,0.5), inset 0 0 8px rgba(0,0,0,0.2)',
              }}
            >
              {label}
              {/* Triangle pointer */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-7px',
                  ...(tooltipAlign === 'right'
                    ? { right: '22px' }
                    : { left: '50%', transform: 'translateX(-50%)' }),
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '7px solid #5a4430',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: '-4px',
                  ...(tooltipAlign === 'right'
                    ? { right: '24px' }
                    : { left: '50%', transform: 'translateX(-50%)' }),
                  width: 0,
                  height: 0,
                  borderLeft: '4px solid transparent',
                  borderRight: '4px solid transparent',
                  borderTop: '5px solid #3d2e1e',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
