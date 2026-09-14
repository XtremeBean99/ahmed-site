'use client'

import { useId, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import { emptyResources, totalCards } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'
import { fill } from './event-text'
import { PixelSprite } from './PixelSprite'
import { ResourceStepper } from './ResourceStepper'
import { Tooltip } from './Tooltip'
import { ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'
import type { UiSpriteName } from './ui-sprites'

function CardPicker({
  resource,
  hand,
  selected,
  max,
  onChange,
}: {
  resource: Resource
  hand: number
  selected: number
  max: number
  onChange: (next: number) => void
}) {
  const t = useT()
  const name = t.catan.resources[resource]
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {Array.from({ length: hand }, (_, i) => {
        const active = i < selected
        return (
          <Tooltip key={i} content={`${name}: ${active ? t.catan.discard.clickRemove : t.catan.discard.clickAdd}`}>
            <button
              type="button"
              aria-pressed={active}
              aria-label={active ? `${name}: selected` : `${name}: not selected`}
              onClick={() => onChange(active ? selected - 1 : Math.min(selected + 1, max))}
              style={{
                padding: 0,
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                outline: active ? '2px solid #e0a040' : '2px solid transparent',
                outlineOffset: 1,
              }}
            >
              <PixelSprite name={`card-${resource}` as UiSpriteName} scale={1} alt="" />
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
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
  const [selected, setSelected] = useState<ResourceCounts>(emptyResources())

  const hand = state.players[human].resources
  const selectedTotal = totalCards(selected)
  const exact = selectedTotal === owed

  return (
    <ModalDialog labelledBy={titleId} dismissable={false} style={{ width: 460 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
      <p style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0', margin: '12px 0 8px' }}>
        {fill(d.prompt, { count: owed })}
      </p>
      <Muted>{d.cardsHint}</Muted>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        {RESOURCES.map((r) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CardPicker
              resource={r}
              hand={hand[r]}
              selected={selected[r]}
              max={Math.min(hand[r], owed)}
              onChange={(n) => {
                const next = { ...selected, [r]: n }
                if (totalCards(next) > owed) return
                setSelected(next)
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12, borderTop: '2px solid #5a4430', paddingTop: 8 }}>
        {RESOURCES.map((r) => (
          <ResourceStepper
            key={r}
            resource={r}
            label={t.catan.resources[r]}
            value={selected[r]}
            max={Math.min(hand[r], owed)}
            onChange={(n) => {
              const next = { ...selected, [r]: n }
              if (totalCards(next) > owed) return
              setSelected(next)
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <Muted>{fill(d.selected, { count: selectedTotal, total: owed })}</Muted>
        <Tooltip content={d.confirm}>
          <PixelButton variant="danger" disabled={!exact} onClick={() => onConfirm(selected)}>
            {d.confirm}
          </PixelButton>
        </Tooltip>
      </div>
    </ModalDialog>
  )
}
