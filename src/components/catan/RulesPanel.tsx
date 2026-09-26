'use client'

import { useId, useState, type ReactNode } from 'react'
import { useT } from '@/lib/i18n/client'
import { COSTS, DEV_DECK_COUNTS, PIECES } from '@/lib/games/catan/constants'
import type { DevCardType } from '@/lib/games/catan/types'
import { devCardSprite } from './dialog-logic'
import { fill } from './event-text'
import { useCatanLayout } from './layout'
import { PixelSprite } from './PixelSprite'
import { CostIcons } from './ResourceIcon'
import { COLORS, FOCUS_CLASS, FONT, ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

const DEV_DECK_SIZE = Object.values(DEV_DECK_COUNTS).reduce((sum, n) => sum + n, 0)

const DEV_CARDS: readonly DevCardType[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victoryPoint']

export function RulesPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const d = t.catan.rulesPanel
  const playCard = t.catan.playCard
  const { layout, coarse } = useCatanLayout()
  const titleId = useId()
  const [active, setActive] = useState('goal')

  const sections = [
    { id: 'goal', label: d.goalTitle },
    { id: 'turn', label: d.turnTitle },
    { id: 'costs', label: d.costsTitle },
    { id: 'production', label: d.productionTitle },
    { id: 'devcards', label: d.devCardsTitle },
    { id: 'trading', label: d.tradingTitle },
    { id: 'awards', label: d.awardsTitle },
    { id: 'shortcuts', label: d.shortcutsTitle },
  ]

  const goTo = (id: string) => {
    setActive(id)
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }

  const bodyText = (lines: readonly string[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {lines.map((line) => (
        <p key={line} style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text, margin: 0, lineHeight: 1.5 }}>
          {line}
        </p>
      ))}
    </div>
  )

  const costCards = [
    { key: 'road' as const, cost: COSTS.road, limit: PIECES.roads, limitLabel: d.pieceLimit },
    { key: 'settlement' as const, cost: COSTS.settlement, limit: PIECES.settlements, limitLabel: d.pieceLimit },
    { key: 'city' as const, cost: COSTS.city, limit: PIECES.cities, limitLabel: d.pieceLimit },
    { key: 'devCard' as const, cost: COSTS.devCard, limit: DEV_DECK_SIZE, limitLabel: d.deckSize },
  ]

  const section = (id: string, title: string, body: ReactNode) => (
    <section id={id} style={{ marginBottom: 16 }}>
      <SectionTitle style={{ color: COLORS.accent, marginBottom: 8 }}>{title}</SectionTitle>
      {body}
    </section>
  )

  const picker = layout === 'stack' ? (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <Muted>{d.sectionsLabel}</Muted>
      <select
        value={active}
        onChange={(e) => goTo(e.target.value)}
        className={FOCUS_CLASS}
        style={{
          ...PIXEL_FONT,
          fontSize: FONT.small,
          backgroundColor: COLORS.bg,
          border: `2px solid ${COLORS.panelBorder}`,
          color: COLORS.text,
          padding: '8px',
          width: '100%',
          minHeight: coarse ? 44 : 28,
        }}
      >
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  ) : (
    <nav aria-label={d.sectionsLabel} style={{ width: 170, flexShrink: 0, alignSelf: 'flex-start', position: 'sticky', top: 0 }}>
      <Muted>{d.sectionsLabel}</Muted>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {sections.map((s) => (
          <PixelButton key={s.id} selected={active === s.id} onClick={() => goTo(s.id)} style={{ justifyContent: 'flex-start' }}>
            {s.label}
          </PixelButton>
        ))}
      </div>
    </nav>
  )

  return (
    <ModalDialog labelledBy={titleId} onClose={onClose} style={{ width: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <SectionTitle id={titleId}>{d.title}</SectionTitle>
        <PixelButton onClick={onClose}>{t.catan.close}</PixelButton>
      </div>

      {layout === 'stack' ? (
        picker
      ) : (
        <div style={{ display: 'flex', gap: 14 }}>
          {picker}
          <div style={{ flex: 1, minWidth: 0 }}>
            <RulesBody />
          </div>
        </div>
      )}
      {layout === 'stack' ? <RulesBody /> : null}
    </ModalDialog>
  )

  function RulesBody() {
    return (
      <>
        {section(
          'goal',
          d.goalTitle,
          bodyText(d.goalBody),
        )}
        {section('turn', d.turnTitle, bodyText(d.turnBody))}
        {section(
          'costs',
          d.costsTitle,
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {costCards.map((card) => (
              <div
                key={card.key}
                style={{
                  backgroundColor: COLORS.bg,
                  border: `2px solid ${COLORS.panelBorder}`,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{d.costs[card.key]}</span>
                <CostIcons cost={card.cost} size={16} />
                <Muted>{fill(card.limitLabel, { n: card.limit })}</Muted>
              </div>
            ))}
          </div>,
        )}
        {section('production', d.productionTitle, bodyText(d.productionBody))}
        {section(
          'devcards',
          d.devCardsTitle,
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Muted>{d.devCardsBody}</Muted>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {DEV_CARDS.map((card) => (
                <div
                  key={card}
                  style={{
                    backgroundColor: COLORS.bg,
                    border: `2px solid ${COLORS.panelBorder}`,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <PixelSprite name={devCardSprite(card)} scale={2} alt="" />
                  <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{playCard.cards[card].name}</span>
                  <Muted>{playCard.cards[card].desc}</Muted>
                </div>
              ))}
            </div>
          </div>,
        )}
        {section('trading', d.tradingTitle, bodyText(d.tradingBody))}
        {section('awards', d.awardsTitle, bodyText(d.awardsBody))}
        {section(
          'shortcuts',
          d.shortcutsTitle,
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {d.shortcuts.map((shortcut) => (
              <div key={shortcut.action} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    ...PIXEL_FONT,
                    fontSize: FONT.small,
                    color: COLORS.text,
                    backgroundColor: COLORS.bg,
                    border: `2px solid ${COLORS.panelBorder}`,
                    padding: '4px 6px',
                    minWidth: 72,
                    textAlign: 'center',
                  }}
                >
                  {shortcut.keys}
                </span>
                <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{shortcut.action}</span>
              </div>
            ))}
          </div>,
        )}
      </>
    )
  }
}
