// src/components/room/mahjong/tip-context.ts
import { createContext, useContext } from 'react'

/** Lets every TileView inside a TileTipLayer report hovers, so the layer can show that tile's tooltip. */
export interface TileTipApi {
  enter: (code: string, el: HTMLElement) => void
  leave: (el: HTMLElement) => void
}

export const TileTipContext = createContext<TileTipApi | null>(null)

export const useTileTipApi = () => useContext(TileTipContext)
