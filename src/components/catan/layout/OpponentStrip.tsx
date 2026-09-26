'use client'

import { useId, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { playersToAct } from '@/lib/games/catan/engine'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import { playerSubject } from '../event-text'
import { COLORS, PIXEL_FONT, PixelButton } from '../ui'
import { OpponentCard, OpponentChip } from './OpponentCard'
import { PopoverFrame } from './PopoverFrame'

export function OpponentStrip({
  state,
  human,
  height,
  paused,
}: {
  state: GameState
  human: PlayerId
  height: number
  paused: boolean
}) {
  const t = useT()
  const titleId = useId()
  const [openId, setOpenId] = useState<PlayerId | null>(null)
  const actors = playersToAct(state)
  const opponents = state.players.filter((p) => p.id !== human)

  const tradeReplyFor = (p: PlayerId): string | null => {
    if (state.phase.kind !== 'trade') return null
    const { offer } = state.phase
    if (!offer.to.includes(p)) return null
    const reply = offer.replies[p]
    if (reply === 'accept') return t.catan.layout.replyAccepts
    if (reply === 'decline') return t.catan.layout.replyDeclines
    if (reply === 'counter') return t.catan.layout.replyCounter
    return t.catan.layout.replyPending
  }

  return (
    <div
      data-tutorial="players"
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        backgroundColor: COLORS.bg,
        borderBottom: `2px solid ${COLORS.panelBorder}`,
        overflowX: 'auto',
        overflowY: 'hidden',
        flexShrink: 0,
      }}
    >
      {opponents.map((p) => {
        const isActing = actors.includes(p.id)
        return (
          // Chips fill the strip's height: 44 px on phones.
          <OpponentChip
            key={p.id}
            state={state}
            player={p}
            isActing={isActing}
            minHeight={height - 8}
            onOpen={() => setOpenId(p.id)}
          />
        )
      })}
      {openId !== null ? (
        <PopoverFrame labelledBy={titleId} onClose={() => setOpenId(null)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
            <span id={titleId} style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text }}>
              {playerSubject(state, openId)}
            </span>
            <PixelButton onClick={() => setOpenId(null)}>{t.catan.close}</PixelButton>
          </div>
          <OpponentCard
            state={state}
            player={state.players[openId]}
            isActing={playersToAct(state).includes(openId)}
            isThinking={state.players[openId].isBot && !paused && playersToAct(state).includes(openId)}
            tradeReply={tradeReplyFor(openId)}
          />
        </PopoverFrame>
      ) : null}
    </div>
  )
}
