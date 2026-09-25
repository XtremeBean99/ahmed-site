'use client'

import type { JSX, MutableRefObject } from 'react'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import type { CatanSound } from '../sound'

export interface BoardView {
  toClient(p: { x: number; y: number }): { x: number; y: number }
  scale: number
}

export interface BoardOverrides {
  highlightHexes: number[]
  robberHex?: number | null
  hiddenPieces: { vertices: number[]; edges: number[] }
}

export interface EffectsLayerProps {
  game: GameState
  human: PlayerId
  boardViewRef: MutableRefObject<BoardView | null>
  animations: boolean
  sound: CatanSound
  onBoardOverrides: (o: BoardOverrides) => void
}

/** Wave 1 seam: animations land here in wave 2. */
export function EffectsLayer(props: EffectsLayerProps): JSX.Element | null {
  void props
  return null
}
