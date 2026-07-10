'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getDiscoveries, DISCOVERY_IDS } from '@/lib/room/discoveries'

interface DiscoveriesBadgeProps {
  title: string
  discoveryLabels: Record<string, string>
}

export function DiscoveriesBadge({ title, discoveryLabels }: DiscoveriesBadgeProps) {
  const [discoveries, setDiscoveries] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const found = discoveries.size
  const total = DISCOVERY_IDS.length

  useEffect(() => {
    setDiscoveries(getDiscoveries())
    const onDiscovery = () => setDiscoveries(getDiscoveries())
    window.addEventListener('room:discovery', onDiscovery)
    return () => window.removeEventListener('room:discovery', onDiscovery)
  }, [])

  return (
    <div className="fixed bottom-14 right-4 z-30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={`${title}: ${found} of ${total}`}
        className="border-2 px-3 py-1.5 text-xs"
        style={{
          fontFamily: 'var(--font-pixel), "Courier New", monospace',
          backgroundColor: '#3d2e1e',
          borderColor: '#5a4430',
          borderRadius: '3px',
          color: '#e8d5b0',
        }}
      >
        {'\u2726'} {found}/{total}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute bottom-full right-0 mb-2 px-4 py-3 min-w-[180px]"
            style={{
              backgroundColor: '#3d2e1e',
              borderColor: '#5a4430',
              borderRadius: '3px',
              color: '#e8d5b0',
              borderWidth: '2px',
              borderStyle: 'solid',
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
          >
            <p
              className="text-center mb-2"
              style={{
                fontFamily: 'var(--font-pixel), "Courier New", monospace',
                fontSize: '12px',
                color: '#c8b89a',
              }}
            >
              {title}
            </p>
            {DISCOVERY_IDS.map((id) => (
              <div
                key={id}
                className="flex items-center gap-2 py-0.5"
                style={{
                  fontFamily: 'var(--font-pixel), "Courier New", monospace',
                  fontSize: '10px',
                }}
              >
                <span>{discoveries.has(id) ? '\u2726' : '\u25CB'}</span>
                <span>{discoveryLabels[id] ?? id}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
