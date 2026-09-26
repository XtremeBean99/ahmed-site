'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useT } from '@/lib/i18n/client'
import type { GameState } from '@/lib/games/catan/types'
import { Dice } from './Dice'
import { DiceHistoryPanel } from './DiceHistoryPanel'
import { diceOddsText } from './dice-odds'
import { playerSubject } from './event-text'
import { PLAYER_TEXT } from './player-colors'
import { Tooltip } from './Tooltip'
import { COLORS, Muted, PIXEL_FONT, Panel, PixelButton, SectionTitle } from './ui'

interface RollInfo {
  seq: number
  player: number
  dice: [number, number]
}

function lastRoll(state: GameState): RollInfo | null {
  for (let i = state.events.length - 1; i >= 0; i--) {
    const e = state.events[i]
    if (e.type === 'roll') return { seq: e.seq, player: e.player, dice: e.dice }
  }
  return null
}

export function DiceViewer({
  state,
  inPreRoll,
  humanActing,
  canRoll,
  onRoll,
}: {
  state: GameState
  inPreRoll: boolean
  humanActing: boolean
  canRoll: boolean
  onRoll: () => void
}) {
  const t = useT()
  const d = t.catan.diceViewer
  const reduce = useReducedMotion()
  const roll = lastRoll(state)
  const rollSeq = roll?.seq ?? 0
  const total = roll ? roll.dice[0] + roll.dice[1] : null
  const [display, setDisplay] = useState<[number, number] | null>(roll?.dice ?? null)

  useEffect(() => {
    if (rollSeq === 0) {
      setDisplay(null)
      return
    }
    if (reduce) {
      setDisplay(roll?.dice ?? null)
      return
    }
    let frame = 0
    const id = setInterval(() => {
      frame += 1
      if (frame >= 5) {
        setDisplay(roll?.dice ?? null)
        clearInterval(id)
      } else {
        setDisplay([((frame * 2) % 6) + 1, ((frame * 3) % 6) + 1])
      }
    }, 100)
    return () => clearInterval(id)
  }, [rollSeq, reduce, roll?.dice])

  return (
    <Panel data-tutorial="dice" style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <SectionTitle>{d.title}</SectionTitle>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <Tooltip content={total !== null ? diceOddsText(total) : d.noRoll}>
          <span data-catan-anchor="dice" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Dice dice={display} label={d.title} scale={3} />
            <span style={{ ...PIXEL_FONT, fontSize: 24, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>{total ?? '?'}</span>
          </span>
        </Tooltip>
        {inPreRoll && humanActing ? (
          <Tooltip content={t.catan.tooltips.roll}>
            <PixelButton data-tutorial="roll" variant="primary" size="lg" disabled={!canRoll} onClick={onRoll} style={{ marginLeft: 'auto' }}>
              {t.catan.actionBar.roll}
            </PixelButton>
          </Tooltip>
        ) : null}
      </div>
      {roll ? (
        <span
          style={{
            ...PIXEL_FONT,
            fontSize: 10,
            color: PLAYER_TEXT[state.players[roll.player].color],
            display: 'block',
            marginTop: 2,
          }}
        >
          {playerSubject(state, roll.player)}
        </span>
      ) : (
        <Muted>{d.noRoll}</Muted>
      )}
      {roll && total === 7 ? (
        <span style={{ ...PIXEL_FONT, fontSize: 12, color: COLORS.dangerText, display: 'block', marginTop: 2 }}>{d.robber}</span>
      ) : null}
      <DiceHistoryPanel state={state} />
    </Panel>
  )
}
