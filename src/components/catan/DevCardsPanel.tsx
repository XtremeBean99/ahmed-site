'use client'

import { useT } from '@/lib/i18n/client'
import type { DevCardType, GameState, PlayerId } from '@/lib/games/catan/types'
import { PixelSprite } from './PixelSprite'
import { type PlayableDevCard, playableDevCards } from './PlayCardDialog'
import { Tooltip } from './Tooltip'
import { COLORS, PIXEL_FONT, Panel, PixelButton, SectionTitle } from './ui'
import type { UiSpriteName } from './ui-sprites'

const DEV_SPRITES: Record<DevCardType, UiSpriteName> = {
  knight: 'card-knight',
  roadBuilding: 'card-road-building',
  yearOfPlenty: 'card-year-of-plenty',
  monopoly: 'card-monopoly',
  victoryPoint: 'card-victory-point',
}

function DevCard({
  card,
  name,
  desc,
  playable,
  isNew,
  onPlay,
}: {
  card: DevCardType
  name: string
  desc: string
  playable: boolean
  isNew: boolean
  onPlay: () => void
}) {
  const t = useT()
  const d = t.catan.devCardsPanel
  const vp = card === 'victoryPoint'

  return (
    <Tooltip content={isNew ? `${d.newHint}. ${desc}` : desc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          width: 64,
          opacity: isNew ? 0.6 : 1,
        }}
      >
        <div style={{ position: 'relative' }}>
          <PixelSprite name={DEV_SPRITES[card]} scale={2} alt={name} />
          {isNew ? (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -8,
                ...PIXEL_FONT,
                fontSize: 9,
                color: COLORS.panelDark,
                backgroundColor: COLORS.accent,
                padding: '0 3px',
                border: `1px solid ${COLORS.panelDark}`,
              }}
            >
              {d.newTag}
            </span>
          ) : null}
        </div>
        <span style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.text, textAlign: 'center', lineHeight: 1.2 }}>
          {name}
        </span>
        {vp ? (
          <span style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.muted }}>{d.vpHidden}</span>
        ) : null}
        {!vp && playable ? (
          <PixelButton
            onClick={onPlay}
            aria-label={`${d.play} ${name}`}
            style={{ padding: '2px 6px', fontSize: 9, width: '100%' }}
          >
            {d.play}
          </PixelButton>
        ) : null}
      </div>
    </Tooltip>
  )
}

export function DevCardsPanel({
  state,
  human,
  onPlayCard,
}: {
  state: GameState
  human: PlayerId
  onPlayCard: (card: PlayableDevCard) => void
}) {
  const t = useT()
  const d = t.catan.devCardsPanel
  const me = state.players[human]
  const playable = playableDevCards(state, human)

  const cards: { card: DevCardType; playable: boolean; isNew: boolean }[] = [
    ...me.devCards.map((card) => ({ card, playable: playable.includes(card as PlayableDevCard), isNew: false })),
    ...me.newDevCards.map((card) => ({ card, playable: false, isNew: true })),
  ]

  return (
    <Panel data-tutorial="dev-cards" style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <SectionTitle>{t.catan.devCards}</SectionTitle>
      <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>
          {t.catan.playable}: {playable.length}
        </span>
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>
          {t.catan.newCard}: {me.newDevCards.length}
        </span>
      </div>
      {cards.length === 0 ? (
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>{d.empty}</span>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          {cards.map(({ card, playable: isPlayable, isNew }, index) => (
            <DevCard
              key={`${card}-${index}`}
              card={card}
              name={t.catan.playCard.cards[card].name}
              desc={t.catan.playCard.cards[card].desc}
              playable={isPlayable}
              isNew={isNew}
              onPlay={() => onPlayCard(card as PlayableDevCard)}
            />
          ))}
        </div>
      )}
    </Panel>
  )
}
