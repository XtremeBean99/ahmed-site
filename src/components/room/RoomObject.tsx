'use client'

import { type ReactNode, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import { DURATION } from '@/lib/motion'

interface RoomObjectProps {
  children: ReactNode
  label: string
  /** Whether to show the tooltip (controlled by parent hover state) */
  showTooltip: boolean
  /** Called on pointer enter */
  onActivate: () => void
  /** Called on pointer leave */
  onDeactivate: () => void
  /** Click handler */
  onClick?: () => void
  /** If provided, renders as an anchor */
  href?: string
  tabIndex?: number
  style?: React.CSSProperties
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
          className="block cursor-pointer outline-none"
          aria-label={label}
          tabIndex={tabIndex}
          {...sharedHandlers}
        >
          {children}
        </a>
      ) : (
        <button
          className="block cursor-pointer outline-none"
          aria-label={label}
          tabIndex={tabIndex}
          onClick={onClick}
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
            className="absolute left-1/2 -translate-x-1/2 pointer-events-none z-20"
            style={{ bottom: 'calc(100% + 12px)' }}
          >
            {/* Speech bubble body */}
            <div
              className="relative px-3 py-2 border-2"
              style={{
                backgroundColor: '#3d2e1e',
                borderColor: '#5a4430',
                borderRadius: '3px',
                fontFamily: '"Courier New", "Lucida Console", monospace',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#e8d5b0',
                letterSpacing: '0.5px',
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
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 0,
                  height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '7px solid #5a4430',
                }}
              />
              {/* Inner triangle for border effect */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
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
