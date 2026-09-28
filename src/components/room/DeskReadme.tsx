'use client'

import { ScreenStrip, useDeskScreen } from './ScreenStrip'

interface ReadmeLabels {
  title: string
  close: string
}

interface DeskReadmeProps {
  time: string
  content: string
  labels: ReadmeLabels
  desktopLabel: string
  backLabel: string
  onDesktop: () => void
  onBack: (e: React.MouseEvent) => void
}

export function DeskReadme({ time, content, labels, desktopLabel, backLabel, onDesktop, onBack }: DeskReadmeProps) {
  const { portrait } = useDeskScreen()
  return (
    <div className="absolute inset-0 flex flex-col" style={{ backgroundColor: '#faf8f5' }}>
      <ScreenStrip time={time} title={labels.title} desktopLabel={desktopLabel} onDesktop={onDesktop} backLabel={backLabel} onBack={onBack} />

      {/* Notepad body */}
      <div
        className={`flex-1 overflow-y-auto mx-2 my-2 ${portrait ? '' : 'p-3'}`}
        style={{
          backgroundColor: '#fffef5',
          border: '1px solid #d8d0c0',
          fontFamily: "'Courier New', 'Consolas', monospace",
          fontSize: portrait ? 12 : 10,
          lineHeight: '1.6',
          color: '#2a2520',
          whiteSpace: 'pre-wrap',
          padding: portrait ? 10 : undefined,
        }}
      >
        {content}
      </div>
    </div>
  )
}
