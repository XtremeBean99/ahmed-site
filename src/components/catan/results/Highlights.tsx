'use client'

import { useT } from '@/lib/i18n/client'
import type { JSX } from 'react'
import type { GameState } from '@/lib/games/catan/types'
import { fill, playerSubject } from '../event-text'
import type { Highlight } from './results-data'
import { COLORS, Muted, PIXEL_FONT } from '../ui'

export function Highlights({ items, game }: { items: Highlight[]; game: GameState }): JSX.Element {
  const t = useT()
  const d = t.catan.gameOver

  const text = (item: Highlight): string => {
    switch (item.kind) {
      case 'mostRobbed':
        return fill(d.highlightMostRobbed, { player: playerSubject(game, item.player), count: item.count })
      case 'bestProducer':
        return fill(d.highlightBestProducer, { player: playerSubject(game, item.player), count: item.count })
      case 'trades':
        return fill(d.highlightTrades, { players: item.playerTrades, bank: item.bankTrades })
      case 'luckiest':
        return fill(d.highlightLuckiest, { total: item.total, actual: item.actual, expected: item.expected.toFixed(1) })
      case 'unluckiest':
        return fill(d.highlightUnluckiest, { total: item.total, actual: item.actual, expected: item.expected.toFixed(1) })
    }
  }

  if (items.length === 0) return <Muted>{d.noHighlights}</Muted>

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, index) => (
        <li key={index} style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, lineHeight: 1.4 }}>
          {text(item)}
        </li>
      ))}
    </ul>
  )
}
