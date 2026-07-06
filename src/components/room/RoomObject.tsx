'use client'

import { type ReactNode, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import { DURATION } from '@/lib/motion'

interface RoomObjectProps {
  children: ReactNode
  label: string
  /** Whether this is currently in a focused/hovered state (for tooltip display) */
  active: boolean
  /** Called on pointer enter / focus */
  onActivate: () => void
  /** Called on pointer leave / blur */
  onDeactivate: () => void
  /** Click handler (for buttons) */
  onClick?: () => void
  /** If provided, renders as an anchor with this href */
  href?: string
  /** Tab index */
  tabIndex?: number
  /** CSS class for positioning */
  className?: string
  /** Inline styles */
  style?: React.CSSProperties
}

export function RoomObject({
  children,
  label,
  active,
  onActivate,
  onDeactivate,
  onClick,
  href,
  tabIndex = 0,
  className = '',
  style,
}: RoomObjectProps) {
  const reduce = useReducedMotion()
  const [tooltipReady, setTooltipReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleActivate = useCallback(() => {
    onActivate()
    timerRef.current = setTimeout(() => setTooltipReady(true), 150)
  }, [onActivate])

  const handleDeactivate = useCallback(() => {
    onDeactivate()
    if (timerRef.current) clearTimeout(timerRef.current)
    setTooltipReady(false)
  }, [onDeactivate])

  const sharedClass = `block cursor-pointer outline-none ${className}`

  const sharedHandlers = {
    onMouseEnter: handleActivate,
    onMouseLeave: handleDeactivate,
    onFocus: handleActivate,
    onBlur: handleDeactivate,
  }

  return (
    <div className="relative" style={style}>
      {href ? (
        <a
          href={href}
          className={sharedClass}
          aria-label={label}
          tabIndex={tabIndex}
          {...sharedHandlers}
        >
          {children}
        </a>
      ) : (
        <button
          className={sharedClass}
          aria-label={label}
          tabIndex={tabIndex}
          onClick={onClick}
          {...sharedHandlers}
        >
          {children}
        </button>
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {active && tooltipReady && (
          <motion.div
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            transition={{ duration: reduce ? 0 : DURATION.fast }}
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-20"
            style={{ bottom: 'calc(100% + 8px)' }}
          >
            <span className="block whitespace-nowrap px-2 py-1 text-[11px] font-sans bg-[#1a1512] border border-[#3a3228] text-[#c8b89a] rounded-sm leading-none">
              {label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus ring */}
      {active && (
        <div
          aria-hidden
          className="absolute pointer-events-none z-10"
          style={{
            inset: '-2px',
            outline: '2px solid rgba(200, 184, 154, 0.7)',
            outlineOffset: '1px',
            borderRadius: '1px',
          }}
        />
      )}
    </div>
  )
}
