'use client'

import type { JSX } from 'react'
import { useT } from '@/lib/i18n/client'
import type { Action, GameState, PlayerId } from '@/lib/games/catan/types'
import { fill, playerSubject } from '../event-text'
import { PixelButton } from '../ui'

/** Wave 1 seam: plain Accept / Decline while a bot offer awaits the human. */
export function IncomingOffer(props: { game: GameState; human: PlayerId; apply: (a: Action) => boolean }): JSX.Element | null {
  const t = useT()
  const d = t.catan.layout.incomingOffer
  const { game, human, apply } = props
  if (game.phase.kind !== 'trade') return null
  const { offer } = game.phase
  if (!offer.to.includes(human) || offer.replies[human] !== 'pending') return null

  const answer = (reply: 'accept' | 'decline') => {
    apply({ type: 'respondTrade', player: human, reply })
  }

  return (
    <div
      role="group"
      aria-label={d.title}
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        backgroundColor: '#3d2e1e',
        border: '2px solid #5a4430',
        boxShadow: '2px 2px 0 #1a0e04',
        maxWidth: 'calc(100% - 16px)',
      }}
    >
      <span style={{ fontFamily: 'var(--font-pixel), "Courier New", monospace', fontSize: 10, color: '#e8d5b0' }}>
        {fill(d.prompt, { player: playerSubject(game, offer.from) })}
      </span>
      <PixelButton variant="good" onClick={() => answer('accept')}>
        {d.accept}
      </PixelButton>
      <PixelButton variant="danger" onClick={() => answer('decline')}>
        {d.decline}
      </PixelButton>
    </div>
  )
}
