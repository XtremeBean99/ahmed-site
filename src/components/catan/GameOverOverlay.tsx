'use client'

import { useId } from 'react'
import { useT } from '@/lib/i18n/client'
import { humanPlayer } from '@/lib/games/catan/engine'
import { victoryPoints } from '@/lib/games/catan/helpers'
import type { GameState } from '@/lib/games/catan/types'
import { fill } from './event-text'
import { Tooltip } from './Tooltip'
import { ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

export function GameOverOverlay({
  state,
  onNewGame,
  onRules,
}: {
  state: GameState
  onNewGame: () => void
  onRules: () => void
}) {
  const t = useT()
  const d = t.catan.gameOver
  const titleId = useId()
  const winner = state.phase.kind === 'gameOver' ? state.players[state.phase.winner] : null

  return (
    <ModalDialog labelledBy={titleId} dismissable={false} style={{ width: 420 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
      {winner ? (
        <p style={{ ...PIXEL_FONT, fontSize: 16, color: '#e0a040', margin: '12px 0' }}>
          {winner.id === humanPlayer(state) ? d.winnerYou : fill(d.winner, { player: winner.name })}
        </p>
      ) : null}
      <div style={{ fontSize: 10, color: '#e8d5b0', marginBottom: 12 }}>
        <Muted>{fill(d.turns, { turns: state.turn })}</Muted>
      </div>
      <div style={{ ...PIXEL_FONT, fontSize: 10, color: '#a09080', marginBottom: 4 }}>{d.finalVp}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {state.players.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
              }}
            />
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0', flex: 1 }}>{p.name}</span>
            <span style={{ ...PIXEL_FONT, fontSize: 12, color: '#e8d5b0' }}>
              {victoryPoints(state, p.id, true)} {t.catan.vp}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <Tooltip content={d.rules}>
          <PixelButton onClick={onRules}>{d.rules}</PixelButton>
        </Tooltip>
        <Tooltip content={d.playAgain}>
          <PixelButton variant="primary" onClick={onNewGame}>
            {d.playAgain}
          </PixelButton>
        </Tooltip>
      </div>
    </ModalDialog>
  )
}
