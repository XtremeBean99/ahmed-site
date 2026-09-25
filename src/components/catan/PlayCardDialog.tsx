'use client'

import { useId, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { RESOURCES } from '@/lib/games/catan/constants'
import { validateAction } from '@/lib/games/catan/engine'
import { totalCards } from '@/lib/games/catan/helpers'
import type { Action, DevCardType, GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'
import { devCardSprite, emptySelection, yearOfPlentyAdd, yearOfPlentyPair, yearOfPlentyRemove, yearOfPlentyValid } from './dialog-logic'
import { PixelSprite } from './PixelSprite'
import { ResourceIcon } from './ResourceIcon'
import { ResourceStepper } from './ResourceStepper'
import { COLORS, FONT, ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

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
  const [selected, setSelected] = useState<PlayableDevCard | null>(preselect)
  const [yop, setYop] = useState<ResourceCounts>(emptySelection())
  const [mono, setMono] = useState<Resource | null>(null)

  const playable = playableDevCards(state, human)
  const selectedCard = selected && playable.includes(selected) ? selected : null

  const yopValid = yearOfPlentyValid(yop, state.bank)
  const valid =
    selectedCard === 'knight' ||
    selectedCard === 'roadBuilding' ||
    (selectedCard === 'yearOfPlenty' && yopValid) ||
    (selectedCard === 'monopoly' && mono !== null)

  const chooseCard = (card: PlayableDevCard) => {
    setSelected(card)
    setYop(emptySelection())
    setMono(null)
  }

  const changeYop = (resource: Resource, next: number) => {
    setYop((prev) => (next > prev[resource] ? yearOfPlentyAdd(prev, resource, state.bank) : yearOfPlentyRemove(prev, resource)))
  }

  const doPlay = () => {
    if (!valid) return
    if (selectedCard === 'knight') onPlay({ type: 'playKnight' })
    else if (selectedCard === 'roadBuilding') onPlay({ type: 'playRoadBuilding' })
    else if (selectedCard === 'yearOfPlenty') {
      const pair = yearOfPlentyPair(yop)
      if (pair) onPlay({ type: 'playYearOfPlenty', resources: pair })
    } else if (selectedCard === 'monopoly' && mono !== null) {
      onPlay({ type: 'playMonopoly', resource: mono })
    }
  }

  return (
    <ModalDialog labelledBy={titleId} onClose={onClose} style={{ width: 520 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>

      {playable.length === 0 ? (
        <p style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.muted }}>{d.empty}</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
              gap: 8,
              marginTop: 12,
            }}
          >
            {playable.map((card) => (
              <PixelButton
                key={card}
                selected={selectedCard === card}
                aria-pressed={selectedCard === card}
                onClick={() => chooseCard(card)}
                style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, width: '100%', padding: 10 }}
              >
                <PixelSprite name={devCardSprite(card)} scale={2} alt="" />
                <span style={{ fontSize: FONT.body, color: COLORS.text }}>{d.cards[card].name}</span>
                <span style={{ fontSize: FONT.small, color: COLORS.muted, whiteSpace: 'normal', textAlign: 'left' }}>
                  {d.cards[card].desc}
                </span>
              </PixelButton>
            ))}
          </div>

          {selectedCard === 'yearOfPlenty' ? (
            <div style={{ marginTop: 12 }}>
              <Muted>{d.chooseTwo}</Muted>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {RESOURCES.map((r) => (
                  <ResourceStepper
                    key={r}
                    resource={r}
                    label={t.catan.resources[r]}
                    value={yop[r]}
                    max={Math.min(2, state.bank[r], yop[r] + (2 - totalCards(yop)))}
                    onChange={(n) => changeYop(r, n)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {selectedCard === 'monopoly' ? (
            <div style={{ marginTop: 12 }}>
              <Muted>{d.chooseOne}</Muted>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {RESOURCES.map((r) => (
                  <PixelButton key={r} selected={mono === r} onClick={() => setMono(r)} aria-pressed={mono === r}>
                    <ResourceIcon resource={r} size={16} />
                    {t.catan.resources[r]}
                  </PixelButton>
                ))}
              </div>
            </div>
          ) : null}

          {selectedCard === 'knight' || selectedCard === 'roadBuilding' ? (
            <Muted style={{ display: 'block', marginTop: 12 }}>{d.cards[selectedCard].desc}</Muted>
          ) : null}
        </>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <PixelButton onClick={onClose}>{d.close}</PixelButton>
        <PixelButton variant="primary" disabled={!valid} onClick={doPlay}>
          {d.play}
        </PixelButton>
      </div>
    </ModalDialog>
  )
}
