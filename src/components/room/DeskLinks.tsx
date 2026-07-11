'use client'

import { ScreenStrip, StripButton } from './ScreenStrip'
import { LINKS } from '@/lib/room/links'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

interface DeskLinksProps { labels: { title: string; close: string }; desktopLabel: string; onDesktop: () => void }

export function DeskLinks({ labels, desktopLabel, onDesktop }: DeskLinksProps) {
  const buttons = LINKS.filter((l) => l.button)
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={labels.title}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>{desktopLabel}</StripButton>
      </ScreenStrip>
      <div className="flex-1 overflow-y-auto p-3 mx-2 my-2" style={{ backgroundColor: '#fffef5', border: '1px solid #d8d0c0' }}>
        {buttons.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {buttons.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" title={l.label}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.button} alt={l.label} width={88} height={31} style={{ imageRendering: 'pixelated' }} />
              </a>
            ))}
          </div>
        )}
        <ul style={{ ...PIXEL, fontSize: 10, lineHeight: 1.8, color: '#2a2520', listStyle: 'none', margin: 0, padding: 0 }}>
          {LINKS.map((l) => (
            <li key={l.url}>★ <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3d2e1e', textDecoration: 'underline' }}>{l.label}</a></li>
          ))}
        </ul>
      </div>
    </div>
  )
}
