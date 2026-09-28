'use client'

import Link from 'next/link'
import { useState, useCallback, useEffect } from 'react'

interface RoomHudProps {
  hintLabel: string
  touchHintLabel: string
  skipLabel: string
  mobile: boolean
  /** True once the visitor has dragged the room on a phone. */
  dismissed: boolean
}

export function RoomHud({ hintLabel, touchHintLabel, skipLabel, mobile, dismissed }: RoomHudProps) {
  const [showHint, setShowHint] = useState(true)
  const [touchHintVisible, setTouchHintVisible] = useState(!dismissed)

  const dismissHint = useCallback(() => {
    setShowHint(false)
    setTouchHintVisible(false)
  }, [])

  // The phone hint fades out on its own after about six seconds, or as soon
  // as the visitor drags the room.
  useEffect(() => {
    if (!mobile) return
    if (dismissed) {
      setTouchHintVisible(false)
      return
    }
    const id = setTimeout(() => setTouchHintVisible(false), 6000)
    return () => clearTimeout(id)
  }, [mobile, dismissed])

  return (
    <>
      {/* Skip link: visually hidden, first in tab order */}
      <Link
        href="/home"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#1a1512] focus:text-[#c8b89a] focus:border focus:border-[#3a3228] focus:rounded-sm focus:text-sm"
        style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace' }}
        onClick={dismissHint}
      >
        {skipLabel}
      </Link>

      {mobile ? (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-20 pointer-events-none whitespace-nowrap text-[11px]"
          style={{
            fontFamily: 'var(--font-pixel), "Courier New", monospace',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            color: '#e8d5b0',
            top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            opacity: touchHintVisible ? 1 : 0,
            transition: 'opacity 0.6s ease',
          }}
        >
          {touchHintLabel}
        </div>
      ) : (
        <div
          className="absolute right-4 z-20 flex flex-col items-end gap-1 text-[11px]"
          style={{
            fontFamily: 'var(--font-pixel), "Courier New", monospace',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {showHint && (
            <span className="text-[#a09080] animate-fade-in">
              {hintLabel}
            </span>
          )}
        </div>
      )}
    </>
  )
}
