'use client'

import { useId, useState } from 'react'
import { useT } from '@/lib/i18n/client'
import { botAcceptsTrade } from '@/lib/games/catan/ai'
import { RESOURCES } from '@/lib/games/catan/constants'
import { emptyResources, hasResources, maritimeRate, totalCards } from '@/lib/games/catan/helpers'
import type { Action, GameState, PlayerId, Resource, ResourceCounts } from '@/lib/games/catan/types'
import { fill } from './event-text'
import { ResourceIcon } from './ResourceIcon'
import { ResourceStepper } from './ResourceStepper'
import { Tooltip } from './Tooltip'
import { ModalDialog, Muted, PIXEL_FONT, PixelButton, SectionTitle } from './ui'

function ResourcePicker({
  resources,
  disabled,
  selected,
  onSelect,
  rate,
}: {
  resources: ResourceCounts
  disabled: (r: Resource) => boolean
  selected: Resource | null
  onSelect: (r: Resource) => void
  rate?: (r: Resource) => number
}) {
  const t = useT()
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {RESOURCES.map((r) => (
        <Tooltip key={r} content={`${t.catan.resources[r]}: ${resources[r]}`}>
          <PixelButton
            selected={selected === r}
            disabled={disabled(r)}
            onClick={() => onSelect(r)}
            aria-pressed={selected === r}
            style={{ minWidth: 52 }}
          >
            <ResourceIcon resource={r} size={16} />
            <span>
              {resources[r]}
              {rate ? ` \u00b7 ${rate(r)}:1` : ''}
            </span>
          </PixelButton>
        </Tooltip>
      ))}
    </div>
  )
}

export function TradeDialog({
  state,
  human,
  onTrade,
  onClose,
}: {
  state: GameState
  human: PlayerId
  onTrade: (action: Action) => void
  onClose: () => void
}) {
  const t = useT()
  const d = t.catan.trade
  const titleId = useId()
  const [tab, setTab] = useState<'bank' | 'players'>('bank')
  const [bankGive, setBankGive] = useState<Resource | null>(null)
  const [bankGet, setBankGet] = useState<Resource | null>(null)
  const [give, setGive] = useState<ResourceCounts>(emptyResources())
  const [get, setGet] = useState<ResourceCounts>(emptyResources())

  const humanPlayer = state.players[human]
  const humanHas = hasResources(humanPlayer.resources, give)
  const tradeShapeValid =
    totalCards(give) > 0 &&
    totalCards(get) > 0 &&
    RESOURCES.every((r) => give[r] === 0 || get[r] === 0) &&
    humanHas

  const bankTradeValid =
    bankGive !== null &&
    bankGet !== null &&
    bankGive !== bankGet &&
    humanPlayer.resources[bankGive] >= maritimeRate(state, human, bankGive) &&
    state.bank[bankGet] > 0

  return (
    <ModalDialog labelledBy={titleId} onClose={onClose} style={{ width: 480 }}>
      <SectionTitle id={titleId}>{d.title}</SectionTitle>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <Tooltip content={d.tabBank}>
            <PixelButton selected={tab === 'bank'} onClick={() => setTab('bank')} aria-pressed={tab === 'bank'}>
              {d.tabBank}
            </PixelButton>
          </Tooltip>
          <Tooltip content={d.tabPlayers}>
            <PixelButton selected={tab === 'players'} onClick={() => setTab('players')} aria-pressed={tab === 'players'}>
              {d.tabPlayers}
            </PixelButton>
          </Tooltip>
          <div style={{ flex: 1 }} />
          <Tooltip content={d.close}>
            <PixelButton onClick={onClose}>{d.close}</PixelButton>
          </Tooltip>
        </div>

        {tab === 'bank' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Muted>{d.give}</Muted>
              <div style={{ marginTop: 6 }}>
                <ResourcePicker
                  resources={humanPlayer.resources}
                  disabled={(r) => humanPlayer.resources[r] < maritimeRate(state, human, r)}
                  selected={bankGive}
                  onSelect={setBankGive}
                  rate={(r) => maritimeRate(state, human, r)}
                />
              </div>
            </div>
            <div>
              <Muted>{d.get}</Muted>
              <div style={{ marginTop: 6 }}>
                <ResourcePicker
                  resources={state.bank}
                  disabled={(r) => state.bank[r] === 0}
                  selected={bankGet}
                  onSelect={setBankGet}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Tooltip content={d.bankTrade}>
                <PixelButton variant="primary" disabled={!bankTradeValid} onClick={() => onTrade({ type: 'maritimeTrade', give: bankGive!, get: bankGet! })}>
                  {d.bankTrade}
                </PixelButton>
              </Tooltip>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <Muted>{d.give}</Muted>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {RESOURCES.map((r) => (
                  <ResourceStepper
                    key={r}
                    resource={r}
                    label={t.catan.resources[r]}
                    value={give[r]}
                    max={humanPlayer.resources[r]}
                    onChange={(n) => setGive((prev) => ({ ...prev, [r]: n }))}
                  />
                ))}
              </div>
            </div>
            <div>
              <Muted>{d.get}</Muted>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                {RESOURCES.map((r) => (
                  <ResourceStepper
                    key={r}
                    resource={r}
                    label={t.catan.resources[r]}
                    value={get[r]}
                    max={19}
                    onChange={(n) => setGet((prev) => ({ ...prev, [r]: n }))}
                  />
                ))}
              </div>
            </div>
            {!tradeShapeValid ? <Muted>{d.invalid}</Muted> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {state.players
                .filter((p) => p.id !== human)
                .map((bot) => {
                  const accepts = botAcceptsTrade(state, bot.id, { from: human, give, get })
                  const canTrade = tradeShapeValid && accepts
                  return (
                    <div key={bot.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          backgroundColor: {
                            red: '#c0392b',
                            blue: '#2e6fb7',
                            white: '#e8e0d0',
                            orange: '#e07b2a',
                          }[bot.color],
                          border: '1px solid #1a1410',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ ...PIXEL_FONT, fontSize: 10, color: '#e8d5b0', flex: 1 }}>
                        {accepts ? fill(d.accepts, { name: bot.name }) : fill(d.declines, { name: bot.name })}
                      </span>
                      <Tooltip content={fill(d.playerTrade, { name: bot.name })}>
                        <PixelButton
                          variant="primary"
                          disabled={!canTrade}
                          onClick={() =>
                            onTrade({ type: 'domesticTrade', partner: bot.id, give, get })
                          }
                        >
                          {fill(d.playerTrade, { name: bot.name })}
                        </PixelButton>
                      </Tooltip>
                    </div>
                  )
                })}
            </div>
          </div>
        )}
    </ModalDialog>
  )
}
