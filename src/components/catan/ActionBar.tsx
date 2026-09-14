'use client'

import { useT } from '@/lib/i18n/client'
import type { GameState, PlayerId } from '@/lib/games/catan/types'
import { fill, playerSubject } from './event-text'
import { ResourceIcon } from './ResourceIcon'
import { Tooltip } from './Tooltip'
import { COLORS, Muted, PIXEL_FONT, Panel, PixelButton } from './ui'

export type BuildMode = 'road' | 'settlement' | 'city' | null

function actionTip(tip: string, cost: string | null, reason: string | null): string {
  const parts = [tip]
  if (cost) parts.push(cost)
  if (reason) parts.push(reason)
  return parts.join('. ')
}

export function ActionBar({
  game,
  human,
  humanActing,
  inPreRoll,
  inMain,
  buildMode,
  onBuildModeChange,
  canRoll,
  canRoad,
  canSettlement,
  canCity,
  canBuyDev,
  canTrade,
  canPlayCard,
  canEndTurn,
  roadReasonText,
  settlementReasonText,
  cityReasonText,
  devReasonText,
  onRoll,
  onBuyDev,
  onTrade,
  onPlayCard,
  onEndTurn,
  hintText,
  onHint,
}: {
  game: GameState
  human: PlayerId
  humanActing: boolean
  inPreRoll: boolean
  inMain: boolean
  buildMode: BuildMode
  onBuildModeChange: (mode: BuildMode) => void
  canRoll: boolean
  canRoad: boolean
  canSettlement: boolean
  canCity: boolean
  canBuyDev: boolean
  canTrade: boolean
  canPlayCard: boolean
  canEndTurn: boolean
  roadReasonText: string | null
  settlementReasonText: string | null
  cityReasonText: string | null
  devReasonText: string | null
  onRoll: () => void
  onBuyDev: () => void
  onTrade: () => void
  onPlayCard: () => void
  onEndTurn: () => void
  hintText: string | null
  onHint?: () => void
}) {
  const t = useT()
  const bar = t.catan.actionBar
  const tips = t.catan.tooltips

  return (
    <Panel style={{ borderWidth: '2px 0 0 0', padding: 8 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {inPreRoll && humanActing ? (
          <Tooltip content={canRoll ? tips.roll : `${tips.roll}. ${bar.rollFirst}`}>
            <PixelButton
              data-tutorial="roll"
              variant="primary"
              disabled={!canRoll}
              onClick={onRoll}
              style={{ width: '100%' }}
            >
              {bar.roll}
            </PixelButton>
          </Tooltip>
        ) : null}
        {inMain || (inPreRoll && humanActing) ? (
          <>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Tooltip content={actionTip(tips.road, t.catan.cost.road, roadReasonText)}>
                  <PixelButton
                    data-tutorial="build-road"
                    selected={buildMode === 'road'}
                    disabled={!canRoad}
                    onClick={() => onBuildModeChange(buildMode === 'road' ? null : 'road')}
                    aria-pressed={buildMode === 'road'}
                    aria-label={bar.roadAria}
                    aria-describedby={roadReasonText ? 'catan-cost-road catan-reason-road' : 'catan-cost-road'}
                    style={{ width: '100%', flexDirection: 'column', gap: 2 }}
                  >
                    <span>{bar.road}</span>
                    <span style={{ display: 'inline-flex', gap: 2 }}>
                      <ResourceIcon resource="brick" size={16} />
                      <ResourceIcon resource="lumber" size={16} />
                    </span>
                  </PixelButton>
                </Tooltip>
                {roadReasonText ? (
                  <span id="catan-reason-road" style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.muted, lineHeight: 1.2 }}>
                    {roadReasonText}
                  </span>
                ) : null}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Tooltip content={actionTip(tips.settlement, t.catan.cost.settlement, settlementReasonText)}>
                  <PixelButton
                    data-tutorial="build-settlement"
                    selected={buildMode === 'settlement'}
                    disabled={!canSettlement}
                    onClick={() => onBuildModeChange(buildMode === 'settlement' ? null : 'settlement')}
                    aria-pressed={buildMode === 'settlement'}
                    aria-label={bar.settlementAria}
                    aria-describedby={
                      settlementReasonText ? 'catan-cost-settlement catan-reason-settlement' : 'catan-cost-settlement'
                    }
                    style={{ width: '100%', flexDirection: 'column', gap: 2 }}
                  >
                    <span>{bar.settlement}</span>
                    <span style={{ display: 'inline-flex', gap: 2 }}>
                      <ResourceIcon resource="brick" size={16} />
                      <ResourceIcon resource="lumber" size={16} />
                      <ResourceIcon resource="wool" size={16} />
                      <ResourceIcon resource="grain" size={16} />
                    </span>
                  </PixelButton>
                </Tooltip>
                {settlementReasonText ? (
                  <span
                    id="catan-reason-settlement"
                    style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.muted, lineHeight: 1.2 }}
                  >
                    {settlementReasonText}
                  </span>
                ) : null}
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <Tooltip content={actionTip(tips.city, t.catan.cost.city, cityReasonText)}>
                  <PixelButton
                    data-tutorial="build-city"
                    selected={buildMode === 'city'}
                    disabled={!canCity}
                    onClick={() => onBuildModeChange(buildMode === 'city' ? null : 'city')}
                    aria-pressed={buildMode === 'city'}
                    aria-label={bar.cityAria}
                    aria-describedby={cityReasonText ? 'catan-cost-city catan-reason-city' : 'catan-cost-city'}
                    style={{ width: '100%', flexDirection: 'column', gap: 2 }}
                  >
                    <span>{bar.city}</span>
                    <span style={{ display: 'inline-flex', gap: 2 }}>
                      <ResourceIcon resource="grain" size={16} />
                      <ResourceIcon resource="grain" size={16} />
                      <ResourceIcon resource="ore" size={16} />
                      <ResourceIcon resource="ore" size={16} />
                      <ResourceIcon resource="ore" size={16} />
                    </span>
                  </PixelButton>
                </Tooltip>
                {cityReasonText ? (
                  <span id="catan-reason-city" style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.muted, lineHeight: 1.2 }}>
                    {cityReasonText}
                  </span>
                ) : null}
              </div>
            </div>
            <span id="catan-cost-road" hidden>
              {t.catan.cost.road}
            </span>
            <span id="catan-cost-settlement" hidden>
              {t.catan.cost.settlement}
            </span>
            <span id="catan-cost-city" hidden>
              {t.catan.cost.city}
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Tooltip content={actionTip(tips.buyDevCard, t.catan.cost.devCard, devReasonText)}>
                  <PixelButton
                    data-tutorial="buy-card"
                    disabled={!canBuyDev}
                    onClick={onBuyDev}
                    aria-label={bar.buyDevCardAria}
                    aria-describedby={devReasonText ? 'catan-cost-dev-card catan-reason-dev-card' : 'catan-cost-dev-card'}
                  >
                    {bar.buyDevCard}
                  </PixelButton>
                </Tooltip>
                {devReasonText ? (
                  <span id="catan-reason-dev-card" style={{ ...PIXEL_FONT, fontSize: 9, color: COLORS.muted, lineHeight: 1.2 }}>
                    {devReasonText}
                  </span>
                ) : null}
              </div>
              <span id="catan-cost-dev-card" hidden>
                {t.catan.cost.devCard}
              </span>
              <Tooltip content={canTrade ? tips.trade : `${tips.trade}. ${bar.rollFirst}`}>
                <PixelButton data-tutorial="trade" disabled={!canTrade} onClick={onTrade}>
                  {bar.trade}
                </PixelButton>
              </Tooltip>
              <Tooltip content={canPlayCard ? tips.playCard : `${tips.playCard}. ${bar.rollFirst}`}>
                <PixelButton data-tutorial="play-card" disabled={!canPlayCard} onClick={onPlayCard}>
                  {bar.playCard}
                </PixelButton>
              </Tooltip>
              <Tooltip content={tips.endTurn}>
                <PixelButton
                  data-tutorial="end-turn"
                  variant="danger"
                  disabled={!canEndTurn}
                  onClick={onEndTurn}
                >
                  {bar.endTurn}
                </PixelButton>
              </Tooltip>
              {onHint ? (
                <Tooltip content={hintText ? bar.hintHide : bar.hint}>
                  <PixelButton aria-pressed={hintText !== null} onClick={onHint}>
                    {hintText ? bar.hintHide : bar.hint}
                  </PixelButton>
                </Tooltip>
              ) : null}
            </div>
            {hintText ? (
              <div
                role="status"
                aria-live="polite"
                style={{ ...PIXEL_FONT, fontSize: 10, color: COLORS.accent, lineHeight: 1.4 }}
              >
                {hintText}
              </div>
            ) : null}
            {buildMode ? <Muted>{t.catan.cancelHint}</Muted> : null}
            {humanActing && game.phase.kind === 'roadBuilding' ? (
              <Muted>
                {fill(t.catan.status.roadBuilding, {
                  player: playerSubject(game, human),
                  remaining: game.phase.remaining,
                })}
              </Muted>
            ) : null}
          </>
        ) : null}
      </div>
    </Panel>
  )
}
