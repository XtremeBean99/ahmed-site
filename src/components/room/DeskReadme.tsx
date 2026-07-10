'use client'

import { ScreenStrip, StripButton } from './ScreenStrip'

const PIXEL = { fontFamily: 'var(--font-pixel), "Courier New", monospace' } as const

interface ReadmeLabels {
  title: string
  close: string
}

interface DeskReadmeProps {
  content: string
  labels: ReadmeLabels
  desktopLabel: string
  onDesktop: () => void
}

export function DeskReadme({ content, labels, desktopLabel, onDesktop }: DeskReadmeProps) {
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={labels.title}>
        <StripButton onClick={onDesktop} ariaLabel={desktopLabel}>
          {desktopLabel}
        </StripButton>
      </ScreenStrip>

      {/* Notepad body */}
      <div
        className="flex-1 overflow-y-auto p-3 mx-2 my-2"
        style={{
          backgroundColor: '#fffef5',
          border: '1px solid #d8d0c0',
          fontFamily: "'Courier New', 'Consolas', monospace",
          fontSize: '10px',
          lineHeight: '1.6',
          color: '#2a2520',
          whiteSpace: 'pre-wrap',
        }}
      >
        {content}
      </div>

      {/* Footer with close */}
      <div className="flex items-center justify-end px-3 h-7 border-t flex-shrink-0"
        style={{ backgroundColor: '#e8e0d8', borderColor: '#c8b8a8' }}>
        <button
          type="button"
          onClick={onDesktop}
          className="px-3 py-[2px] text-[10px]"
          style={{
            ...PIXEL,
            backgroundColor: '#e8e0d8',
            color: '#3a3028',
            border: '1px solid #c8b8a8',
          }}
        >
          {labels.close}
        </button>
      </div>
    </div>
  )
}
