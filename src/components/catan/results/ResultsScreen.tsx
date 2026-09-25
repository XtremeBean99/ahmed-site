'use client'

import { useId } from 'react'
import type { JSX } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { humanPlayer } from '@/lib/games/catan/engine'
import { victoryPoints } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import { fill } from '../event-text'
import { PLAYER_HEX, PLAYER_TEXT } from '../player-colors'
import { ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from '../ui'

/**
 * Wave 1 seam: a results screen over the existing game-over data. It uses the
 * three contract callbacks directly instead of GameOverOverlay, whose props
 * (onRules) do not exist in this contract.
 */
export function ResultsScreen(props: {
  game: GameState
  human: PlayerId
  onRematch: () => void
  onNewGame: () => void
  onBackToRoom: () => void
}): JSX.Element {
  const t = useT()
  const d = t.catan.gameOver
  const l = t.catan.layout
  const titleId = useId()
  const { game, human } = props
  const winner = game.phase.kind === 'gameOver' ? game.players[game.phase.winner] : null

  return (
    <ModalDialog labelledBy={titleId} dismissable={false} style={{ width: 420 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
      {winner ? (
        <p style={{ ...PIXEL_FONT, fontSize: 16, color: '#e0a040', margin: '12px 0' }}>
          {winner.id === humanPlayer(game) ? d.winnerYou : fill(d.winner, { player: winner.name })}
        </p>
      ) : null}
      <Muted>{fill(d.turns, { turns: game.turn })}</Muted>
      <div style={{ ...PIXEL_FONT, fontSize: 10, color: '#a09080', margin: '8px 0 4px' }}>{d.finalVp}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {game.players.map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                backgroundColor: PLAYER_HEX[p.color],
                border: '1px solid #1a1410',
                display: 'inline-block',
              }}
            />
            <span style={{ ...PIXEL_FONT, fontSize: 10, color: p.id === human ? PLAYER_TEXT[p.color] : '#e8d5b0', flex: 1 }}>
              {p.name}
            </span>
            <span style={{ ...PIXEL_FONT, fontSize: 12, color: '#e8d5b0' }}>
              {victoryPoints(game, p.id, true)} {t.catan.vp}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
        <Link
          href="/"
          style={{
            ...PIXEL_FONT,
            fontSize: 10,
            padding: '8px 10px',
            backgroundColor: '#3d2e1e',
            border: '2px solid #5a4430',
            color: '#e8d5b0',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          {l.backToRoom}
        </Link>
        <PixelButton onClick={props.onNewGame}>{t.catan.newGame}</PixelButton>
        <PixelButton variant="primary" onClick={props.onRematch}>
          {l.rematch}
        </PixelButton>
      </div>
    </ModalDialog>
  )
}
