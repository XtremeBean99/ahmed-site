'use client'

import { useT } from '@/lib/i18n/client'
import { playersToAct } from '@/lib/games/catan/engine'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import { OpponentCard } from './layout/OpponentCard'
import { COLORS, PIXEL_FONT, Panel } from './ui'

/** Wide layout left column: one opponent card per bot, newest state at the top. */
export function PlayersPanel({ state, human, paused }: { state: GameState; human: PlayerId; paused: boolean }) {
  const t = useT()
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
    <Panel data-tutorial="players" style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <div style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.text, letterSpacing: 1, marginBottom: 6 }}>{t.catan.players}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {opponents.map((p) => {
          const isActing = actors.includes(p.id)
          return (
            <OpponentCard
              key={p.id}
              state={state}
              player={p}
              isActing={isActing}
              isThinking={isActing && p.isBot && !paused}
              tradeReply={tradeReplyFor(p.id)}
            />
          )
        })}
      </div>
    </Panel>
  )
}
