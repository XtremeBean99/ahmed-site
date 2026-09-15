'use client'

import { useId, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import { validateAction } from '@/lib/games/catan/engine'
import { emptyResources, hasResources, totalCards } from '@/lib/games/catan/helpers'
import type { Action, DevCardType, GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'
import { ResourceIcon } from './ResourceIcon'
import { ResourceStepper } from './ResourceStepper'
import { Tooltip } from './Tooltip'
import { ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

export type PlayableDevCard = Exclude<DevCardType, 'victoryPoint'>

/** Cards the engine would accept right now, derived with validateAction so the UI can never disagree. */
export function playableDevCards(state: GameState, human: PlayerId): PlayableDevCard[] {
  if (human < 0 || human >= state.players.length) return []
  if (state.phase.kind !== 'preRoll' && state.phase.kind !== 'main') return []
  if (state.current !== human || state.devCardPlayedThisTurn) return []
  const hand = state.players[human].devCards
  const playable: PlayableDevCard[] = []
  if (hand.includes('knight') && validateAction(state, { type: 'playKnight' }) === null) playable.push('knight')
  if (hand.includes('roadBuilding') && validateAction(state, { type: 'playRoadBuilding' }) === null) {
    playable.push('roadBuilding')
  }
  if (
    hand.includes('yearOfPlenty') &&
    RESOURCES.some((a) =>
      RESOURCES.some((b) => validateAction(state, { type: 'playYearOfPlenty', resources: [a, b] }) === null),
    )
  ) {
    playable.push('yearOfPlenty')
  }
  if (hand.includes('monopoly') && validateAction(state, { type: 'playMonopoly', resource: 'brick' }) === null) {
    playable.push('monopoly')
  }
  return playable
}

export function PlayCardDialog({
  state,
  human,
  onPlay,
  onClose,
  preselect = null,
}: {
  state: GameState
  human: PlayerId
  onPlay: (action: Action) => void
  onClose: () => void
  /** Opens with this card already chosen (from the DevCardsPanel Play button). */
  preselect?: PlayableDevCard | null
}) {
  const t = useT()
  const d = t.catan.playCard
  const titleId = useId()
  const [selected, setSelected] = useState<Exclude<DevCardType, 'victoryPoint'> | null>(preselect)
  const [yop, setYop] = useState<ResourceCounts>(emptyResources())
  const [mono, setMono] = useState<Resource | null>(null)

  const playable = playableDevCards(state, human)

  const yopTotal = totalCards(yop)
  const yopValid = yopTotal === 2 && hasResources(state.bank, yop)

  const doPlay = () => {
    if (!selected) return
    if (selected === 'knight') onPlay({ type: 'playKnight' })
    else if (selected === 'roadBuilding') onPlay({ type: 'playRoadBuilding' })
    else if (selected === 'yearOfPlenty') {
      const pair: [Resource, Resource] = RESOURCES.flatMap((r) =>
        Array.from({ length: yop[r] }, () => r),
      ) as [Resource, Resource]
      onPlay({ type: 'playYearOfPlenty', resources: pair })
    } else if (selected === 'monopoly' && mono !== null) {
      onPlay({ type: 'playMonopoly', resource: mono })
    }
  }

  const valid =
    selected === 'knight' ||
    selected === 'roadBuilding' ||
    (selected === 'yearOfPlenty' && yopValid) ||
    (selected === 'monopoly' && mono !== null)

  return (
    <ModalDialog labelledBy={titleId} onClose={onClose} style={{ width: 440 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
        {playable.length === 0 ? (
          <p style={{ ...PIXEL_FONT, fontSize: 10, color: '#a09080' }}>{d.empty}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {playable.map((card) => (
              <Tooltip key={card} content={d.cards[card].desc}>
                <PixelButton
                  selected={selected === card}
                  onClick={() => {
                    setSelected(card)
                    setYop(emptyResources())
                    setMono(null)
                  }}
                  aria-pressed={selected === card}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%' }}
                >
                  <span style={{ fontSize: 12, color: '#e8d5b0' }}>{d.cards[card].name}</span>
                  <span style={{ fontSize: 10, color: '#a09080', whiteSpace: 'normal', textAlign: 'left' }}>
                    {d.cards[card].desc}
                  </span>
                </PixelButton>
              </Tooltip>
            ))}

            {selected === 'yearOfPlenty' ? (
              <div style={{ marginTop: 4 }}>
                <Muted>{d.chooseTwo}</Muted>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                  {RESOURCES.map((r) => (
                    <ResourceStepper
                      key={r}
                      resource={r}
                      label={t.catan.resources[r]}
                      value={yop[r]}
                      max={Math.min(2, state.bank[r])}
                      onChange={(n) => {
                        const next = { ...yop, [r]: n }
                        if (totalCards(next) > 2) return
                        setYop(next)
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {selected === 'monopoly' ? (
              <div style={{ marginTop: 4 }}>
                <Muted>{d.chooseOne}</Muted>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {RESOURCES.map((r) => (
                    <PixelButton
                      key={r}
                      selected={mono === r}
                      onClick={() => setMono(r)}
                      aria-pressed={mono === r}
                    >
                      <ResourceIcon resource={r} size={14} />
                      {t.catan.resources[r]}
                    </PixelButton>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <Tooltip content={d.close}>
            <PixelButton onClick={onClose}>{d.close}</PixelButton>
          </Tooltip>
          <Tooltip content={d.play}>
            <PixelButton variant="primary" disabled={!valid} onClick={doPlay}>
              {d.play}
            </PixelButton>
          </Tooltip>
        </div>
    </ModalDialog>
  )
}
