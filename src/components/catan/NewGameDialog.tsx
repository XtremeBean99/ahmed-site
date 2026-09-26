'use client'

import { useId, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/client'
import { MAX_VP_TO_WIN, MIN_VP_TO_WIN, PLAYER_COLORS } from '@/lib/games/catan/constants'
import type { NewGameSetup } from './prefs'
import { buildNewGameSetup, initialNewGameForm, type NewGameForm } from './dialog-logic'
import { useCatanLayout } from './layout'
import { PLAYER_HEX } from './player-colors'
import { COLORS, FOCUS_CLASS, FONT, ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

export interface NewGameDialogProps {
  /** The last setup the player started, to offer again; null on a first visit. */
  initial: NewGameSetup | null
  onStart: (setup: NewGameSetup) => void
  onCancel: () => void
  canCancel: boolean
  onTutorial?: () => void
}

const BOT_LEVELS = ['easy', 'normal', 'hard'] as const
const BOARD_PRESETS = ['balanced', 'random', 'starter'] as const

export function NewGameDialog({ initial, onStart, onCancel, canCancel, onTutorial }: NewGameDialogProps) {
  const t = useT()
  const d = t.catan.newGameDialog
  const { layout, coarse } = useCatanLayout()
  const titleId = useId()
  const [form, setForm] = useState<NewGameForm>(() => initialNewGameForm(initial))
  const twoColumns = layout !== 'stack'

  const patch = (part: Partial<NewGameForm>) => setForm((prev) => ({ ...prev, ...part }))
  const valid = form.name.trim().length > 0
  const hit = coarse ? 44 : 28

  const columns: CSSProperties = twoColumns
    ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }
    : { display: 'flex', flexDirection: 'column', gap: 14 }

  return (
    <ModalDialog labelledBy={titleId} dismissable={canCancel} onClose={onCancel} style={{ width: 560 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>

      <div style={{ ...columns, marginTop: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <SectionTitle style={{ color: COLORS.accent }}>{d.you}</SectionTitle>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              <Muted>{d.name}</Muted>
              <input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value.slice(0, 16) })}
                maxLength={16}
                placeholder={d.namePlaceholder}
                className={FOCUS_CLASS}
                style={{
                  ...PIXEL_FONT,
                  fontSize: FONT.body,
                  backgroundColor: COLORS.bg,
                  border: `2px solid ${COLORS.panelBorder}`,
                  color: COLORS.text,
                  padding: '8px',
                  width: '100%',
                }}
              />
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              <Muted>{d.color}</Muted>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {PLAYER_COLORS.map((color) => {
                  const chosen = form.color === color
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-pressed={chosen}
                      onClick={() => patch({ color })}
                      className={FOCUS_CLASS}
                      style={{
                        ...PIXEL_FONT,
                        fontSize: FONT.small,
                        minHeight: hit,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 8px',
                        backgroundColor: COLORS.panel,
                        border: `2px solid ${COLORS.panelBorder}`,
                        boxShadow: chosen ? `0 0 0 2px ${COLORS.accent}` : undefined,
                        color: COLORS.text,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 18,
                          height: 18,
                          flexShrink: 0,
                          backgroundColor: PLAYER_HEX[color],
                          border: `2px solid ${COLORS.panelDark}`,
                        }}
                      />
                      {d.colors[color]}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div>
            <SectionTitle style={{ color: COLORS.accent }}>{d.opponents}</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              <Muted>{d.players}</Muted>
              <div style={{ display: 'flex', gap: 8 }}>
                {([3, 4] as const).map((n) => (
                  <PixelButton
                    key={n}
                    selected={form.playerCount === n}
                    aria-pressed={form.playerCount === n}
                    onClick={() => patch({ playerCount: n })}
                    style={{ flex: 1 }}
                  >
                    {n === 3 ? d.three : d.four}
                  </PixelButton>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              <Muted>{d.botLevel}</Muted>
              {BOT_LEVELS.map((level) => (
                <div key={level} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <PixelButton
                    selected={form.botLevel === level}
                    aria-pressed={form.botLevel === level}
                    onClick={() => patch({ botLevel: level })}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    {d.levels[level]}
                  </PixelButton>
                  <Muted>{d.levelDescs[level]}</Muted>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <SectionTitle style={{ color: COLORS.accent }}>{d.game}</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              <Muted>{d.board}</Muted>
              {BOARD_PRESETS.map((board) => (
                <div key={board} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <PixelButton
                    selected={form.board === board}
                    aria-pressed={form.board === board}
                    onClick={() => patch({ board })}
                    style={{ justifyContent: 'flex-start' }}
                  >
                    {d.boards[board]}
                  </PixelButton>
                  <Muted>{d.boardDescs[board]}</Muted>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              <Muted>{d.pointsToWin}</Muted>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PixelButton
                  aria-label={d.decrease}
                  disabled={form.vpToWin <= MIN_VP_TO_WIN}
                  onClick={() => patch({ vpToWin: form.vpToWin - 1 })}
                >
                  -
                </PixelButton>
                <span style={{ ...PIXEL_FONT, fontSize: FONT.title, color: COLORS.text, width: 64, textAlign: 'center' }}>
                  {form.vpToWin} {t.catan.vp}
                </span>
                <PixelButton
                  aria-label={d.increase}
                  disabled={form.vpToWin >= MAX_VP_TO_WIN}
                  onClick={() => patch({ vpToWin: form.vpToWin + 1 })}
                >
                  +
                </PixelButton>
              </div>
              {form.vpToWin < 10 ? <Muted>{d.shorter}</Muted> : null}
              {form.vpToWin > 10 ? <Muted>{d.longer}</Muted> : null}
            </div>
          </div>

          <div>
            <SectionTitle style={{ color: COLORS.accent }}>{d.optionsTitle}</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <PixelButton
                  aria-pressed={form.friendlyRobber}
                  onClick={() => patch({ friendlyRobber: !form.friendlyRobber })}
                  style={{ justifyContent: 'space-between', width: '100%' }}
                >
                  <span>{d.friendlyRobber}</span>
                  <span>{form.friendlyRobber ? d.on : d.off}</span>
                </PixelButton>
                <Muted>{d.friendlyRobberDesc}</Muted>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <PixelButton
                  aria-pressed={form.botTrades}
                  onClick={() => patch({ botTrades: !form.botTrades })}
                  style={{ justifyContent: 'space-between', width: '100%' }}
                >
                  <span>{d.botTrades}</span>
                  <span>{form.botTrades ? d.on : d.off}</span>
                </PixelButton>
                <Muted>{d.botTradesDesc}</Muted>
              </div>
            </div>
          </div>
        </div>
      </div>

      {canCancel ? (
        <p style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.dangerText, margin: '10px 0 0' }}>
          {d.endsCurrent}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
        <Link
          href="/"
          className={FOCUS_CLASS}
          style={{
            ...PIXEL_FONT,
            fontSize: FONT.small,
            minHeight: hit,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '6px 8px',
            backgroundColor: COLORS.panel,
            border: `2px solid ${COLORS.panelBorder}`,
            color: COLORS.text,
            textDecoration: 'none',
          }}
        >
          {t.catan.back}
        </Link>
        <div style={{ flex: 1 }} />
        {onTutorial ? <PixelButton onClick={onTutorial}>{d.learn}</PixelButton> : null}
        {canCancel ? <PixelButton onClick={onCancel}>{d.cancel}</PixelButton> : null}
        <PixelButton
          variant="primary"
          disabled={!valid}
          onClick={() => onStart(buildNewGameSetup(form))}
        >
          {d.start}
        </PixelButton>
      </div>
    </ModalDialog>
  )
}
