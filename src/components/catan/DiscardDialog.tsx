'use client'

import { useId, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import { emptyResources, totalCards } from '@/lib/games/catan/helpers'
import type { GameState, PlayerId, ResourceCounts } from '@/lib/games/catan/types'
import { fill } from './event-text'
import { ResourceStepper } from './ResourceStepper'
import { ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

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
    <ModalDialog labelledBy={titleId} dismissable={false} style={{ width: 420 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
        <p style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0', margin: '12px 0 8px' }}>
          {fill(d.prompt, { count: owed })}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
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
          <PixelButton variant="danger" disabled={!exact} onClick={() => onConfirm(selected)}>
            {d.confirm}
          </PixelButton>
        </div>
    </ModalDialog>
  )
}
