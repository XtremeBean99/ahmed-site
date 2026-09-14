'use client'

import { useId } from 'react'
import { useT } from '@/lib/i18n/client'
import { totalCards } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import { fill, playerSubject } from './event-text'
import { Tooltip } from './Tooltip'
import { ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

export function StealDialog({
  state,
  onSteal,
}: {
  state: GameState
  onSteal: (victim: PlayerId) => void
}) {
  const t = useT()
  const d = t.catan.steal
  const titleId = useId()
  const candidates = state.phase.kind === 'steal' ? state.phase.candidates : []
  const thief = state.current

  return (
    <ModalDialog labelledBy={titleId} dismissable={false} style={{ width: 380 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
      <p style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0', margin: '12px 0 8px' }}>
        {fill(d.prompt, { player: playerSubject(state, thief) })}
      </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {candidates.map((victim) => {
            const p = state.players[victim]
            return (
              <Tooltip key={victim} content={fill(d.choose, { name: p.name })}>
                <PixelButton onClick={() => onSteal(victim)} style={{ justifyContent: 'flex-start' }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    backgroundColor: {
                      red: '#c0392b',
                      blue: '#2e6fb7',
                      white: '#e8e0d0',
                      orange: '#e07b2a',
                    }[p.color],
                    border: '1px solid #1a1410',
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0', flex: 1, textAlign: 'left' }}>
                  {fill(d.choose, { name: p.name })}
                </span>
                <Muted>
                  {totalCards(p.resources)} {totalCards(p.resources) === 1 ? t.catan.card : t.catan.cards}
                </Muted>
              </PixelButton>
              </Tooltip>
            )
          })}
        </div>
    </ModalDialog>
  )
}
