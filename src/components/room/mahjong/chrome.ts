// src/components/room/mahjong/chrome.ts
import type { ReactNode } from 'react'
import type { ArcadeLabels, Fullscreen } from '../DeskArcade'

/** What DeskMahjong hands each mode so it can draw the shared desk strip itself. */
export interface MahjongChrome {
  time: string
  backLabel: string
  desktopLabel: string
  arcade: ArcadeLabels
  fs: Fullscreen
  onBack: (e: React.MouseEvent) => void
  onDesktop: () => void
  /** The How to play button for the mode on screen. */
  help: ReactNode
  /** The tutorial is open: clocks and bots wait, and the mode's own keys stand down. */
  helpOpen: boolean
}

/** The felt the tables sit on. */
export const TABLE_BG = '#27402c'
export const MUTED = '#b8c8a8'
