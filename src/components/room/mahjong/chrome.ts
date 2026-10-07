// src/components/room/mahjong/chrome.ts
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
}

/** The felt the tables sit on. */
export const TABLE_BG = '#27402c'
export const MUTED = '#b8c8a8'
