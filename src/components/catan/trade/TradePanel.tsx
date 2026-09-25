'use client'

import type { JSX } from 'react'
import type { Action, GameState, PlayerId } from '@/lib/games/catan/types'
import { TradeDialog } from '../TradeDialog'

/** Wave 1 seam: the human's own offers use the existing TradeDialog until wave 2. */
export function TradePanel(props: {
  game: GameState
  human: PlayerId
  apply: (a: Action) => boolean
  onClose: () => void
}): JSX.Element {
  return (
    <TradeDialog
      state={props.game}
      human={props.human}
      onTrade={(action) => {
        if (props.apply(action)) props.onClose()
      }}
      onClose={props.onClose}
    />
  )
}
