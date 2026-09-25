// src/components/room/DeskBreakout.tsx
'use client'

import { ArcadeFrame, ArcadeStrip, useFullscreen, ARCADE, type DeskGameProps } from './DeskArcade'

export interface BreakoutLabels {
  field: string
}

export function DeskBreakout({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<BreakoutLabels>) {
  const fs = useFullscreen()
  return (
    <ArcadeFrame fs={fs}>
      <ArcadeStrip time={time} fs={fs} arcade={arcade} desktopLabel={desktopLabel} backLabel={backLabel} onDesktop={onDesktop} onBack={onBack} />
      <div role="img" aria-label={labels.field} className="relative flex-1" style={{ backgroundColor: ARCADE.crt }} />
    </ArcadeFrame>
  )
}
