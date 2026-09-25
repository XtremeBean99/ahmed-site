// src/components/room/DeskPong.tsx
'use client'

import { ArcadeFrame, ArcadeStrip, useFullscreen, ARCADE, type DeskGameProps } from './DeskArcade'

export interface PongLabels {
  court: string
}

export function DeskPong({ time, backLabel, desktopLabel, labels, arcade, onBack, onDesktop }: DeskGameProps<PongLabels>) {
  const fs = useFullscreen()
  return (
    <ArcadeFrame fs={fs}>
      <ArcadeStrip time={time} fs={fs} arcade={arcade} desktopLabel={desktopLabel} backLabel={backLabel} onDesktop={onDesktop} onBack={onBack} />
      <div role="img" aria-label={labels.court} className="relative flex-1" style={{ backgroundColor: ARCADE.crt }} />
    </ArcadeFrame>
  )
}
