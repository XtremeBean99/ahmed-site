// src/components/room/DeskBlackjack.tsx
'use client'

import { ArcadeFrame, ArcadeStrip, useFullscreen, FELT_STYLE, type DeskGameProps } from './DeskArcade'

export interface BlackjackLabels {
  table: string
}

export function DeskBlackjack({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<BlackjackLabels>) {
  const fs = useFullscreen()
  return (
    <ArcadeFrame fs={fs}>
      <ArcadeStrip time={time} fs={fs} arcade={arcade} desktopLabel={desktopLabel} backLabel={backLabel} onDesktop={onDesktop} onBack={onBack} />
      <div role="img" aria-label={labels.table} className="relative flex-1" style={FELT_STYLE} />
    </ArcadeFrame>
  )
}
