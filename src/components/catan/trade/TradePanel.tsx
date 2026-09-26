'use client'

import { useId, useRef, useState } from 'react'
import type { JSX } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useT } from '@/lib/i18n/client'
import { MAX_OFFERS_PER_TURN, RESOURCES } from '@/lib/games/catan/constants'
import { emptyResources, maritimeRate, totalCards } from '@/lib/games/catan/helpers'
import type { Action, GameState, PlayerId, Resource, ResourceCounts, TradeOffer } from '@/lib/games/catan/types'
import { fill } from '../event-text'
import { PixelSprite } from '../PixelSprite'
import { PLAYER_HEX, PLAYER_TEXT } from '../player-colors'
import { getCatanPrefsStorage, readPrefs } from '../prefs'
import { ResourceIcon } from '../ResourceIcon'
import { ResourceStepper } from '../ResourceStepper'
import { COLORS, FONT, ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from '../ui'
import { canOffer, offerBlockReason, replyRows, stepTradeTerms, type OfferBlockReason } from './trade-logic'

type Tab = 'bank' | 'players'

const TAB_KEY = 'catan-trade-tab-v1'

const DOTS_CSS = `
  @keyframes catan-trade-dot {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
  .catan-trade-dot { animation: catan-trade-dot 0.9s steps(2, start) infinite; }
  .catan-trade-dot:nth-child(2) { animation-delay: 0.15s; }
  .catan-trade-dot:nth-child(3) { animation-delay: 0.3s; }
  @media (prefers-reduced-motion: reduce) {
    .catan-trade-dot { animation: none; opacity: 0.6; }
  }
`

function readTab(): Tab {
  if (typeof window === 'undefined') return 'bank'
  try {
    return window.localStorage.getItem(TAB_KEY) === 'players' ? 'players' : 'bank'
  } catch {
    return 'bank'
  }
}

function writeTab(tab: Tab): void {
  try {
    window.localStorage.setItem(TAB_KEY, tab)
  } catch {
    // ignore quota / privacy-mode failures
  }
}

function resourceNames(counts: ResourceCounts, names: Record<Resource, string>): string {
  const parts = RESOURCES.filter((r) => counts[r] > 0).map((r) => `${counts[r]} ${names[r]}`)
  return parts.length > 0 ? parts.join(', ') : '0'
}

function pendingOfferOf(game: GameState, human: PlayerId): TradeOffer | null {
  if (game.phase.kind !== 'trade') return null
  return game.phase.offer.from === human ? game.phase.offer : null
}

export function TradePanel(props: {
  game: GameState
  human: PlayerId
  apply: (a: Action) => boolean
  onClose: () => void
}): JSX.Element {
  const { game, human, apply, onClose } = props
  const t = useT()
  const d = t.catan.trade
  const titleId = useId()
  const reduceMotion = useReducedMotion()
  const [tab, setTab] = useState<Tab>(readTab)
  const [bankGive, setBankGive] = useState<Resource | null>(null)
  const [bankGet, setBankGet] = useState<Resource | null>(null)
  const [give, setGive] = useState<ResourceCounts>(() => emptyResources())
  const [get, setGet] = useState<ResourceCounts>(() => emptyResources())
  const [to, setTo] = useState<PlayerId[]>(() => game.players.filter((p) => p.id !== human).map((p) => p.id))
  const applyRef = useRef(apply)
  applyRef.current = apply

  const me = game.players[human]
  const offer = pendingOfferOf(game, human)
  const locked = offer !== null
  const animations = readPrefs(getCatanPrefsStorage()).animations && !reduceMotion

  const selectTab = (next: Tab) => {
    setTab(next)
    writeTab(next)
  }

  const close = () => {
    if (offer) apply({ type: 'cancelTrade' })
    onClose()
  }

  const selectBankGive = (r: Resource) => {
    setBankGive(r)
    if (bankGet === r) setBankGet(null)
  }

  const selectBankGet = (r: Resource) => {
    setBankGet(r)
    if (bankGive === r) setBankGive(null)
  }

  const bankRate = bankGive === null ? 4 : maritimeRate(game, human, bankGive)
  const bankValid =
    bankGive !== null &&
    bankGet !== null &&
    bankGive !== bankGet &&
    me.resources[bankGive] >= bankRate &&
    game.bank[bankGet] > 0
  const bankLabel =
    bankValid && bankGive !== null && bankGet !== null
      ? fill(d.bank.action, {
          giveCount: bankRate,
          give: t.catan.resources[bankGive],
          get: t.catan.resources[bankGet],
        })
      : d.bank.trade

  const doBankTrade = () => {
    if (bankGive === null || bankGet === null) return
    if (apply({ type: 'maritimeTrade', give: bankGive, get: bankGet })) {
      setBankGive(null)
      setBankGet(null)
    }
  }

  const stepSide = (side: 'give' | 'get', resource: Resource, delta: 1 | -1) => {
    const max = side === 'give' ? me.resources[resource] : 19
    const next = stepTradeTerms({ give, get }, side, resource, delta, max)
    setGive(next.give)
    setGet(next.get)
  }

  const toggleRecipient = (player: PlayerId) => {
    setTo((prev) => (prev.includes(player) ? prev.filter((p) => p !== player) : [...prev, player].sort((a, b) => a - b)))
  }

  const offersLeft = Math.max(0, MAX_OFFERS_PER_TURN - game.offersThisTurn)
  const offersLeftText = offersLeft === 1 ? d.players.offersLeftOne : fill(d.players.offersLeft, { count: offersLeft })
  const block = offerBlockReason(game, human)
  const blockText: Record<OfferBlockReason, string> = {
    rollFirst: d.players.rollFirst,
    notMain: d.players.notMain,
    noOffers: d.players.noOffers,
    noCards: d.players.noCards,
  }
  const offerValid = canOffer(game, human, give, get, to)

  const makeOffer = () => {
    if (!offerValid) return
    apply({ type: 'proposeTrade', to: [...to].sort((a, b) => a - b), give, get })
  }

  const rows = offer ? replyRows(game, offer) : []

  const dotStyle = animations ? undefined : { animation: 'none', opacity: 0.6 }

  return (
    <ModalDialog labelledBy={titleId} onClose={close} style={{ width: 520 }}>
      <style>{DOTS_CSS}</style>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        <PixelButton selected={tab === 'bank'} onClick={() => selectTab('bank')} aria-pressed={tab === 'bank'} disabled={locked}>
          {d.tabBank}
        </PixelButton>
        <PixelButton selected={tab === 'players'} onClick={() => selectTab('players')} aria-pressed={tab === 'players'} disabled={locked}>
          {d.tabPlayers}
        </PixelButton>
        <div style={{ flex: 1 }} />
        <PixelButton onClick={close}>{d.close}</PixelButton>
      </div>

      {!offer && tab === 'bank' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Muted>{d.bank.give}</Muted>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {RESOURCES.map((r) => {
                const rate = maritimeRate(game, human, r)
                const harbour = rate === 2 ? r : rate === 3 ? 'any' : null
                const count = me.resources[r]
                return (
                  <PixelButton
                    key={r}
                    selected={bankGive === r}
                    disabled={count < rate}
                    onClick={() => selectBankGive(r)}
                    aria-pressed={bankGive === r}
                    aria-label={`${t.catan.resources[r]}: ${count}, ${fill(d.bank.rate, { rate })}`}
                    style={{ minWidth: 60, flexDirection: 'column', gap: 2, padding: '6px 4px' }}
                  >
                    <ResourceIcon resource={r} size={16} />
                    <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{count}</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                      {harbour !== null ? <PixelSprite name={`harbor-${harbour}`} scale={1} alt="" /> : null}
                      <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>
                        {fill(d.bank.rate, { rate })}
                      </span>
                    </span>
                  </PixelButton>
                )
              })}
            </div>
          </div>
          <div>
            <Muted>{d.bank.get}</Muted>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {RESOURCES.map((r) => {
                const count = game.bank[r]
                return (
                  <PixelButton
                    key={r}
                    selected={bankGet === r}
                    disabled={count === 0 || r === bankGive}
                    onClick={() => selectBankGet(r)}
                    aria-pressed={bankGet === r}
                    aria-label={`${t.catan.resources[r]}: ${count}`}
                    style={{ minWidth: 60, flexDirection: 'column', gap: 2, padding: '6px 4px' }}
                  >
                    <ResourceIcon resource={r} size={16} />
                    <span style={{ ...PIXEL_FONT, fontSize: FONT.small, color: COLORS.text }}>{count}</span>
                  </PixelButton>
                )
              })}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PixelButton variant="primary" disabled={!bankValid} onClick={doBankTrade}>
              {bankLabel}
            </PixelButton>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Muted>{d.players.youGive}</Muted>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {RESOURCES.map((r) => (
                <ResourceStepper
                  key={r}
                  resource={r}
                  label={t.catan.resources[r]}
                  value={give[r]}
                  max={me.resources[r]}
                  disabled={locked}
                  onChange={(n) => stepSide('give', r, n > give[r] ? 1 : -1)}
                />
              ))}
            </div>
          </div>
          <div>
            <Muted>{d.players.youGet}</Muted>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
              {RESOURCES.map((r) => (
                <ResourceStepper
                  key={r}
                  resource={r}
                  label={t.catan.resources[r]}
                  value={get[r]}
                  max={19}
                  disabled={locked}
                  onChange={(n) => stepSide('get', r, n > get[r] ? 1 : -1)}
                />
              ))}
            </div>
          </div>

          {offer ? (
            <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.map((row) => (
                <div
                  key={row.player}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderTop: `2px solid ${COLORS.panelBorder}`,
                    paddingTop: 6,
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      backgroundColor: PLAYER_HEX[row.color],
                      border: `2px solid ${COLORS.panelDark}`,
                    }}
                  />
                  <span style={{ ...PIXEL_FONT, fontSize: FONT.body, color: PLAYER_TEXT[row.color] }}>{row.name}</span>
                  <Muted>{totalCards(game.players[row.player].resources) === 1 ? d.players.card : fill(d.players.cards, { count: totalCards(game.players[row.player].resources) })}</Muted>
                  <div style={{ flex: 1 }} />
                  {row.reply === 'pending' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 1 }}>
                        <span className="catan-trade-dot" style={{ ...PIXEL_FONT, fontSize: FONT.body, color: COLORS.text, ...dotStyle }}>.</span>
                        <span className="catan-trade-dot" style={{ ...PIXEL_FONT, fontSize: FONT.body, color: COLORS.text, ...dotStyle }}>.</span>
                        <span className="catan-trade-dot" style={{ ...PIXEL_FONT, fontSize: FONT.body, color: COLORS.text, ...dotStyle }}>.</span>
                      </span>
                      <Muted>{d.pending.waiting}</Muted>
                    </span>
                  ) : row.reply === 'accept' ? (
                    <PixelButton variant="good" onClick={() => apply({ type: 'confirmTrade', partner: row.player })}>
                      {fill(d.pending.tradeWith, { name: row.name })}
                    </PixelButton>
                  ) : row.reply === 'decline' ? (
                    <Muted>{d.pending.declined}</Muted>
                  ) : (
                    <>
                      <Muted>
                        {row.counter
                          ? fill(d.pending.counterTerms, {
                              give: resourceNames(row.counter.give, t.catan.resources),
                              get: resourceNames(row.counter.get, t.catan.resources),
                            })
                          : ''}
                      </Muted>
                      <PixelButton variant="good" onClick={() => apply({ type: 'confirmTrade', partner: row.player })}>
                        {d.pending.acceptCounter}
                      </PixelButton>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Muted>{d.players.recipients}</Muted>
              {game.players
                .filter((p) => p.id !== human)
                .map((p) => {
                  const selected = to.includes(p.id)
                  const held = totalCards(p.resources)
                  return (
                    <PixelButton
                      key={p.id}
                      selected={selected}
                      onClick={() => toggleRecipient(p.id)}
                      aria-pressed={selected}
                      style={{ justifyContent: 'flex-start', gap: 10, width: '100%' }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 14,
                          height: 14,
                          flexShrink: 0,
                          backgroundColor: PLAYER_HEX[p.color],
                          border: `2px solid ${COLORS.panelDark}`,
                        }}
                      />
                      <span style={{ ...PIXEL_FONT, fontSize: FONT.body, color: PLAYER_TEXT[p.color], flex: 1, textAlign: 'left' }}>
                        {p.name}
                      </span>
                      <Muted>{held === 1 ? d.players.card : fill(d.players.cards, { count: held })}</Muted>
                    </PixelButton>
                  )
                })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Muted>{offersLeftText}</Muted>
            <div style={{ flex: 1 }} />
            {offer ? (
              <PixelButton variant="danger" onClick={() => apply({ type: 'cancelTrade' })}>
                {d.pending.withdraw}
              </PixelButton>
            ) : (
              <>
                {block ? <Muted>{blockText[block]}</Muted> : !offerValid ? <Muted>{d.players.invalid}</Muted> : null}
                <PixelButton variant="primary" disabled={!offerValid} onClick={makeOffer}>
                  {d.players.makeOffer}
                </PixelButton>
              </>
            )}
          </div>
        </div>
      )}
    </ModalDialog>
  )
}
