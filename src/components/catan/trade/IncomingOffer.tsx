'use client'

import { useEffect, useId, useRef } from 'react'
import type { JSX, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import { emptyResources } from '@/lib/games/catan/helpers'
import type { Action, GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'
import { fill, playerSubject } from '../event-text'
import { PLAYER_HEX, PLAYER_TEXT } from '../player-colors'
import { CostIcons } from '../ResourceIcon'
import { COLORS, FONT, Muted, PIXEL_FONT, PixelButton } from '../ui'
import { offerFromMySide } from './trade-logic'

function missingCounts(hand: ResourceCounts, cost: ResourceCounts): ResourceCounts {
  const missing = emptyResources()
  for (const r of RESOURCES) missing[r] = Math.max(0, cost[r] - hand[r])
  return missing
}

function missingText(missing: ResourceCounts, names: Record<Resource, string>): string {
  return RESOURCES.filter((r) => missing[r] > 0)
    .map((r) => `${missing[r]} ${names[r]}`)
    .join(', ')
}

export function IncomingOffer(props: { game: GameState; human: PlayerId; apply: (a: Action) => boolean }): JSX.Element | null {
  const t = useT()
  const d = t.catan.trade.incomingOffer
  const { game, human, apply } = props
  const acceptRef = useRef<HTMLButtonElement | null>(null)
  const declineRef = useRef<HTMLButtonElement | null>(null)
  const wasActive = useRef(false)
  const termsId = useId()

  const offer = game.phase.kind === 'trade' ? game.phase.offer : null
  const active = offer !== null && offer.to.includes(human) && offer.replies[human] === 'pending'
  const hand = game.players[human].resources
  const missing = active && offer !== null ? missingCounts(hand, offer.get) : emptyResources()
  const acceptDisabled = RESOURCES.some((r) => missing[r] > 0)

  useEffect(() => {
    if (active && !wasActive.current) {
      if (acceptDisabled) declineRef.current?.focus({ preventScroll: true })
      else acceptRef.current?.focus({ preventScroll: true })
    }
    wasActive.current = active
  }, [active, acceptDisabled])

  if (!active || offer === null) return null

  const accept = () => {
    apply({ type: 'respondTrade', player: human, reply: 'accept' })
  }
  const decline = () => {
    apply({ type: 'respondTrade', player: human, reply: 'decline' })
  }
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    decline()
  }

  const proposer = game.players[offer.from]
  const mine = offerFromMySide(offer, human)

  return (
    <div
      role="alertdialog"
      aria-label={d.title}
      aria-describedby={termsId}
      onKeyDown={onKeyDown}
      style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
        width: 'min(420px, calc(100% - 16px))',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 12px',
        backgroundColor: COLORS.panel,
        border: `2px solid ${COLORS.panelBorder}`,
        boxShadow: '2px 2px 0 #1a0e04',
      }}
    >
      <div id={termsId} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              flexShrink: 0,
              backgroundColor: PLAYER_HEX[proposer.color],
              border: `2px solid ${COLORS.panelDark}`,
            }}
          />
          <span style={{ ...PIXEL_FONT, fontSize: FONT.body, color: PLAYER_TEXT[proposer.color] }}>
            {playerSubject(game, offer.from)}
          </span>
          <span style={{ ...PIXEL_FONT, fontSize: FONT.body, color: COLORS.text }}>{d.offersYou}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{d.youGet}</span>
          <CostIcons cost={mine.give} size={16} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{d.youGive}</span>
          <CostIcons cost={mine.get} size={16} />
        </div>
        {acceptDisabled ? (
          <Muted>{fill(d.cannotAccept, { resources: missingText(missing, t.catan.resources) })}</Muted>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <PixelButton ref={acceptRef} variant="good" disabled={acceptDisabled} onClick={accept}>
          {d.accept}
        </PixelButton>
        <PixelButton ref={declineRef} variant="danger" onClick={decline}>
          {d.decline}
        </PixelButton>
      </div>
    </div>
  )
}
