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

const ORDER: DevCardType[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint']

export function DevCardsPanel({
  state,
  human,
  onPlayCard,
  titleId,
}: {
  state: GameState
  human: PlayerId
  onPlayCard: (card: PlayableDevCard) => void
  /** Lets a sheet use the panel's heading as its label. */
  titleId?: string
}) {
  const t = useT()
  const d = t.catan.devCardsPanel
  const me = state.players[human]
  const playable = playableDevCards(state, human)

  const groups = ORDER.map((card) => {
    const oldCount = me.devCards.filter((c) => c === card).length
    const newCount = me.newDevCards.filter((c) => c === card).length
    return { card, oldCount, newCount, total: oldCount + newCount }
  }).filter((g) => g.total > 0)

  return (
    <Panel data-tutorial="dev-cards" style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <SectionTitle id={titleId}>{t.catan.devCards}</SectionTitle>
      {groups.length === 0 ? (
        <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>{d.empty}</span>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
          {groups.map(({ card, oldCount, newCount, total }) => {
            const isVp = card === 'victoryPoint'
            const isPlayable = !isVp && playable.includes(card as PlayableDevCard)
            const name = t.catan.playCard.cards[card].name
            const desc = t.catan.playCard.cards[card].desc
            const body = (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  width: 76,
                  opacity: newCount > 0 && !isPlayable ? 0.6 : 1,
                }}
              >
                <div style={{ position: 'relative' }}>
                  <PixelSprite name={DEV_SPRITES[card]} scale={2} alt={name} />
                  <span
                    style={{
                      position: 'absolute',
                      bottom: -8,
                      right: -6,
                      ...PIXEL_FONT,
                      fontSize: 12,
                      color: COLORS.text,
                      backgroundColor: COLORS.panelDark,
                      border: `2px solid ${COLORS.panelBorder}`,
                      padding: '0 4px',
                      lineHeight: 1.3,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {total}
                  </span>
                  {newCount > 0 ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: -8,
                        right: -8,
                        ...PIXEL_FONT,
                        fontSize: 8,
                        color: COLORS.panelDark,
                        backgroundColor: COLORS.accent,
                        border: `1px solid ${COLORS.panelDark}`,
                        padding: '0 3px',
                      }}
                    >
                      {d.newTag}
                    </span>
                  ) : null}
                </div>
                <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.text, textAlign: 'center', lineHeight: 1.2 }}>{name}</span>
                {isVp ? (
                  <span style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.muted }}>{d.vpHidden}</span>
                ) : null}
                {isPlayable ? (
                  <PixelButton
                    data-tutorial="play-card"
                    onClick={() => onPlayCard(card as PlayableDevCard)}
                    aria-label={`${d.play} ${name}`}
                    style={{ width: '100%', fontSize: 10 }}
                  >
                    {d.play}
                  </PixelButton>
                ) : null}
                {!isVp && !isPlayable && newCount === 0 && oldCount > 0 ? (
                  <span style={{ ...PIXEL_FONT, fontSize: 8, color: COLORS.muted }}>{t.catan.layout.cardNotPlayable}</span>
                ) : null}
              </div>
            )
            return isPlayable ? (
              <Tooltip key={card} content={desc}>
                {body}
              </Tooltip>
            ) : (
              <div key={card}>{body}</div>
            )
          })}
        </div>
      )}
    </Panel>
  )
}
