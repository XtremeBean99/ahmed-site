'use client'

import { useId, useState, type CSSProperties } from 'react'
import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import { totalCards } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'
import { discardAdd, discardRemove, emptySelection } from './dialog-logic'
import { fill } from './event-text'
import { PixelSprite } from './PixelSprite'
import { ResourceIcon } from './ResourceIcon'
import { COLORS, FOCUS_CLASS, FONT, ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'
import type { UiSpriteName } from './ui-sprites'

const CARD_BUTTON: CSSProperties = {
  position: 'relative',
  padding: 0,
  border: '2px solid transparent',
  backgroundColor: 'transparent',
  cursor: 'pointer',
}

export function DiscardDialog({
  state,
  human,
  onConfirm,
}: {
  state: GameState
  human: PlayerId
  onConfirm: (resources: ResourceCounts) => void
}) {
  const t = useT()
  const d = t.catan.discard
  const titleId = useId()
  const owed = state.phase.kind === 'discard' ? state.phase.discards[human] : 0
  const [selected, setSelected] = useState<ResourceCounts>(emptySelection())

  const hand = state.players[human].resources
  const selectedTotal = totalCards(selected)
  const remaining = Math.max(0, owed - selectedTotal)
  const exact = remaining === 0

  const add = (resource: Resource) => setSelected((prev) => discardAdd(prev, resource, hand, owed))
  const remove = (resource: Resource) => setSelected((prev) => discardRemove(prev, resource))

  return (
    <ModalDialog labelledBy={titleId} dismissable={false} style={{ width: 560 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
      <p style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text, margin: '12px 0 4px' }}>{d.prompt}</p>
      <div
        style={{
          ...PIXEL_FONT,
          fontSize: FONT.title,
          color: exact ? COLORS.good : COLORS.accent,
          marginBottom: 10,
        }}
        aria-live="polite"
      >
        {exact ? d.ready : fill(d.header, { count: remaining })}
      </div>

      <Muted>{d.yourCards}</Muted>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {RESOURCES.map((r) => {
          const name = t.catan.resources[r]
          const canAdd = selected[r] < hand[r] && selectedTotal < owed
          const canRemove = selected[r] > 0
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                disabled={!canAdd}
                aria-label={fill(d.add, { resource: name })}
                onClick={() => add(r)}
                className={FOCUS_CLASS}
                style={{ ...CARD_BUTTON, opacity: canAdd ? 1 : 0.45 }}
              >
                <PixelSprite name={`card-${r}` as UiSpriteName} scale={2} alt="" />
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    ...PIXEL_FONT,
                    fontSize: FONT.small,
                    color: COLORS.text,
                    backgroundColor: COLORS.panelDark,
                    padding: '1px 4px',
                    border: `1px solid ${COLORS.panelBorder}`,
                  }}
                >
                  {hand[r]}
                </span>
              </button>
              <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text, width: 52 }}>{name}</span>
              <PixelButton aria-label={fill(d.remove, { resource: name })} disabled={!canRemove} onClick={() => remove(r)}>
                -
              </PixelButton>
              <span style={{ ...PIXEL_FONT, fontSize: FONT.body, color: COLORS.text, width: 20, textAlign: 'center' }}>
                {selected[r]}
              </span>
              <PixelButton aria-label={fill(d.add, { resource: name })} disabled={!canAdd} onClick={() => add(r)}>
                +
              </PixelButton>
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: `2px solid ${COLORS.panelBorder}`, marginTop: 10, paddingTop: 8 }}>
        <Muted>{d.discardPile}</Muted>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6, minHeight: 68 }}>
          {selectedTotal === 0 ? <Muted>{d.pileEmpty}</Muted> : null}
          {RESOURCES.flatMap((r) =>
            Array.from({ length: selected[r] }, (_, i) => (
              <button
                key={`${r}-${i}`}
                type="button"
                aria-label={fill(d.remove, { resource: t.catan.resources[r] })}
                onClick={() => remove(r)}
                className={FOCUS_CLASS}
                style={CARD_BUTTON}
              >
                <PixelSprite name={`card-${r}` as UiSpriteName} scale={2} alt="" />
              </button>
            )),
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
        <Muted>{d.keep}</Muted>
        {RESOURCES.filter((r) => hand[r] - selected[r] > 0).map((r) => (
          <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <ResourceIcon resource={r} size={16} />
            <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{hand[r] - selected[r]}</span>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <Muted>{fill(d.selected, { count: selectedTotal, total: owed })}</Muted>
        <PixelButton variant="danger" disabled={!exact} onClick={() => onConfirm(selected)}>
          {d.confirm}
        </PixelButton>
      </div>
    </ModalDialog>
  )
}
