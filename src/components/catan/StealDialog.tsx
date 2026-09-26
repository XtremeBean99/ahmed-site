'use client'

import { useId } from 'react'
import { useT } from '@/lib/i18n/client'
import { totalCards, victoryPoints } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import { fill, playerSubject } from './event-text'
import { PixelSprite } from './PixelSprite'
import { PLAYER_HEX, PLAYER_TEXT } from './player-colors'
import { COLORS, FONT, ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

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
    <ModalDialog labelledBy={titleId} dismissable={false} style={{ width: 460 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
      <p style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text, margin: '12px 0 8px' }}>
        {fill(d.prompt, { player: playerSubject(state, thief) })}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {candidates.map((victim) => {
          const p = state.players[victim]
          const held = totalCards(p.resources)
          const shown = Math.min(held, 7)
          const extra = held - shown
          return (
            <PixelButton
              key={victim}
              onClick={() => onSteal(victim)}
              aria-label={fill(d.choose, { name: p.name })}
              style={{ width: '100%', justifyContent: 'flex-start', gap: 12, padding: '10px 12px' }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  backgroundColor: PLAYER_HEX[p.color],
                  border: `2px solid ${COLORS.panelDark}`,
                }}
              />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={{ ...PIXEL_FONT, fontSize: FONT.body, color: PLAYER_TEXT[p.color] }}>{p.name}</span>
                <Muted>{fill(d.vp, { vp: victoryPoints(state, victim, false) })}</Muted>
              </span>
              <span aria-hidden="true" style={{ display: 'flex', alignItems: 'center' }}>
                {Array.from({ length: shown }, (_, i) => (
                  <PixelSprite
                    key={i}
                    name="card-back-resource"
                    scale={2}
                    alt=""
                    style={{ marginLeft: i === 0 ? 0 : -30 }}
                  />
                ))}
                {extra > 0 ? (
                  <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text, marginLeft: 6 }}>+{extra}</span>
                ) : null}
              </span>
              <Muted>{held === 1 ? d.cardHeld : fill(d.cardsHeld, { count: held })}</Muted>
            </PixelButton>
          )
        })}
      </div>
    </ModalDialog>
  )
}
