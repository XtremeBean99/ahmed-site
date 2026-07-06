'use client'

import Link from 'next/link'
import { useState, useCallback } from 'react'

interface RoomHudProps {
  enterLabel: string
  hintLabel: string
  skipLabel: string
}

export function RoomHud({ enterLabel, hintLabel, skipLabel }: RoomHudProps) {
  const [showHint, setShowHint] = useState(true)

  const dismissHint = useCallback(() => {
    setShowHint(false)
  }, [])

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

      {/* Bottom-right HUD */}
      <div
        className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-1 text-[11px]"
        style={{
          fontFamily: 'var(--font-pixel), "Courier New", monospace',
          textShadow: '0 1px 2px rgba(0,0,0,0.8)',
        }}
      >
        {showHint && (
          <span className="text-[#a09080] animate-fade-in opacity-60">
            {hintLabel}
          </span>
        )}
        <Link
          href="/home"
          className="text-[#c8b89a] hover:text-[#e0d0b0] transition-colors"
          onClick={dismissHint}
        >
          {enterLabel} →
        </Link>
      </div>
    </>
  )
}
